import { validateIpOrCidr, ipMatches, normalizeIp } from '../services/ipMatcher';

describe('validateIpOrCidr', () => {
  it('accepte les IPv4 simples', () => {
    expect(validateIpOrCidr('192.168.1.1').valid).toBe(true);
    expect(validateIpOrCidr('10.0.0.0').valid).toBe(true);
  });
  it('accepte les IPv4/CIDR', () => {
    const r = validateIpOrCidr('192.168.1.0/24');
    expect(r.valid).toBe(true);
    expect(r.isCidr).toBe(true);
    expect(r.family).toBe(4);
  });
  it('accepte les IPv6 simples', () => {
    expect(validateIpOrCidr('2001:db8::1').valid).toBe(true);
    expect(validateIpOrCidr('::1').valid).toBe(true);
  });
  it('accepte les IPv6/CIDR', () => {
    const r = validateIpOrCidr('2001:db8::/32');
    expect(r.valid).toBe(true);
    expect(r.isCidr).toBe(true);
    expect(r.family).toBe(6);
  });
  it('refuse les inputs vides ou mal formés', () => {
    expect(validateIpOrCidr('').valid).toBe(false);
    expect(validateIpOrCidr('hello').valid).toBe(false);
    expect(validateIpOrCidr('192.168.1.999').valid).toBe(false);
  });
  it('refuse les prefixes hors-bornes', () => {
    expect(validateIpOrCidr('192.168.1.0/33').valid).toBe(false);
    expect(validateIpOrCidr('2001:db8::/129').valid).toBe(false);
    expect(validateIpOrCidr('192.168.1.0/-1').valid).toBe(false);
  });
  it('normalise (trim + lowercase)', () => {
    expect(validateIpOrCidr('  2001:DB8::1 ').normalized).toBe('2001:db8::1');
  });
});

describe('ipMatches', () => {
  it('IP simple = IP simple (exact)', () => {
    expect(ipMatches('192.168.1.1', '192.168.1.1')).toBe(true);
    expect(ipMatches('192.168.1.1', '192.168.1.2')).toBe(false);
  });
  it('IP dans CIDR IPv4', () => {
    expect(ipMatches('192.168.1.42', '192.168.1.0/24')).toBe(true);
    expect(ipMatches('192.168.2.42', '192.168.1.0/24')).toBe(false);
  });
  it('IP dans CIDR IPv6', () => {
    expect(ipMatches('2001:db8::abcd', '2001:db8::/32')).toBe(true);
    expect(ipMatches('2001:db9::1',    '2001:db8::/32')).toBe(false);
  });
  it('IPv4-mappé-en-IPv6 matche son équivalent IPv4', () => {
    expect(ipMatches('::ffff:192.168.1.1', '192.168.1.1')).toBe(true);
    expect(ipMatches('::ffff:192.168.1.1', '192.168.1.0/24')).toBe(true);
  });
  it('CIDR /32 = exact match', () => {
    expect(ipMatches('10.0.0.5', '10.0.0.5/32')).toBe(true);
    expect(ipMatches('10.0.0.6', '10.0.0.5/32')).toBe(false);
  });
  it('CIDR /0 matche tout (IPv4)', () => {
    expect(ipMatches('192.168.1.1', '0.0.0.0/0')).toBe(true);
  });
  it("retourne false si l'IP ou la règle est invalide", () => {
    expect(ipMatches('not-an-ip', '192.168.1.0/24')).toBe(false);
    expect(ipMatches('192.168.1.1', 'invalid-rule')).toBe(false);
  });
});

describe('normalizeIp', () => {
  it('compresse les IPv6', () => {
    expect(normalizeIp('2001:0db8:0000:0000:0000:0000:0000:0001')).toBe('2001:db8::1');
  });
  it('passe IPv4 inchangée', () => {
    expect(normalizeIp('192.168.1.1')).toBe('192.168.1.1');
  });
  it('retourne null pour invalide', () => {
    expect(normalizeIp('not-ip')).toBeNull();
  });
});
