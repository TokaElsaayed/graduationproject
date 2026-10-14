import {
  BadRequestException,
  ConflictException,
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createHmac,
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'crypto';
import { promisify } from 'util';
import type {
  AccountRole,
  AuthResponse,
  AuthTokenPayload,
  AuthUser,
} from './auth.types';

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keyLength: number,
) => Promise<Buffer>;
const DEMO_PASSWORD = 'CareCircle123!';
const DEMO_USERS: Array<{
  id: string;
  fullName: string;
  email: string;
  role: AccountRole;
}> = [
  { id: 'demo-caregiver-001', fullName: 'Mariam Hassan', email: 'demo@carecircle.test', role: 'caregiver' },
  { id: 'demo-older-adult-001', fullName: 'Mahmoud Hassan', email: 'olderadult@carecircle.test', role: 'older_adult' },
];

interface StoredUser extends AuthUser {
  passwordHash: string;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly users = new Map<string, StoredUser>();
  private readonly jwtSecret: string;

  constructor(config: ConfigService) {
    const configuredSecret = config.get<string>('AUTH_JWT_SECRET');
    if (!configuredSecret && process.env.NODE_ENV === 'production') {
      throw new Error('AUTH_JWT_SECRET must be configured in production.');
    }
    this.jwtSecret =
      configuredSecret ?? 'care-circle-local-development-secret-change-before-deployment';
  }

  async onModuleInit(): Promise<void> {
    if (!this.isDevelopment()) return;

    for (const demoUser of DEMO_USERS) {
      if (this.users.has(demoUser.email)) continue;
      const passwordHash = await this.hashPassword(DEMO_PASSWORD);
      this.users.set(demoUser.email, {
        ...demoUser,
        passwordHash,
      });
    }
  }

  async signUp(input: {
    fullName: string;
    email: string;
    password: string;
    role?: string;
  }): Promise<AuthResponse> {
    const fullName = input.fullName?.trim();
    const email = input.email?.trim().toLowerCase();
    const password = input.password;
    const role = input.role ?? 'caregiver';

    if (!fullName || fullName.length > 120) {
      throw new BadRequestException('Enter your name (up to 120 characters).');
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Enter a valid email address.');
    }
    if (typeof password !== 'string' || password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters.');
    }
    if (role !== 'caregiver' && role !== 'older_adult') {
      throw new BadRequestException('Choose a valid account type.');
    }

    const passwordHash = await this.hashPassword(password);
    if (this.users.has(email)) {
      throw new ConflictException('An account with this email already exists.');
    }

    const user: StoredUser = {
      id: randomUUID(),
      fullName,
      email,
      role,
      passwordHash,
    };
    this.users.set(email, user);
    return this.createAuthResponse(user);
  }

  async logIn(input: { email: string; password: string }): Promise<AuthResponse> {
    const email = input.email?.trim().toLowerCase();
    const user = email ? this.users.get(email) : undefined;
    if (
      !user ||
      typeof input.password !== 'string' ||
      !(await this.verifyPassword(input.password, user.passwordHash))
    ) {
      throw new UnauthorizedException('Email or password is incorrect.');
    }
    return this.createAuthResponse(user);
  }

  userFromToken(token: string): AuthUser {
    const [header, body, signature, extra] = token.split('.');
    if (!header || !body || !signature || extra) {
      throw new UnauthorizedException('Invalid or expired session. Please sign in again.');
    }

    const expected = createHmac('sha256', this.jwtSecret)
      .update(`${header}.${body}`)
      .digest();
    let actual: Buffer;
    try {
      actual = Buffer.from(signature, 'base64url');
    } catch {
      throw new UnauthorizedException('Invalid or expired session. Please sign in again.');
    }
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new UnauthorizedException('Invalid or expired session. Please sign in again.');
    }

    try {
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as AuthTokenPayload;
      if (payload.exp <= Math.floor(Date.now() / 1000)) {
        throw new Error('Token expired');
      }
      return {
        id: payload.id,
        fullName: payload.fullName,
        email: payload.email,
        role: payload.role,
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired session. Please sign in again.');
    }
  }

  private createAuthResponse(user: StoredUser): AuthResponse {
    const authUser: AuthUser = {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    };
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({ ...authUser, iat: now, exp: now + 60 * 60 * 24 * 7 }),
    ).toString('base64url');
    const input = `${header}.${payload}`;
    const signature = createHmac('sha256', this.jwtSecret).update(input).digest('base64url');
    return { accessToken: `${input}.${signature}`, user: authUser };
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16);
    const hash = await scrypt(password, salt, 64);
    return `${salt.toString('hex')}:${hash.toString('hex')}`;
  }

  private async verifyPassword(password: string, stored: string): Promise<boolean> {
    const [saltHex, hashHex] = stored.split(':');
    if (!saltHex || !hashHex || typeof password !== 'string') return false;
    const expected = Buffer.from(hashHex, 'hex');
    const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  private isDevelopment(): boolean {
    return process.env.NODE_ENV !== 'production';
  }
}
