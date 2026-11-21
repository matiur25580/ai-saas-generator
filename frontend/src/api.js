const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || (import.meta.env.DEV ? 'http://localhost:5000' : '');
let refreshPromise;
let accessToken = null;
let csrfToken = null;

export function setAccessToken(token) {
  accessToken = typeof token === 'string' && token ? token : null;
}

export function setCsrfToken(token) {
  csrfToken = typeof token === 'string' && token ? token : null;
}

export function clearAccessToken() {
  accessToken = null;
  csrfToken = null;
}

export async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const csrfResponse = await fetch(`${BACKEND_URL}/api/auth/csrf`, {
        credentials: 'include'
      });
      const csrfData = await csrfResponse.json().catch(() => ({}));
      if (!csrfResponse.ok || !csrfData.csrfToken) {
        clearAccessToken();
        return null;
      }
      setCsrfToken(csrfData.csrfToken);

      const response = await fetch(`${BACKEND_URL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': csrfToken }
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        clearAccessToken();
        return null;
      }
      if (!response.ok) throw new Error(data.error || 'Could not verify the current session.');
      if (!data.success || !data.token || !data.user?.email) {
        throw new Error('The server returned an invalid session response.');
      }
      setAccessToken(data.token);
      if (data.csrfToken) setCsrfToken(data.csrfToken);
      return data.user;
    })().finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

export async function apiFetch(path, options = {}) {
  const send = (token) => fetch(`${BACKEND_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(csrfToken && !['GET', 'HEAD', 'OPTIONS'].includes(String(options.method || 'GET').toUpperCase())
        ? { 'X-CSRF-Token': csrfToken } : {})
    }
  });

  const response = await send(accessToken);
  if (response.status !== 401) return response;
  const session = await refreshSession();
  return session ? send(accessToken) : response;
}
