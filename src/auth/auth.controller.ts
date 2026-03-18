import { Controller, Post, Body, Req, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { PasscodeLoginDto } from './dto/passcode-login.dto';

function getClientIdentifier(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('passcode-login')
  async passcodeLogin(@Body() dto: PasscodeLoginDto, @Req() req: Request) {
    const identifier = getClientIdentifier(req);
    try {
      return await this.auth.passcodeLogin(dto.passcode, identifier);
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      console.error('[Auth] Unexpected error during passcode-login:', e);
      throw new UnauthorizedException('Invalid passcode');
    }
  }
}
