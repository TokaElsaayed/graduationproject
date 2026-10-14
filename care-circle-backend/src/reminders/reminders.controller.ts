import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.guard';
import { ConfirmDoseDto, DemoTriggerDto } from './reminder.dto';
import { RemindersService } from './reminders.service';

@Controller()
@UseGuards(AuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}

  @Get('reminders/today')
  getToday(@Req() request: AuthenticatedRequest) {
    return this.reminders.getToday(request.user.id);
  }

  @Get('reminders/log')
  getLog(@Req() request: AuthenticatedRequest) {
    return this.reminders.getLog(request.user.id);
  }

  @Get('family-alerts')
  getFamilyAlerts(@Req() request: AuthenticatedRequest) {
    return this.reminders.getFamilyAlerts(request.user.id);
  }

  @Post('reminders/demo-trigger')
  demoTrigger(@Req() request: AuthenticatedRequest, @Body() body: DemoTriggerDto = {}) {
    return this.reminders.demoTrigger(request.user.id, body.medicationId);
  }

  @Post('reminders/:doseId/confirm')
  confirmDose(
    @Req() request: AuthenticatedRequest,
    @Param('doseId') doseId: string,
    @Body() body: ConfirmDoseDto,
  ) {
    return this.reminders.confirmDose(request.user.id, doseId, body.transcript);
  }
}
