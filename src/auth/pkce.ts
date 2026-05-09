import { createHash } from 'crypto';

export function verifyCodeVerifier(codeVerifier: string, codeChallenge: string, method: string): boolean {
  if (method === 'plain') {
    return codeVerifier === codeChallenge;
  }

  if (method === 'S256') {
    const hash = createHash('sha256').update(codeVerifier).digest('base64url');
    return hash === codeChallenge;
  }

  return false;
}
