const baseValue = process.env.STAGING_API_BASE_URL;
const email = process.env.STAGING_TEST_EMAIL;
const password = process.env.STAGING_TEST_PASSWORD;

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function requireEnv(name, value) {
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
}

function cookieFrom(response, fallbackCsrfToken) {
  const setCookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);
  const refreshCookie = setCookies.find((value) => value.split(';', 1)[0].startsWith('refreshToken='));
  const csrfCookie = setCookies.find((value) => value.split(';', 1)[0].startsWith('csrfToken='));
  if (!refreshCookie || (!csrfCookie && !fallbackCsrfToken)) throw new Error('Expected refreshToken and CSRF cookie state.');

  const validateCookie = (raw, name, requiredHttpOnly) => {
    const [nameValue, ...attributes] = raw.split(';').map((part) => part.trim());
    if (!nameValue.startsWith(name + '=') || nameValue === name + '=') {
      throw new Error(`Expected a non-empty ${name} cookie.`);
    }
    const flags = new Map(attributes.map((attribute) => {
      const separator = attribute.indexOf('=');
      return separator === -1
        ? [attribute.toLowerCase(), true]
        : [attribute.slice(0, separator).toLowerCase(), attribute.slice(separator + 1)];
    }));
    for (const flag of ['secure', 'samesite', 'path']) {
      if (!flags.has(flag)) throw new Error(`${name} cookie is missing ${flag}.`);
    }
    if (requiredHttpOnly && !flags.has('httponly')) throw new Error('Refresh cookie must be HttpOnly.');
    if (!requiredHttpOnly && flags.has('httponly')) throw new Error('CSRF cookie must be readable by the browser client.');
    if (String(flags.get('samesite')).toLowerCase() !== 'none') throw new Error(`${name} cookie must use SameSite=None in staging.`);
    if (flags.get('path') !== '/api/auth') throw new Error(`${name} cookie must be scoped to /api/auth.`);
    return nameValue;
  };

  const refreshPair = validateCookie(refreshCookie, 'refreshToken', true);
  const csrfPair = csrfCookie
    ? validateCookie(csrfCookie, 'csrfToken', false)
    : 'csrfToken=' + fallbackCsrfToken;
  return {
    cookie: refreshPair + '; ' + csrfPair,
    csrfToken: csrfPair.slice('csrfToken='.length)
  };
}
async function request(path, { method = 'GET', body, cookie, csrfToken } = {}) {
  const response = await fetch(new URL(path, baseUrl), {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
      ...(csrfToken ? { 'x-csrf-token': csrfToken } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15_000),
    redirect: 'error'
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`${method} ${path} returned a non-JSON response (HTTP ${response.status}).`);
  }
  return { response, data };
}

requireEnv('STAGING_API_BASE_URL', baseValue);
requireEnv('STAGING_TEST_EMAIL', email);
requireEnv('STAGING_TEST_PASSWORD', password);

const baseUrl = new URL(baseValue);
if (baseUrl.protocol !== 'https:') {
  throw new Error('STAGING_API_BASE_URL must use HTTPS.');
}
if (baseUrl.username || baseUrl.password) {
  throw new Error('STAGING_API_BASE_URL must not contain embedded credentials.');
}
if (baseUrl.hostname === 'ai-saas-generator-d3g8.onrender.com') {
  throw new Error('Refusing to run authentication smoke tests against the production API.');
}
baseUrl.pathname = baseUrl.pathname.endsWith('/') ? baseUrl.pathname : `${baseUrl.pathname}/`;
baseUrl.search = '';
baseUrl.hash = '';

try {
  const health = await request('/api/health');
  if (health.response.status !== 200 || health.data?.success !== true || health.data?.data?.status !== 'healthy') {
    throw new Error(`Health check failed (HTTP ${health.response.status}).`);
  }
  console.log('PASS: staging API health check');

  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password }
  });
  if (login.response.status !== 200 || login.data?.success !== true || !(login.data?.data?.token || login.data?.token)) {
    throw new Error(`Login failed (HTTP ${login.response.status}). Check the staging test account.`);
  }
  let sessionCookies = cookieFrom(login.response);
  let csrfToken = login.data?.csrfToken || login.data?.data?.csrfToken || sessionCookies.csrfToken;
  if (!csrfToken) throw new Error('Login did not return a CSRF token.');
  console.log('PASS: login, HttpOnly refresh cookie, and CSRF cookie');

  const refresh = await request('/api/auth/refresh', {
    method: 'POST',
    cookie: sessionCookies.cookie,
    csrfToken
  });
  if (refresh.response.status !== 200 || refresh.data?.success !== true || !(refresh.data?.data?.token || refresh.data?.token)) {
    throw new Error(`Refresh-token rotation failed (HTTP ${refresh.response.status}).`);
  }
  const rotatedCookies = cookieFrom(refresh.response, csrfToken);
  const rotatedCookie = rotatedCookies.cookie;
  csrfToken = refresh.data?.csrfToken || refresh.data?.data?.csrfToken || rotatedCookies.csrfToken;
  if (rotatedCookie === sessionCookies.cookie) {
    throw new Error('Refresh endpoint returned the same refresh cookie instead of rotating it.');
  }
  console.log('PASS: refresh-token rotation');

  const logout = await request('/api/auth/logout', {
    method: 'POST',
    cookie: rotatedCookie,
    csrfToken
  });
  if (logout.response.status !== 200 || logout.data?.success !== true) {
    throw new Error(`Logout failed (HTTP ${logout.response.status}).`);
  }
  console.log('PASS: logout');

  const replay = await request('/api/auth/refresh', {
    method: 'POST',
    cookie: rotatedCookie,
    csrfToken
  });
  if (replay.response.status !== 401) {
    throw new Error(`Revoked refresh token was not rejected (HTTP ${replay.response.status}).`);
  }
  console.log('PASS: revoked refresh token rejected after logout');
  console.log('Staging authentication smoke test completed successfully.');
} catch (error) {
  fail(error.message || 'Unexpected staging smoke-test failure.');
}
