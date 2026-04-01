import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { User } from './entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtPayload } from '../../common/interfaces';

const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<{
    token: string;
    refreshToken: string;
    user: Record<string, unknown>;
  }> {
    const existing = await this.userRepository.findOne({
      where: [{ email: dto.email }, { username: dto.username }],
    });

    if (existing) {
      throw new ConflictException('User already exists with that email or username');
    }

    const user = this.userRepository.create({
      username: dto.username,
      email: dto.email,
      passwordHash: dto.password,
    });
    await this.userRepository.save(user);

    const token = this.createAccessToken(user);
    const refreshToken = await this.issueRefreshToken(user.id);

    this.logger.log(`User registered: ${user.id}`);
    return { token, refreshToken, user: user.toSafeJSON() };
  }

  async login(dto: LoginDto): Promise<{
    token: string;
    refreshToken: string;
    user: Record<string, unknown>;
  }> {
    const user = await this.userRepository.findOne({ where: { email: dto.email } });
    if (!user || !(await user.comparePassword(dto.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    const token = this.createAccessToken(user);
    const refreshToken = await this.issueRefreshToken(user.id);

    this.logger.log(`User logged in: ${user.id}`);
    return { token, refreshToken, user: user.toSafeJSON() };
  }

  async getMe(userId: string): Promise<Record<string, unknown>> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return user.toSafeJSON();
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (!(await user.comparePassword(dto.currentPassword))) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('New password must be different from the current password');
    }

    user.setPassword(dto.newPassword);
    await this.userRepository.save(user);

    await this.refreshTokenRepository.update(
      { userId: user.id, revoked: false },
      { revoked: true },
    );

    this.logger.log(`Password changed, refresh tokens revoked: ${user.id}`);
  }

  async refreshAccessToken(refreshTokenValue: string): Promise<{
    token: string;
    refreshToken: string;
  }> {
    const stored = await this.refreshTokenRepository.findOne({
      where: { token: refreshTokenValue },
    });

    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    stored.revoked = true;
    await this.refreshTokenRepository.save(stored);

    const user = await this.userRepository.findOne({ where: { id: stored.userId } });
    if (!user) throw new NotFoundException('User not found');

    const newAccessToken = this.createAccessToken(user);
    const newRefreshToken = await this.issueRefreshToken(user.id);

    this.logger.log(`Access token refreshed: ${user.id}`);
    return { token: newAccessToken, refreshToken: newRefreshToken };
  }

  async logout(userId: string, refreshTokenValue?: string): Promise<void> {
    if (refreshTokenValue) {
      await this.refreshTokenRepository.update(
        { token: refreshTokenValue, userId },
        { revoked: true },
      );
    }
    this.logger.log(`User logged out: ${userId}`);
  }

  private createAccessToken(user: User): string {
    const secret = this.configService.get<string>('jwt.secret', 'your-secret-key');
    const expiry = this.configService.get<string>('jwt.expiry', '24h');
    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      userId: user.id,
      email: user.email,
      username: user.username,
    };
    return jwt.sign(payload, secret, { expiresIn: expiry as jwt.SignOptions['expiresIn'] });
  }

  private async issueRefreshToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(48).toString('hex');
    const refreshToken = this.refreshTokenRepository.create({
      userId,
      token,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
    });
    await this.refreshTokenRepository.save(refreshToken);
    return token;
  }
}
