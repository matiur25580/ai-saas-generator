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

function cookieFrom(response) {
  const setCookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);
  const refreshCookie = setCookies
    .map((value) => value.split(';', 1)[0])
    .find((value) => value.startsWith('refreshToken='));
  if (!refreshCookie || refreshCookie === 'refreshToken=') {
    throw new Error('Expected a non-empty refreshToken cookie.');
  }
  return refreshCookie;
}

async function request(path, { method = 'GET', body, cookie } = {}) {
  const response = await fetch(new URL(path, baseUrl), {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {})
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
  let refreshCookie = cookieFrom(login.response);
  console.log('PASS: login and HttpOnly refresh cookie');

  const refresh = await request('/api/auth/refresh', {
    method: 'POST',
    cookie: refreshCookie
  });
  if (refresh.response.status !== 200 || refresh.data?.success !== true || !(refresh.data?.data?.token || refresh.data?.token)) {
    throw new Error(`Refresh-token rotation failed (HTTP ${refresh.response.status}).`);
  }
  const rotatedCookie = cookieFrom(refresh.response);
  if (rotatedCookie === refreshCookie) {
    throw new Error('Refresh endpoint returned the same refresh cookie instead of rotating it.');
  }
  console.log('PASS: refresh-token rotation');

  const logout = await request('/api/auth/logout', {
    method: 'POST',
    cookie: rotatedCookie
  });
  if (logout.response.status !== 200 || logout.data?.success !== true) {
    throw new Error(`Logout failed (HTTP ${logout.response.status}).`);
  }
  console.log('PASS: logout');

  const replay = await request('/api/auth/refresh', {
    method: 'POST',
    cookie: rotatedCookie
  });
  if (replay.response.status !== 401) {
    throw new Error(`Revoked refresh token was not rejected (HTTP ${replay.response.status}).`);
  }
  console.log('PASS: revoked refresh token rejected after logout');
  console.log('Staging authentication smoke test completed successfully.');
} catch (error) {
  fail(error.message || 'Unexpected staging smoke-test failure.');
}
