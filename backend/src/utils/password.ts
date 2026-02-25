import bcrypt from 'bcrypt';
import { randomInt, randomBytes } from 'crypto';

const SALT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

/**
 * Generate a random password
 * @param length - Length of the password (default: 12)
 * @returns A randomly generated password
 */
export function generateRandomPassword(length: number = 12): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*';

  const allChars = uppercase + lowercase + numbers + special;

  // Au moins un caractère de chaque catégorie (crypto-sûr)
  const chars: string[] = [
    uppercase[randomInt(uppercase.length)],
    lowercase[randomInt(lowercase.length)],
    numbers[randomInt(numbers.length)],
    special[randomInt(special.length)],
  ];

  for (let i = chars.length; i < length; i++) {
    chars.push(allChars[randomInt(allChars.length)]);
  }

  // Mélange Fisher-Yates crypto-sûr
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}

/**
 * Hash a password using bcrypt
 * @param password - Plain text password
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare a plain text password with a hashed password
 * @param password - Plain text password
 * @param hashedPassword - Hashed password from database
 * @returns True if passwords match, false otherwise
 */
export async function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

/**
 * Validate password strength
 * @param password - Password to validate
 * @returns Object with isValid flag and error message if invalid
 */
export function validatePasswordStrength(password: string): { isValid: boolean; error?: string } {
  if (password.length < 8) {
    return { isValid: false, error: 'Le mot de passe doit contenir au moins 8 caractères' };
  }

  if (!/[A-Z]/.test(password)) {
    return { isValid: false, error: 'Le mot de passe doit contenir au moins une lettre majuscule' };
  }

  if (!/[a-z]/.test(password)) {
    return { isValid: false, error: 'Le mot de passe doit contenir au moins une lettre minuscule' };
  }

  if (!/[0-9]/.test(password)) {
    return { isValid: false, error: 'Le mot de passe doit contenir au moins un chiffre' };
  }

  return { isValid: true };
}
