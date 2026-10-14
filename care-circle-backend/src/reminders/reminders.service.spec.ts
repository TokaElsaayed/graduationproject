import { SchedulerRegistry } from '@nestjs/schedule';
import type { ConfigService } from '@nestjs/config';
import { ContactsRepository, MedicationsRepository } from '../profiles/profile.repositories';
import { RemindersService } from './reminders.service';

jest.mock('@nestjs/schedule', () => ({
  SchedulerRegistry: class {
    private readonly jobs = new Map<string, { stop: () => void }>();
    getCronJobs() { return this.jobs; }
    addCronJob(name: string, job: { start: () => void; stop: () => void }) {
      this.jobs.set(name, job);
    }
    deleteCronJob(name: string) { this.jobs.delete(name); }
  },
}));
jest.mock('@nestjs/common', () => ({
  Injectable: () => (target: unknown) => target,
  Logger: class { log() {} warn() {} },
  NotFoundException: class extends Error {},
}));
jest.mock('@nestjs/config', () => ({ ConfigService: class {} }));

describe('RemindersService', () => {
  let service: RemindersService;
  let medications: MedicationsRepository;
  let scheduler: SchedulerRegistry;
  const configValues: Record<string, string> = {
    GROQ_API_KEY: 'test-key',
    GROQ_TEXT_MODEL: 'test-model',
    MEDICINE_REMINDER_RETRY_SECONDS: '1',
    MEDICINE_REMINDER_MAX_RETRIES: '1',
  };

  function createService() {
    medications = new MedicationsRepository();
    scheduler = new SchedulerRegistry();
    const config = { get: (key: string) => configValues[key] } as ConfigService;
    service = new RemindersService(config, scheduler, medications, new ContactsRepository());
  }

  function groqResponse(taken: true | false | 'unclear') {
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ taken }) } }] }), { status: 200 });
  }

  beforeEach(() => {
    createService();
  });

  afterEach(() => {
    service.onModuleDestroy();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('marks a dose taken after a valid positive confirmation', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(groqResponse(true));
    const dose = service.demoTrigger('demo-older-adult-001');

    const result = await service.confirmDose('demo-older-adult-001', dose.id, 'خدت الدوا');

    expect(result.status).toBe('taken');
    expect(service.getLog('demo-older-adult-001')[0].confirmedAt).toBeTruthy();
  });

  it('keeps a dose pending when the user says they did not take it', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(groqResponse(false));
    const dose = service.demoTrigger('demo-older-adult-001');

    const result = await service.confirmDose('demo-older-adult-001', dose.id, 'لسه ماخدتش');

    expect(result.status).toBe('pending');
    expect(service.getLog('demo-older-adult-001')[0].confirmedAt).toBeNull();
  });

  it('asks the user to repeat an unclear confirmation', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(groqResponse('unclear'));
    const dose = service.demoTrigger('demo-older-adult-001');

    const result = await service.confirmDose('demo-older-adult-001', dose.id, 'مش فاكر');

    expect(result.status).toBe('pending');
    expect(result.confirmation).toBe('unclear');
    expect(result.response).toContain('ممكن تقول');
  });

  it('uses Egyptian Arabic keyword fallback if Groq fails', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network unavailable'));
    const dose = service.demoTrigger('demo-older-adult-001');

    const result = await service.confirmDose('demo-older-adult-001', dose.id, 'لأ، لسه ماخدتش الدوا');

    expect(result.status).toBe('pending');
    expect(result.confirmation).toBe(false);
  });

  it('rejects malformed Groq JSON and falls back to a clear Egyptian phrase', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '```json {"taken":true} ```' } }],
    }), { status: 200 }));
    const dose = service.demoTrigger('demo-older-adult-001');

    const result = await service.confirmDose('demo-older-adult-001', dose.id, 'خدت الدوا');

    expect(result.status).toBe('taken');
    expect(result.confirmation).toBe(true);
  });

  it('repeats up to the configured retry count, then records missed dose and family alert', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-02-03T10:00:00.000Z'));
    service.demoTrigger('demo-older-adult-001');

    await jest.advanceTimersByTimeAsync(1000);
    expect(service.getLog('demo-older-adult-001')[0].reminderCount).toBe(2);
    expect(service.getLog('demo-older-adult-001')[0].status).toBe('pending');

    await jest.advanceTimersByTimeAsync(1000);
    expect(service.getLog('demo-older-adult-001')[0].status).toBe('missed');
    expect(service.getFamilyAlerts('demo-older-adult-001')).toHaveLength(1);
    expect(service.getFamilyAlerts('demo-older-adult-001')[0].familyMembers[0].relationship).toBe('بنتي');
  });

  it('replaces scheduled jobs when the existing profile medication time is edited', () => {
    const medication = medications.findById('med-demo-001')!;
    service.refreshMedicationSchedule(medication.id);
    const prefix = `medicine-${Buffer.from(medication.id).toString('hex')}-`;
    expect([...scheduler.getCronJobs().keys()].filter((key) => key.startsWith(prefix))).toHaveLength(2);

    medications.save({ ...medication, scheduleTimes: ['10:15'] });
    service.refreshMedicationSchedule(medication.id);

    const jobs = [...scheduler.getCronJobs().keys()].filter((key) => key.startsWith(prefix));
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toContain('10-15');
  });
});
