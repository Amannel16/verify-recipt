import crypto from 'crypto';

export function generateRandomFileName(): string {
  const randomBytes = crypto.randomBytes(32);
  const randomFileName = randomBytes.toString('hex');
  return randomFileName;
}
