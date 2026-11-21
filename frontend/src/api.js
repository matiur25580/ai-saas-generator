const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || (import.meta.env.DEV ? 'http://localhost:5000' : '');
let refreshPromise;
let accessToken = null;

export function setAccessToken(token) {
  accessToken = typeof token === 'string' && token ? token : null;
}

export function clearAccessToken() {
  accessToken = null;
}

export async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetch(`${BACKEND_URL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include'
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
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });

  const response = await send(accessToken);
  if (response.status !== 401) return response;
  const session = await refreshSession();
  return session ? send(accessToken) : response;
}
