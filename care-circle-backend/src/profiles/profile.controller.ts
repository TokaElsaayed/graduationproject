import {
  Body,
  Controller,
  Delete,
  forwardRef,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.guard';
import {
  EmergencyContactDto,
  MedicationDto,
  UpdateEmergencyContactDto,
  UpdateMedicationDto,
  UpdateProfileDto,
} from './profile.dto';
import { ProfileService } from './profile.service';
import { RemindersService } from '../reminders/reminders.service';

@Controller('profiles/me')
@UseGuards(AuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class ProfileController {
  constructor(
    private readonly profiles: ProfileService,
    @Inject(forwardRef(() => RemindersService))
    private readonly reminders: RemindersService,
  ) {}

  @Get()
  getProfile(@Req() request: AuthenticatedRequest) {
    return this.profiles.getProfile(request.user.id, request.user.fullName);
  }

  @Patch()
  updateProfile(@Req() request: AuthenticatedRequest, @Body() body: UpdateProfileDto) {
    return this.profiles.updateProfile(request.user.id, request.user.fullName, body);
  }

  @Get('medications')
  listMedications(@Req() request: AuthenticatedRequest) {
    return this.profiles.listMedications(request.user.id);
  }

  @Post('medications')
  addMedication(@Req() request: AuthenticatedRequest, @Body() body: MedicationDto) {
    const medication = this.profiles.addMedication(request.user.id, body);
    this.reminders.refreshMedicationSchedule(medication.id);
    return medication;
  }

  @Patch('medications/:id')
  updateMedication(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: UpdateMedicationDto,
  ) {
    const medication = this.profiles.updateMedication(request.user.id, id, body);
    this.reminders.refreshMedicationSchedule(medication.id);
    return medication;
  }

  @Delete('medications/:id')
  removeMedication(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    const result = this.profiles.removeMedication(request.user.id, id);
    this.reminders.refreshMedicationSchedule(id);
    return result;
  }

  @Get('contacts')
  listContacts(@Req() request: AuthenticatedRequest) {
    return this.profiles.listContacts(request.user.id);
  }

  @Post('contacts')
  addContact(@Req() request: AuthenticatedRequest, @Body() body: EmergencyContactDto) {
    return this.profiles.addContact(request.user.id, body);
  }

  @Patch('contacts/:id')
  updateContact(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: UpdateEmergencyContactDto,
  ) {
    return this.profiles.updateContact(request.user.id, id, body);
  }

  @Delete('contacts/:id')
  removeContact(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.profiles.removeContact(request.user.id, id);
  }
}
