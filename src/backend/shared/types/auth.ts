export interface User {
  id: number;
  email: string;
  passwordHash: string;
  role: string;
  failedLoginCount: number;
  lockedUntil?: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicUser {
  id: number;
  email: string;
  role: string;
  lastLoginAt?: string | null;
  createdAt: string;
}

export interface ApiKey {
  id: number;
  name: string;
  keyPrefix: string;
  keyHash: string;
  createdByUserId?: number | null;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
}

export interface PublicApiKey {
  id: number;
  name: string;
  keyPrefix: string;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
}
