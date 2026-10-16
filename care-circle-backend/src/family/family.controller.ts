import { Body, Controller, Get, Post, Req, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.guard';
import { DailyHealthCheckDto } from './family.dto';
import { FamilyService } from './family.service';

@Controller()
@UseGuards(AuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class FamilyController {
  constructor(private readonly family: FamilyService) {}

  @Get('family/overview')
  getOverview(@Req() request: AuthenticatedRequest) {
    return this.family.getOverview(request.user);
  }

  @Post('health-check')
  submitHealthCheck(@Req() request: AuthenticatedRequest, @Body() body: DailyHealthCheckDto) {
    return this.family.submitHealthCheck(request.user, body);
  }
}
