import {
  BadRequestException,
  ConflictException,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import {
  createHmac,
  randomBytes,
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
  fullName: string;
  email: string;
  role: AccountRole;
}> = [
  { fullName: 'Mariam Hassan', email: 'demo@carecircle.test', role: 'caregiver' },
  { fullName: 'Mahmoud Hassan', email: 'olderadult@carecircle.test', role: 'older_adult' },
];

@Injectable()
export class AuthService implements OnModuleInit, OnModuleDestroy {
  private readonly pool: Pool;
  private readonly jwtSecret: string;

  constructor(config: ConfigService) {
    this.pool = new Pool({
      host: config.get<string>('DATABASE_HOST') ?? 'localhost',
      port: Number(config.get<string>('DATABASE_PORT') ?? 5432),
      user: config.get<string>('DATABASE_USER'),
      password: config.get<string>('DATABASE_PASSWORD'),
      database: config.get<string>('DATABASE_NAME'),
    });
    const configuredSecret = config.get<string>('AUTH_JWT_SECRET');
    if (!configuredSecret && process.env.NODE_ENV === 'production') {
      throw new Error('AUTH_JWT_SECRET must be configured in production.');
    }
    this.jwtSecret =
      configuredSecret ?? 'care-circle-local-development-secret-change-before-deployment';
  }

  async onModuleInit(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS care_circle_users (
        id BIGSERIAL PRIMARY KEY,
        full_name VARCHAR(120) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role VARCHAR(24) NOT NULL CHECK (role IN ('caregiver', 'older_adult')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    if (this.isDevelopment()) {
      for (const demoUser of DEMO_USERS) {
        const passwordHash = await this.hashPassword(DEMO_PASSWORD);
        await this.pool.query(
          `INSERT INTO care_circle_users (full_name, email, password_hash, role)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (email) DO NOTHING`,
          [demoUser.fullName, demoUser.email, passwordHash, demoUser.role],
        );
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
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
    try {
      const result = await this.pool.query(
        `INSERT INTO care_circle_users (full_name, email, password_hash, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, full_name, email, role`,
        [fullName, email, passwordHash, role],
      );
      return this.createAuthResponse(this.toUser(result.rows[0]));
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException('An account with this email already exists.');
      }
      throw error;
    }
  }

  async logIn(input: { email: string; password: string }): Promise<AuthResponse> {
    const email = input.email?.trim().toLowerCase();
    const result = await this.pool.query(
      `SELECT id, full_name, email, role, password_hash
       FROM care_circle_users WHERE email = $1`,
      [email],
    );
    const row = result.rows[0];
    if (!row || !(await this.verifyPassword(input.password, row.password_hash))) {
      throw new UnauthorizedException('Email or password is incorrect.');
    }
    return this.createAuthResponse(this.toUser(row));
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

  private createAuthResponse(user: AuthUser): AuthResponse {
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({ ...user, iat: now, exp: now + 60 * 60 * 24 * 7 }),
    ).toString('base64url');
    const input = `${header}.${payload}`;
    const signature = createHmac('sha256', this.jwtSecret).update(input).digest('base64url');
    return { accessToken: `${input}.${signature}`, user };
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

  private toUser(row: {
    id: string | number;
    full_name: string;
    email: string;
    role: AccountRole;
  }): AuthUser {
    return {
      id: String(row.id),
      fullName: row.full_name,
      email: row.email,
      role: row.role,
    };
  }

  private isDevelopment(): boolean {
    return process.env.NODE_ENV !== 'production';
  }
}
