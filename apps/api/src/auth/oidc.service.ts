import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Issuer, Client, TokenSet, UserinfoResponse } from 'openid-client';
import { PrismaService } from '../prisma/prisma.service';

export enum OidcType {
  VOTER = 'voter',
  ADMIN = 'admin',
}

@Injectable()
export class OidcService implements OnModuleInit {
  private voterClient: Client;
  private adminClient: Client;
  private readonly logger = new Logger(OidcService.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async onModuleInit() {
    await this.initClient(OidcType.VOTER);
    await this.initClient(OidcType.ADMIN);
  }

  async getConfigValue(key: string): Promise<string> {
    try {
      const dbConfig = await this.prisma.systemConfig.findUnique({
        where: { key },
      });
      if (dbConfig && dbConfig.value !== undefined && dbConfig.value !== null) {
        return dbConfig.value;
      }
    } catch (error) {
      // Table might not exist yet during initial boot/migration
      this.logger.debug(`Could not fetch ${key} from DB, falling back to .env`);
    }
    return this.configService.get<string>(key) || '';
  }

  /**
   * Claim that carries the admin's account identifier.
   *
   * Keycloak's `sub` is an opaque UUID, so admin authorization is matched on
   * `preferred_username` by default. Override per-deployment when the realm
   * exposes the student ID under a different claim.
   */
  async getAdminUsernameClaim(): Promise<string> {
    const claim = await this.getConfigValue('ADMIN_OIDC_USERNAME_CLAIM');
    return claim?.trim() || 'preferred_username';
  }

  private getCallbackUrl(type: OidcType): string {
    const origin = process.env.CORS_ORIGIN || 'https://sa-election.ncue.edu.tw';
    return type === OidcType.VOTER 
      ? `${origin}/api/auth/callback` 
      : `${origin}/api/auth/admin/callback`;
  }

  async initClient(type: OidcType) {
    try {
      const prefix = type === OidcType.VOTER ? 'VOTER_OIDC' : 'ADMIN_OIDC';

      const issuerUrl = await this.getConfigValue(`${prefix}_ISSUER`);
      const clientId = await this.getConfigValue(`${prefix}_CLIENT_ID`);
      const clientSecret = await this.getConfigValue(`${prefix}_CLIENT_SECRET`);
      const callbackUrl = this.getCallbackUrl(type);

      if (!issuerUrl) {
        this.logger.warn(
          `${prefix}_ISSUER not set, ${type} OIDC will not work`,
        );
        return;
      }

      const issuer = await Issuer.discover(issuerUrl);
      const client = new issuer.Client({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uris: [callbackUrl],
        response_types: ['code'],
      });

      if (type === OidcType.VOTER) this.voterClient = client;
      else this.adminClient = client;

      this.logger.log(`Initialized ${type} OIDC client for ${issuer.issuer}`);
    } catch (error) {
      this.logger.error(
        `Failed to initialize ${type} OIDC client: ${error.message}`,
      );
    }
  }

  async reloadClients() {
    this.logger.log('Reloading OIDC clients with latest config...');
    await this.initClient(OidcType.VOTER);
    await this.initClient(OidcType.ADMIN);
  }

  getAuthorizationUrl(
    type: OidcType,
    code_challenge: string,
    state: string,
  ): string {
    const client =
      type === OidcType.VOTER ? this.voterClient : this.adminClient;
    if (!client) throw new Error(`${type} OIDC client not initialized`);

    return client.authorizationUrl({
      scope: 'openid profile email',
      code_challenge,
      code_challenge_method: 'S256',
      state,
    });
  }

  async exchangeCode(
    type: OidcType,
    req: any,
    code_verifier: string,
    state: string,
  ): Promise<{ tokenSet: TokenSet; userinfo: UserinfoResponse }> {
    const client =
      type === OidcType.VOTER ? this.voterClient : this.adminClient;
    if (!client) throw new Error(`${type} OIDC client not initialized`);

    const callbackUrl = this.getCallbackUrl(type);

    const params = client.callbackParams(req);
    const tokenSet = await client.callback(callbackUrl, params, {
      code_verifier,
      state,
    });

    if (!tokenSet.access_token) {
      throw new Error(`No access token received from ${type} OIDC provider`);
    }

    const userinfo = await client.userinfo(tokenSet.access_token);
    return { tokenSet, userinfo };
  }
}
