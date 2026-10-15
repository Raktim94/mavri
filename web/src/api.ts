// Client for the Mavri server. Success returns the JSON body; a failure is an
// ApiError carrying the server's code, message and, for e-invoices, problems.
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public problems: string[] = []
  ) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = undefined;
  }
  if (!res.ok) {
    const e = (data as { error?: { code?: string; message?: string; problems?: string[] } } | undefined)?.error;
    throw new ApiError(res.status, e?.code ?? 'error', e?.message ?? `The server answered ${res.status}.`, e?.problems);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => call<T>('GET', path),
  post: <T>(path: string, body: unknown = {}) => call<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => call<T>('PUT', path, body),
  del: (path: string) => call<void>('DELETE', path)
};

/** Download a response body as a file, or throw the server's ApiError. */
export async function download(path: string, fallbackName: string): Promise<void> {
  const res = await fetch(path, { credentials: 'same-origin' });
  if (!res.ok) {
    let e: { error?: { code?: string; message?: string; problems?: string[] } } = {};
    try {
      e = await res.json();
    } catch {
      /* not JSON */
    }
    throw new ApiError(
      res.status,
      e.error?.code ?? 'error',
      e.error?.message ?? `The server answered ${res.status}.`,
      e.error?.problems
    );
  }
  const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? fallbackName;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(await res.blob());
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export const errorText = (e: unknown, fallback = 'Something went wrong.') =>
  e instanceof ApiError ? e.message : fallback;
