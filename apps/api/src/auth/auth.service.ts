import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { LoginDto } from './login.dto';

type AuthTokenPayload = {
  sub: string;
  role: 'admin';
};

@Injectable()
export class AuthService {
  constructor(private readonly configService: ConfigService) {}

  login(loginDto: LoginDto) {
    const expectedUsername = this.configService.get<string>('AUTH_USERNAME', 'admin');
    const expectedPassword = this.configService.get<string>('AUTH_PASSWORD', 'host');

    if (
      loginDto.username !== expectedUsername ||
      loginDto.password !== expectedPassword
    ) {
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng.');
    }

    const token = jwt.sign(
      {
        sub: loginDto.username,
        role: 'admin',
      } satisfies AuthTokenPayload,
      this.getJwtSecret(),
      {
        expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '12h'),
      } as SignOptions,
    );

    return {
      accessToken: token,
      user: {
        username: loginDto.username,
        role: 'admin' as const,
      },
    };
  }

  verifyToken(token: string) {
    try {
      return jwt.verify(token, this.getJwtSecret()) as AuthTokenPayload;
    } catch {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');
    }
  }

  private getJwtSecret() {
    return this.configService.get<string>('JWT_SECRET', 'badminton-host-secret');
  }
}
