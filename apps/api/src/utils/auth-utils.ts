import type { UserinfoResponse } from 'openid-client';

/**
 * Normalizes the OIDC subject (UID) by removing the domain prefix if present.
 * Keycloak usernames federated from LDAP/AD may still carry the domain.
 * Example: "NCUESA\\S1354032" -> "S1354032"
 * Example: "NCUESA/S1354032" -> "S1354032"
 */
export function normalizeSub(sub: string): string {
  if (!sub) return sub;

  // Split by either \ or /
  const parts = sub.split(/[\\\/]/);
  return parts[parts.length - 1];
}

/**
 * Picks the claim that identifies an admin in the local AdminPermission table.
 *
 * Keycloak issues an opaque UUID as `sub`, so the account identifier admins are
 * actually granted permission by (their student ID / username) lives in
 * `preferred_username`. `sub` is kept as the last resort so providers that do
 * expose a meaningful subject keep working.
 */
export function resolveAdminSubject(
  userinfo: UserinfoResponse,
  preferredClaim?: string,
): string | null {
  const candidates = [
    preferredClaim,
    'preferred_username',
    'nickname',
    'sub',
  ].filter((claim): claim is string => !!claim);

  for (const claim of candidates) {
    const value = userinfo[claim];
    if (typeof value === 'string' && value.trim()) {
      return normalizeSub(value.trim());
    }
  }

  return null;
}
