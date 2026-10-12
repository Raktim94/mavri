// Thin client for the Go API. Every endpoint answers {success, data, key, message}.
export type Row = Record<string, unknown> & { id?: number };

export class ApiError extends Error {
  constructor(
    public key: string,
    public status: number,
    message?: string
  ) {
    super(message || key);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let env: { success?: boolean; data?: T; key?: string; message?: string } = {};
  try {
    env = await res.json();
  } catch {
    /* non-JSON answer */
  }
  if (!res.ok || env.success === false) throw new ApiError(env.key ?? 'error.unknown', res.status, env.message);
  return env.data as T;
}

export const api = {
  get: <T>(path: string) => call<T>('GET', path),
  post: <T>(path: string, body?: unknown) => call<T>('POST', path, body ?? {}),
  put: <T>(path: string, body: unknown) => call<T>('PUT', path, body),
  del: <T>(path: string) => call<T>('DELETE', path)
};

export type User = { id: number; email: string; role: string; lastLoginAt: string | null };
