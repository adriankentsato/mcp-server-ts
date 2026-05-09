import { randomBytes } from 'crypto';

interface AuthCode {
  code: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  redirectUri: string;
  clientId: string;
  expiresAt: number;
}

interface AccessToken {
  token: string;
  clientId: string;
  expiresAt: number;
}

interface Client {
  clientId: string;
  clientSecret: string;
  redirectUris: string[];
}

class AuthStore {
  private authCodes: Map<string, AuthCode> = new Map();
  private accessTokens: Map<string, AccessToken> = new Map();
  private clients: Map<string, Client> = new Map();

  private generateRandomString(length: number): string {
    return randomBytes(length).toString('base64url').slice(0, length);
  }

  createAuthCode(codeChallenge: string, codeChallengeMethod: string, redirectUri: string, clientId: string): string {
    const code = this.generateRandomString(32);
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    this.authCodes.set(code, { code, codeChallenge, codeChallengeMethod, redirectUri, clientId, expiresAt });
    return code;
  }

  consumeAuthCode(code: string): AuthCode | null {
    const authCode = this.authCodes.get(code);
    if (!authCode) {
      return null;
    }
    if (Date.now() > authCode.expiresAt) {
      this.authCodes.delete(code);
      return null;
    }
    this.authCodes.delete(code);
    return authCode;
  }

  createAccessToken(clientId: string): string {
    const token = this.generateRandomString(32);
    const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour
    this.accessTokens.set(token, { token, clientId, expiresAt });
    return token;
  }

  validateAccessToken(token: string): AccessToken | null {
    const accessToken = this.accessTokens.get(token);
    if (!accessToken) {
      return null;
    }
    if (Date.now() > accessToken.expiresAt) {
      this.accessTokens.delete(token);
      return null;
    }
    return accessToken;
  }

  registerClient(redirectUris: string[]): Client {
    const clientId = this.generateRandomString(16);
    const clientSecret = this.generateRandomString(32);
    const client: Client = { clientId, clientSecret, redirectUris };
    this.clients.set(clientId, client);
    return client;
  }

  getClient(clientId: string): Client | null {
    return this.clients.get(clientId) || null;
  }

  cleanupExpired(): void {
    const now = Date.now();
    for (const [code, authCode] of this.authCodes.entries()) {
      if (now > authCode.expiresAt) {
        this.authCodes.delete(code);
      }
    }
    for (const [token, accessToken] of this.accessTokens.entries()) {
      if (now > accessToken.expiresAt) {
        this.accessTokens.delete(token);
      }
    }
  }
}

export const authStore = new AuthStore();
