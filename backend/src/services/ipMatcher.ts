/**
 * ipMatcher.ts
 *
 * Helpers purs pour validation et matching d'adresses IP et CIDR
 * (IPv4 + IPv6). S'appuie sur ipaddr.js. Aucune dépendance Prisma.
 */

import * as ipaddr from 'ipaddr.js';

export interface IpValidationResult {
  valid: boolean;
  normalized?: string;
  family?: 4 | 6;
  isCidr?: boolean;
}

/**
 * Valide une chaîne IP ou IP/CIDR. Retourne la valeur normalisée si valide.
 */
export function validateIpOrCidr(input: string): IpValidationResult {
  if (!input || typeof input !== 'string') return { valid: false };
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return { valid: false };

  if (trimmed.includes('/')) {
    try {
      const [addr, prefixStr] = trimmed.split('/');
      if (!prefixStr) return { valid: false };
      const prefix = Number(prefixStr);
      if (!Number.isInteger(prefix) || prefix < 0) return { valid: false };
      const parsed = ipaddr.parse(addr);
      const max = parsed.kind() === 'ipv4' ? 32 : 128;
      if (prefix > max) return { valid: false };
      return {
        valid: true,
        normalized: `${parsed.toString()}/${prefix}`,
        family: parsed.kind() === 'ipv4' ? 4 : 6,
        isCidr: true,
      };
    } catch {
      return { valid: false };
    }
  }

  try {
    const parsed = ipaddr.parse(trimmed);
    return {
      valid: true,
      normalized: parsed.toString(),
      family: parsed.kind() === 'ipv4' ? 4 : 6,
      isCidr: false,
    };
  } catch {
    return { valid: false };
  }
}

/**
 * Vérifie si une IP matche une règle (IP simple ou CIDR).
 * Retourne false si l'un ou l'autre est invalide.
 */
export function ipMatches(ip: string, rule: string): boolean {
  if (!ip || !rule) return false;
  try {
    const ipParsed = ipaddr.parse(ip.trim());
    const ruleStr = rule.trim();

    if (ruleStr.includes('/')) {
      const cidr = ipaddr.parseCIDR(ruleStr);
      if (cidr[0].kind() === 'ipv4' && ipParsed.kind() === 'ipv6') {
        const v6 = ipParsed as ipaddr.IPv6;
        if (v6.isIPv4MappedAddress()) {
          return v6.toIPv4Address().match(cidr as [ipaddr.IPv4, number]);
        }
        return false;
      }
      if (cidr[0].kind() === 'ipv6' && ipParsed.kind() === 'ipv4') {
        return false;
      }
      return ipParsed.match(cidr as any);
    }

    const ruleParsed = ipaddr.parse(ruleStr);
    if (ipParsed.kind() === ruleParsed.kind()) {
      return ipParsed.toString() === ruleParsed.toString();
    }
    if (ipParsed.kind() === 'ipv6' && ruleParsed.kind() === 'ipv4') {
      const v6 = ipParsed as ipaddr.IPv6;
      if (v6.isIPv4MappedAddress()) {
        return v6.toIPv4Address().toString() === (ruleParsed as ipaddr.IPv4).toString();
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Normalise une IP (compression IPv6, trim). Null si invalide.
 */
export function normalizeIp(input: string): string | null {
  try {
    const trimmed = input.trim();
    return ipaddr.parse(trimmed).toString();
  } catch {
    return null;
  }
}
