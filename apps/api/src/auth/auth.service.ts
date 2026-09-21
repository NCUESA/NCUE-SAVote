import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import {
  LoginResponse,
  JWTPayload,
  EnrollmentStatus,
  RefreshTokenResponse,
  UserRole,
} from '@savote/shared-types';
import { UserinfoResponse } from 'openid-client';
import { resolveAdminSubject } from '../utils/auth-utils';
import { OidcService } from './oidc.service';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private privateKey: string;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private oidcService: OidcService,
  ) {
    const privateKeyPath = path.resolve(
      process.cwd(),
      this.configService.get<string>('JWT_PRIVATE_KEY_PATH') || './secrets/jwt-private.key',
    );
    this.privateKey = fs.readFileSync(privateKeyPath, 'utf8');
  }

  /**
   * Process Voter OIDC login
   */
  async handleVoterLogin(
    userinfo: UserinfoResponse,
    ipAddress: string,
    userAgent: string,
  ): Promise<LoginResponse> {
    const rawStudentId = userinfo.nickname || userinfo.preferred_username || userinfo.sub;
    if (!rawStudentId) {
      throw new UnauthorizedException('Student ID not found in OIDC info');
    }

    const cleanStudentId = rawStudentId.replace('NCUESA\\', '').trim();

    const studentIdHash = crypto.createHash('sha256').update(cleanStudentId).digest('hex');

    const userClass = (userinfo['class'] || userinfo['ou'] || 'UNKNOWN') as string;
    const email = userinfo.email || null;
    const familyName = (userinfo.family_name as string) || '';
    const givenName = (userinfo.given_name as string) || '';
    const name = `${familyName}${givenName}`.trim() || userinfo.name || userinfo.preferred_username || null;

    const user = await this.prisma.user.upsert({
      where: { studentIdHash },
      update: {
        class: userClass,
        email: email || undefined,
        name: name || undefined
      },
      create: {
        studentIdHash,
        synologySub: cleanStudentId,
        class: userClass,
        email,
        name,
        role: UserRole.USER,
      },
    });

    // 判斷是否為新用戶 (看建立跟更新時間是否一致)
    const isNewUser = user.createdAt.getTime() === user.updatedAt.getTime();

    const tokens = await this.generateTokens(user, ipAddress, userAgent);

    return {
      ...tokens,
      isNewUser,
      user: this.mapToUserProfile(user, ipAddress),
    };
  }

  /**
   * Process Admin OIDC login (Keycloak)
   */
  async handleAdminOIDCLogin(
    userinfo: UserinfoResponse,
    ipAddress: string,
    userAgent: string,
  ): Promise<LoginResponse> {
    const usernameClaim = await this.oidcService.getAdminUsernameClaim();
    const claimedSub = resolveAdminSubject(userinfo, usernameClaim);

    if (!claimedSub) {
      throw new UnauthorizedException(
        `Admin identifier not found in OIDC claims (expected "${usernameClaim}")`,
      );
    }

    // 1. Check local permission table.
    //    Keycloak lowercases usernames by default, so the stored identifier is
    //    matched case-insensitively to keep existing grants valid.
    const permission = await this.findAdminPermission(claimedSub);

    if (!permission) {
      this.logger.warn(
        `Unauthorized admin login attempt for ${usernameClaim}: ${claimedSub} (sub: ${userinfo.sub})`,
      );
      throw new UnauthorizedException('You do not have administrative access to this system.');
    }

    // 2. Sync with User table.
    //    The permission record is the canonical spelling: deriving the hash from
    //    it keeps one User row per admin regardless of how the IdP cases the claim.
    const synologySub = permission.synologySub;
    const studentIdHash = crypto.createHash('sha256').update(synologySub).digest('hex');

    //const userClass = (userinfo['class'] || userinfo['ou'] || 'UNKNOWN') as string;

    const admin = await this.prisma.user.upsert({
      where: { studentIdHash },
      update: {
        role: permission.role,
        name: permission.name || userinfo.name || undefined,
        lastLoginIp: ipAddress,
      },
      create: {
        studentIdHash: studentIdHash,
        synologySub,
        name: permission.name || userinfo.name || 'Admin',
        email: userinfo.email || null,
        role: permission.role,
      },
    });

    // 3. Log admin login
    await this.prisma.adminLoginLog.create({
      data: { userId: admin.id, ipAddress },
    });

    const isNewUser = admin.createdAt.getTime() === admin.updatedAt.getTime();
    const tokens = await this.generateTokens(admin, ipAddress, userAgent);

    return {
      ...tokens,
      isNewUser,
      user: this.mapToUserProfile(admin, ipAddress),
    };
  }

  /**
   * Looks up an admin grant, falling back to a case-insensitive match so that an
   * IdP which normalizes usernames (Keycloak lowercases them by default) still
   * resolves to a permission entered as e.g. "M1154007".
   */
  private async findAdminPermission(sub: string) {
    const exact = await this.prisma.adminPermission.findUnique({
      where: { synologySub: sub },
    });
    if (exact) return exact;

    return this.prisma.adminPermission.findFirst({
      where: { synologySub: { equals: sub, mode: 'insensitive' } },
    });
  }

  private mapToUserProfile(user: any, ip: string) {
    return {
      id: user.id,
      studentIdHash: user.studentIdHash,
      class: user.class,
      email: user.email,
      name: user.name,
      ip: ip,
      enrollmentStatus: user.enrollmentStatus as EnrollmentStatus,
      role: user.role as UserRole,
    };
  }

  async refreshTokens(refreshToken: string, ipAddress: string): Promise<RefreshTokenResponse> {
    try {
      const payload = this.jwtService.verify<JWTPayload>(refreshToken, {
        secret: this.privateKey,
        algorithms: ['RS256'],
      });

      const session = await this.prisma.session.findUnique({
        where: { jti: payload.jti },
        include: { user: true },
      });

      if (!session || session.revoked || session.expiresAt < new Date() || session.refreshToken !== refreshToken) {
        throw new UnauthorizedException('Invalid or expired session');
      }

      const newJti = crypto.randomUUID();
      const accessToken = await this.signToken(session.user, newJti, 'access', '15m');
      const newRefreshToken = await this.signToken(session.user, newJti, 'refresh', '7d');

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await this.prisma.session.update({
        where: { jti: session.jti },
        data: {
          jti: newJti,
          accessToken,
          refreshToken: newRefreshToken,
          expiresAt,
          lastActivityAt: new Date(),
          ipAddress,
        },
      });

      return { accessToken, refreshToken: newRefreshToken };
    } catch (error) {
      throw new UnauthorizedException('Refresh failed');
    }
  }

  async revokeSession(jti: string): Promise<void> {
    await this.prisma.session.update({
      where: { jti },
      data: { revoked: true, revokedAt: new Date() },
    });
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true, revokedAt: new Date() },
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredSessions() {
    await this.prisma.session.deleteMany({
      where: { OR: [{ expiresAt: { lt: new Date() } }, { revoked: true }] },
    });
  }

  private async generateTokens(user: any, ipAddress: string, deviceInfo: string) {
    const jti = crypto.randomUUID();
    const accessToken = await this.signToken(user, jti, 'access', '15m');
    const refreshToken = await this.signToken(user, jti, 'refresh', '7d');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.session.create({
      data: { userId: user.id, jti, accessToken, refreshToken, expiresAt, deviceInfo, ipAddress },
    });

    return { accessToken, refreshToken };
  }

  private async signToken(user: any, jti: string, type: 'access' | 'refresh', expiresIn: string) {
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      sub: user.id,
      jti,
      studentIdHash: user.studentIdHash,
      class: user.class,
      role: user.role as UserRole,
      type,
    };

    return this.jwtService.sign(payload, {
      privateKey: this.privateKey,
      algorithm: 'RS256',
      expiresIn,
    });
  }
}
