import crypto from 'crypto';

const ALG = 'aes-256-gcm';
const IV_LEN = 12;

function getKey(): Buffer {
  const hex = process.env.SIGNATURE_PROVIDER_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('SIGNATURE_PROVIDER_ENCRYPTION_KEY manquant ou invalide (32 bytes hex requis)');
  }
  return Buffer.from(hex, 'hex');
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALG, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decrypt(payload: string): string {
  const [ivB64, tagB64, encB64] = payload.split(':');
  if (!ivB64 || !tagB64 || !encB64) throw new Error('Format de chiffré invalide');
  const decipher = crypto.createDecipheriv(ALG, getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const dec = Buffer.concat([decipher.update(Buffer.from(encB64, 'base64')), decipher.final()]);
  return dec.toString('utf8');
}
