import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { randomUUID } from 'crypto';
import { ContactsRepository, MedicationsRepository } from '../profiles/profile.repositories';
import type { Medication } from '../profiles/profile.types';
import type { ConfirmationValue, Dose, FamilyAlert, ReminderDose } from './reminder.types';

const TIME_ZONE = 'Africa/Cairo';
const RETRY_SECONDS_DEFAULT = 600;
const MAX_RETRIES_DEFAULT = 3;

@Injectable()
export class RemindersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RemindersService.name);
  private readonly doses: Dose[] = [];
  private readonly alerts: FamilyAlert[] = [];
  private readonly retryTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly retrySeconds: number;
  private readonly maxRetries: number;

  constructor(
    private readonly config: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly medications: MedicationsRepository,
    private readonly contacts: ContactsRepository,
  ) {
    this.retrySeconds = this.readPositiveInt('MEDICINE_REMINDER_RETRY_SECONDS', RETRY_SECONDS_DEFAULT, true);
    this.maxRetries = this.readPositiveInt('MEDICINE_REMINDER_MAX_RETRIES', MAX_RETRIES_DEFAULT, true);
  }

  onModuleInit(): void {
    for (const medication of this.medications.findAll()) {
      this.refreshMedicationSchedule(medication.id);
      this.createMissedScheduleDoseIfNeeded(medication);
    }
  }

  onModuleDestroy(): void {
    for (const timer of this.retryTimers.values()) clearTimeout(timer);
    this.retryTimers.clear();
    for (const job of this.schedulerRegistry.getCronJobs().values()) job.stop();
  }

  refreshMedicationSchedule(medicationId: string): void {
    const prefix = this.jobPrefix(medicationId);
    for (const [name, job] of this.schedulerRegistry.getCronJobs()) {
      if (!name.startsWith(prefix)) continue;
      job.stop();
      this.schedulerRegistry.deleteCronJob(name);
    }

    const medication = this.medications.findById(medicationId);
    if (!medication) return;

    for (const time of new Set(medication.scheduleTimes)) {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) continue;
      const [hour, minute] = time.split(':').map(Number);
      const name = `${prefix}${hour}-${minute}`;
      const job = new CronJob(
        `0 ${minute} ${hour} * * *`,
        () => this.createScheduledDose(medicationId, time),
        null,
        false,
        TIME_ZONE,
      );
      this.schedulerRegistry.addCronJob(name, job);
      job.start();
    }
  }

  getToday(userId: string): ReminderDose[] {
    const today = cairoDateKey(new Date());
    const stored = this.doses
      .filter((dose) => dose.userId === userId && cairoDateKey(new Date(dose.scheduledAt)) === today)
      .map((dose) => this.toReminderDose(dose))
      .filter((dose): dose is ReminderDose => dose !== undefined);
    const keys = new Set(stored.map((dose) => `${dose.medicationId}:${dose.scheduledAt}`));
    const now = Date.now();

    for (const medication of this.medications.findByUser(userId)) {
      for (const time of new Set(medication.scheduleTimes)) {
        const scheduledAt = cairoDateTime(today, time).toISOString();
        if (new Date(scheduledAt).getTime() <= now || keys.has(`${medication.id}:${scheduledAt}`)) continue;
        stored.push({
          id: `upcoming:${medication.id}:${today}:${time}`,
          userId,
          medicationId: medication.id,
          scheduledAt,
          status: 'pending',
          confirmedAt: null,
          reminderCount: 0,
          medicationName: medication.name,
          dose: medication.dose,
          reminderText: this.buildReminderText(medication, time),
          displayStatus: 'upcoming',
        });
      }
    }

    return stored.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  }

  getLog(userId: string): Array<Dose & { medicationName: string; dose: string }> {
    return this.doses
      .filter((dose) => dose.userId === userId)
      .map((dose) => {
        const medication = this.medications.findById(dose.medicationId);
        return {
          ...dose,
          medicationName: medication?.name ?? 'Deleted medication',
          dose: medication?.dose ?? '',
        };
      })
      .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
  }

  getFamilyAlerts(userId: string): FamilyAlert[] {
    return this.alerts
      .filter((alert) => alert.userId === userId)
      .map((alert) => ({ ...alert, familyMembers: alert.familyMembers.map((member) => ({ ...member })) }))
      .sort((a, b) => b.time.localeCompare(a.time));
  }

  demoTrigger(userId: string, medicationId?: string): ReminderDose {
    const medication = medicationId
      ? this.medications.find(userId, medicationId)
      : this.medications.findByUser(userId)[0];
    if (!medication) throw new NotFoundException('No medication was found for this user.');
    const dose = this.createDose(medication, new Date());
    return this.toReminderDose(dose)!;
  }

  async confirmDose(userId: string, doseId: string, transcript: string) {
    const dose = this.doses.find((item) => item.id === doseId && item.userId === userId);
    if (!dose) throw new NotFoundException('Dose not found.');
    if (dose.status !== 'pending') {
      return { status: dose.status, response: dose.status === 'taken' ? 'تم تسجيل هذه الجرعة من قبل.' : 'لقد مرّ موعد هذه الجرعة.' };
    }

    const confirmation = await this.parseConfirmation(transcript);
    if (confirmation === 'unclear') {
      return {
        status: dose.status,
        confirmation,
        response: 'لم أسمعك بوضوح. هل تناولت الدواء؟ يمكنك قول نعم، أو ليس بعد.',
      };
    }
    if (!confirmation) {
      return {
        status: dose.status,
        confirmation,
        response: 'حسناً. عندما تتناول الدواء، أخبرني من فضلك.',
      };
    }

    dose.status = 'taken';
    dose.confirmedAt = new Date().toISOString();
    this.clearRetry(dose.id);
    return { status: dose.status, confirmation, confirmedAt: dose.confirmedAt, response: 'شكراً لك، تم تسجيل أنك تناولت الدواء.' };
  }

  async parseConfirmation(transcript: string): Promise<ConfirmationValue> {
    try {
      const apiKey = this.config.get<string>('GROQ_API_KEY');
      if (!apiKey) throw new Error('GROQ_API_KEY is missing');
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        signal: AbortSignal.timeout(10_000),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: this.config.get<string>('GROQ_TEXT_MODEL') ?? 'openai/gpt-oss-20b',
          messages: [
            {
              role: 'system',
              content: 'Classify only whether the user says they already took the medicine. Reply with one JSON object and no other text: {"taken":true}, {"taken":false}, or {"taken":"unclear"}. Do not infer from medical advice.',
            },
            { role: 'user', content: transcript },
          ],
          reasoning_effort: 'low',
          reasoning_format: 'hidden',
          max_completion_tokens: 40,
        }),
      });
      if (!response.ok) throw new Error(`Groq confirmation failed (${response.status})`);
      const result = await response.json() as {
        choices?: Array<{ message?: { content?: string | null } }>;
      };
      const content = result.choices?.[0]?.message?.content?.trim();
      if (!content) throw new Error('Empty confirmation response');
      const parsed: unknown = JSON.parse(content);
      if (
        typeof parsed === 'object' && parsed !== null && 'taken' in parsed &&
        Object.keys(parsed).length === 1 &&
        (parsed.taken === true || parsed.taken === false || parsed.taken === 'unclear')
      ) {
        return parsed.taken;
      }
      throw new Error('Invalid confirmation JSON');
    } catch (error) {
      this.logger.warn(`Groq confirmation unavailable; using keyword fallback (${String(error)})`);
      return this.keywordFallback(transcript);
    }
  }

  private keywordFallback(transcript: string): ConfirmationValue {
    const text = transcript.replace(/[،,.!?؟]/g, ' ').replace(/\s+/g, ' ').trim();
    if (/لسه.*ما.?خدتش|ما.?خدتش|مخدتش|ما.?خدتهاش|لسه ماخدتش/u.test(text)) return false;
    if (/(^|\s)(لأ|لا|لأه|مش)(\s|$)/u.test(text)) return false;
    if (/خدت|اخدت|أخدت|أخدته|اخدته|خدتها|تناولت/u.test(text)) return true;
    return 'unclear';
  }

  private createMissedScheduleDoseIfNeeded(medication: Medication): void {
    const today = cairoDateKey(new Date());
    const now = Date.now();
    for (const time of medication.scheduleTimes) {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) continue;
      const scheduledAt = cairoDateTime(today, time);
      if (scheduledAt.getTime() > now) continue;
      const exists = this.doses.some(
        (dose) => dose.medicationId === medication.id && dose.scheduledAt === scheduledAt.toISOString(),
      );
      if (!exists) this.createDose(medication, scheduledAt);
    }
  }

  private createScheduledDose(medicationId: string, time: string): void {
    const medication = this.medications.findById(medicationId);
    if (!medication || !medication.scheduleTimes.includes(time)) return;
    const scheduledAt = cairoDateTime(cairoDateKey(new Date()), time);
    if (this.doses.some((dose) => dose.medicationId === medicationId && dose.scheduledAt === scheduledAt.toISOString())) return;
    this.createDose(medication, scheduledAt);
  }

  private createDose(medication: Medication, scheduledAt: Date): Dose {
    const time = cairoTime(scheduledAt);
    const dose: Dose = {
      id: randomUUID(),
      userId: medication.userId,
      medicationId: medication.id,
      scheduledAt: scheduledAt.toISOString(),
      status: 'pending',
      confirmedAt: null,
      reminderCount: 1,
    };
    this.doses.push(dose);
    this.logger.log(`Medicine reminder: ${this.buildReminderText(medication, time)}`);
    this.scheduleRetry(dose.id);
    return dose;
  }

  private scheduleRetry(doseId: string): void {
    this.clearRetry(doseId);
    const timer = setTimeout(() => this.handleRetry(doseId), this.retrySeconds * 1000);
    this.retryTimers.set(doseId, timer);
  }

  private handleRetry(doseId: string): void {
    this.retryTimers.delete(doseId);
    const dose = this.doses.find((item) => item.id === doseId);
    if (!dose || dose.status !== 'pending') return;

    if (dose.reminderCount <= this.maxRetries) {
      dose.reminderCount += 1;
      const medication = this.medications.findById(dose.medicationId);
      if (medication) this.logger.log(`Medicine reminder: ${this.buildReminderText(medication, cairoTime(new Date(dose.scheduledAt)))}`);
      this.scheduleRetry(dose.id);
      return;
    }

    dose.status = 'missed';
    this.createFamilyAlert(dose);
  }

  private createFamilyAlert(dose: Dose): void {
    const medication = this.medications.findById(dose.medicationId);
    if (!medication) return;
    const familyMembers = this.contacts.findByUser(dose.userId)
      .filter((contact) => contact.canViewDashboard)
      .map(({ id, name, relationship, phone }) => ({ id, name, relationship, phone }));
    this.alerts.push({
      id: randomUUID(),
      userId: dose.userId,
      doseId: dose.id,
      medicationId: dose.medicationId,
      message: `Missed dose: ${medication.name}, ${medication.dose}, scheduled for ${cairoTime(new Date(dose.scheduledAt))}.`,
      time: new Date().toISOString(),
      familyMembers,
    });
    this.logger.warn(`Missed dose alert created for ${familyMembers.length} family member(s).`);
  }

  private toReminderDose(dose: Dose): ReminderDose | undefined {
    const medication = this.medications.findById(dose.medicationId);
    if (!medication) return undefined;
    const time = cairoTime(new Date(dose.scheduledAt));
    const due = dose.status === 'pending' && new Date(dose.scheduledAt).getTime() <= Date.now();
    return {
      ...dose,
      medicationName: medication.name,
      dose: medication.dose,
      reminderText: this.buildReminderText(medication, time),
      displayStatus: dose.status === 'taken' ? 'taken' : dose.status === 'missed' ? 'missed' : due ? 'due' : 'upcoming',
    };
  }

  private buildReminderText(medication: Medication, time: string): string {
    return `جه ميعاد دواء ${medication.name}، ${medication.dose}. ميعاد الجرعة ${time}.`;
  }

  private clearRetry(doseId: string): void {
    const timer = this.retryTimers.get(doseId);
    if (timer) clearTimeout(timer);
    this.retryTimers.delete(doseId);
  }

  private jobPrefix(medicationId: string): string {
    return `medicine-${Buffer.from(medicationId).toString('hex')}-`;
  }

  private readPositiveInt(name: string, fallback: number, allowZero = false): number {
    const parsed = Number(this.config.get<string>(name));
    const valid = Number.isInteger(parsed) && (allowZero ? parsed >= 0 : parsed > 0);
    return valid ? parsed : fallback;
  }
}

function cairoDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function cairoTime(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

function cairoDateTime(dateKey: string, time: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(utcGuess));
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const asUtc = Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'));
  return new Date(utcGuess - (asUtc - utcGuess));
}
