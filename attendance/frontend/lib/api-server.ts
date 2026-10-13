import "server-only";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export class ServerApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ServerApiError";
  }
  get isUnauthenticated() {
    return this.status === 401 || this.code === "UNAUTHENTICATED";
  }
}

async function serverFetch<T>(
  path: string,
  cookieHeader: string,
  init: RequestInit = {},
): Promise<T> {
  const url = `${BACKEND_URL}/api/v1${path}`;

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.headers ?? {}),
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      cache: "no-store",
    });
  } catch {
    throw new ServerApiError(
      0,
      "NETWORK_ERROR",
      `Backend unreachable at ${BACKEND_URL}. Is uvicorn running?`,
    );
  }

  if (res.status === 204) return undefined as T;

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    /* non-JSON body */
  }

  if (!res.ok) {
    const body = (payload ?? {}) as { error?: { code?: string; message?: string } };
    throw new ServerApiError(
      res.status,
      body.error?.code ?? "INTERNAL_ERROR",
      body.error?.message ?? `Request failed (${res.status})`,
    );
  }

  return payload as T;
}

export interface ServerUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "teacher";
}

export async function serverFetchMe(cookieHeader: string): Promise<ServerUser> {
  return serverFetch<ServerUser>("/auth/me", cookieHeader);
}