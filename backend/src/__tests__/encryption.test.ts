import { encrypt, decrypt } from '../utils/encryption';

describe('encryption', () => {
  beforeAll(() => {
    process.env.SIGNATURE_PROVIDER_ENCRYPTION_KEY = '0'.repeat(64);
  });

  it('chiffre puis déchiffre une chaîne', () => {
    const plain = '{"apiKey":"sk_test_abc"}';
    const cipher = encrypt(plain);
    expect(cipher).not.toEqual(plain);
    expect(decrypt(cipher)).toEqual(plain);
  });

  it('produit un chiffré différent à chaque appel (IV aléatoire)', () => {
    expect(encrypt('hello')).not.toEqual(encrypt('hello'));
  });

  it('rejette un chiffré altéré', () => {
    const c = encrypt('hello');
    const tampered = c.slice(0, -2) + 'XX';
    expect(() => decrypt(tampered)).toThrow();
  });
});
