import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@savote/shared-types';
import { normalizeSub } from '../utils/auth-utils';
import { OidcService } from '../auth/oidc.service';

@Injectable()
export class AdminsService {
  constructor(
    private prisma: PrismaService,
    private oidcService: OidcService,
  ) {}

  async create(data: { synologySub: string; name: string; role: UserRole }) {
    // Normalize sub (e.g. "NCUESA\S123" -> "S123")
    const synologySub = normalizeSub(data.synologySub);

    // Matched case-insensitively: Keycloak lowercases usernames, so
    // "M1154007" and "m1154007" must not become two competing grants.
    const existing = await this.prisma.adminPermission.findFirst({
      where: { synologySub: { equals: synologySub, mode: 'insensitive' } },
    });

    if (existing) {
      throw new ConflictException('Admin with this account ID already exists');
    }

    return this.prisma.adminPermission.create({
      data: {
        synologySub,
        name: data.name,
        role: data.role as any,
      },
    });
  }

  async findAll() {
    return this.prisma.adminPermission.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateRole(id: string, role: UserRole) {
    const permission = await this.prisma.adminPermission.findUnique({
      where: { id },
    });

    if (!permission) throw new NotFoundException('Permission record not found');

    // Update permission table
    const updated = await this.prisma.adminPermission.update({
      where: { id },
      data: { role: role as any },
    });

    // Sync to User table if they have logged in before
    await this.prisma.user.updateMany({
      where: { synologySub: permission.synologySub },
      data: { role: role as any },
    });

    return updated;
  }

  async remove(id: string) {
    const permission = await this.prisma.adminPermission.findUnique({
      where: { id },
    });

    if (!permission) throw new NotFoundException('Permission record not found');

    // Remove from permission table
    await this.prisma.adminPermission.delete({ where: { id } });

    // Sync to User table: Demote to USER
    await this.prisma.user.updateMany({
      where: { synologySub: permission.synologySub },
      data: { role: UserRole.USER as any },
    });

    return { success: true };
  }

  async getOidcSettings() {
    const keys = [
      'VOTER_OIDC_ISSUER',
      'VOTER_OIDC_CLIENT_ID',
      'VOTER_OIDC_CLIENT_SECRET',
      'ADMIN_OIDC_ISSUER',
      'ADMIN_OIDC_CLIENT_ID',
      'ADMIN_OIDC_CLIENT_SECRET',
      'ADMIN_OIDC_USERNAME_CLAIM',
    ];

    const settings: Record<string, string> = {};
    for (const key of keys) {
      const dbVal = await this.prisma.systemConfig.findUnique({
        where: { key },
      });
      if (dbVal && dbVal.value) {
        if (key.includes('SECRET')) {
          settings[key] = '********';
        } else {
          settings[key] = dbVal.value;
        }
      } else {
        settings[key] = '';
      }
    }
    return settings;
  }

  async updateOidcSettings(settings: Record<string, string>) {
    const validKeys = [
      'VOTER_OIDC_ISSUER',
      'VOTER_OIDC_CLIENT_ID',
      'VOTER_OIDC_CLIENT_SECRET',
      'ADMIN_OIDC_ISSUER',
      'ADMIN_OIDC_CLIENT_ID',
      'ADMIN_OIDC_CLIENT_SECRET',
      'ADMIN_OIDC_USERNAME_CLAIM',
    ];

    for (const key of validKeys) {
      const value = settings[key];
      if (value === undefined || value === null) continue;

      if (key.includes('SECRET') && value === '********') {
        continue; // Skip unchanged masked secret
      }

      if (value.trim() === '') {
        try {
          await this.prisma.systemConfig.delete({ where: { key } });
        } catch (e) {
          // Ignore if record doesn't exist
        }
      } else {
        await this.prisma.systemConfig.upsert({
          where: { key },
          update: { value: value.trim() },
          create: { key, value: value.trim() },
        });
      }
    }

    // Reload OIDC clients with new settings
    await this.oidcService.reloadClients();

    return { success: true };
  }
}
