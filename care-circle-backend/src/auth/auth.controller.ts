import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import type { AuthenticatedRequest } from './auth.guard';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  signUp(
    @Body()
    body: { fullName: string; email: string; password: string; role?: string },
  ) {
    return this.authService.signUp(body);
  }

  @Post('login')
  logIn(@Body() body: { email: string; password: string }) {
    return this.authService.logIn(body);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  getCurrentUser(@Req() request: AuthenticatedRequest) {
    return request.user;
  }
}
