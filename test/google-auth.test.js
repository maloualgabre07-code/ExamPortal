const {test} = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {attachGoogleAuth} = require('../google-auth');

function fixture({fetch, user = {id: 7, active: true, auth_version: 3}} = {}) {
  const routes = new Map();
  const queries = [];
  const app = {get: (route, handler) => routes.set(route, handler)};
  const pool = {
    async query(sql, values) {
      queries.push({sql, values});
      return {rows: [user]};
    }
  };
  attachGoogleAuth(app, pool, {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    redirectUri: 'http://localhost:3000/auth/google/callback',
    fetch
  });

  const session = {
    save(callback) { callback(); },
    regenerate(callback) {
      for (const key of Object.keys(this)) {
        if (key !== 'save' && key !== 'regenerate') delete this[key];
      }
      callback();
    }
  };
  const res = {
    redirect(url) { this.location = url; },
    json(value) { this.body = value; }
  };
  return {routes, session, res, queries};
}

async function beginLogin(state = {}) {
  const f = fixture(state);
  await f.routes.get('/auth/google')({session: f.session}, f.res, error => { throw error; });
  return f;
}

test('OAuth start uses state, nonce, PKCE, and the configured localhost callback', async () => {
  const f = await beginLogin();
  const authorization = new URL(f.res.location);
  const params = authorization.searchParams;
  const pending = f.session.googleOAuth;

  assert.equal(authorization.origin, 'https://accounts.google.com');
  assert.equal(params.get('redirect_uri'), 'http://localhost:3000/auth/google/callback');
  assert.equal(params.get('response_type'), 'code');
  assert.equal(params.get('scope'), 'openid email profile');
  assert.equal(params.get('state'), pending.state);
  assert.equal(params.get('nonce'), pending.nonce);
  assert.equal(params.get('code_challenge_method'), 'S256');
  assert.equal(params.get('code_challenge'), crypto.createHash('sha256').update(pending.verifier).digest('base64url'));
});

test('Google sign-in stays disabled without a complete valid configuration', async () => {
  const routes = new Map();
  const app = {get: (route, handler) => routes.set(route, handler)};
  attachGoogleAuth(app, {}, {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    redirectUri: 'http://localhost:3000/not-the-callback'
  });
  const res = {
    redirect(url) { this.location = url; },
    json(value) { this.body = value; }
  };
  routes.get('/api/google-config')({}, res);
  assert.deepEqual(res.body, {enabled: false});

  await routes.get('/auth/google')({session: {}}, res, error => { throw error; });
  assert.match(decodeURIComponent(res.location), /Google Sign-In is not configured/);
});

test('Google config requires a nonempty redirect URI', () => {
  const routes = new Map();
  const app = {get: (route, handler) => routes.set(route, handler)};
  attachGoogleAuth(app, {}, {clientId: 'test-client-id', clientSecret: 'test-client-secret'});
  const res = {json(value) { this.body = value; }};

  routes.get('/api/google-config')({}, res);
  assert.deepEqual(res.body, {enabled: false});
});

test('Google config is enabled only with a complete valid callback configuration', () => {
  const routes = new Map();
  const app = {get: (route, handler) => routes.set(route, handler)};
  attachGoogleAuth(app, {}, {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    redirectUri: 'https://exam.example/auth/google/callback'
  });
  const res = {json(value) { this.body = value; }};

  routes.get('/api/google-config')({}, res);
  assert.deepEqual(res.body, {enabled: true});
});

test('Google config rejects an insecure non-local callback URL', () => {
  const routes = new Map();
  const app = {get: (route, handler) => routes.set(route, handler)};
  attachGoogleAuth(app, {}, {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    redirectUri: 'http://exam.example/auth/google/callback'
  });
  const res = {json(value) { this.body = value; }};

  routes.get('/api/google-config')({}, res);
  assert.deepEqual(res.body, {enabled: false});
});

test('Google button renders below password sign-in without OAuth config gating', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  const client = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
  const signIn = html.indexOf('id="auth-submit"');
  const google = html.indexOf('<div id="google-login-wrap"');
  const wrapper = html.slice(google, html.indexOf('</div><p id="auth-error"', google));

  assert.ok(signIn >= 0 && google > signIn);
  assert.doesNotMatch(wrapper, /\shidden(?:\s|>)/);
  assert.match(wrapper, /href="\/auth\/google"/);
  for (const color of ['#EA4335', '#4285F4', '#FBBC05', '#34A853']) {
    assert.ok(wrapper.includes(color), `missing official Google icon color ${color}`);
  }
  assert.doesNotMatch(client, /fetch\(['"]\/api\/google-config/);
  assert.match(client, /\$\('google-login-wrap'\)\.hidden=registering/);
});

test('callback verifies Google identity and signs in the existing active account', async () => {
  let identity;
  const fetch = async url => {
    if (url.startsWith('https://oauth2.googleapis.com/tokeninfo?')) {
      return Response.json({
        iss: 'https://accounts.google.com',
        aud: 'test-client-id',
        email: 'Student@Gmail.com',
        email_verified: 'true',
        sub: 'google-subject',
        exp: String((Date.now() + 60_000) / 1000),
        nonce: identity.nonce
      });
    }
    if (url === 'https://oauth2.googleapis.com/token') {
      identity = {nonce: pendingNonce};
      return Response.json({id_token: 'verified-id-token'});
    }
    throw new Error('Unexpected Google endpoint');
  };
  const f = await beginLogin({fetch});
  const pendingNonce = f.session.googleOAuth.nonce;
  const state = f.session.googleOAuth.state;

  await f.routes.get('/auth/google/callback')({
    query: {state, code: 'authorization-code'},
    session: f.session
  }, f.res);

  assert.equal(f.res.location, '/');
  assert.equal(f.session.userId, 7);
  assert.equal(f.session.authVersion, 3);
  assert.equal(typeof f.session.csrf, 'string');
  assert.equal(f.session.googleOAuth, undefined);
  assert.equal(f.queries.length, 1);
  assert.deepEqual(f.queries[0].values, ['student@gmail.com']);
  assert.match(f.queries[0].sql, /SELECT id, active, auth_version/);
});

test('callback rejects invalid state before contacting Google', async () => {
  let requests = 0;
  const f = await beginLogin({fetch: async () => { requests++; }});
  await f.routes.get('/auth/google/callback')({
    query: {state: 'not-the-state', code: 'authorization-code'},
    session: f.session
  }, f.res);

  assert.equal(requests, 0);
  assert.match(decodeURIComponent(f.res.location), /Google sign-in session expired/);
  assert.equal(f.session.googleOAuth, undefined);
});

test('callback rejects unverified emails and inactive existing accounts', async t => {
  for (const scenario of [
    {name: 'unverified email', identity: {email_verified: 'false'}, user: {id: 7, active: true}},
    {name: 'inactive account', identity: {email_verified: 'true'}, user: {id: 7, active: false}}
  ]) {
    await t.test(scenario.name, async () => {
      let nonce;
      const fetch = async url => {
        if (url === 'https://oauth2.googleapis.com/token') return Response.json({id_token: 'verified-id-token'});
        return Response.json({
          iss: 'accounts.google.com',
          aud: 'test-client-id',
          email: 'student@gmail.com',
          email_verified: scenario.identity.email_verified,
          sub: 'google-subject',
          exp: String((Date.now() + 60_000) / 1000),
          nonce
        });
      };
      const f = await beginLogin({fetch, user: scenario.user});
      nonce = f.session.googleOAuth.nonce;
      const state = f.session.googleOAuth.state;
      await f.routes.get('/auth/google/callback')({
        query: {state, code: 'authorization-code'},
        session: f.session
      }, f.res);

      assert.match(decodeURIComponent(f.res.location), /Google identity verification failed|No active ExamPortal account/);
      assert.equal(f.session.userId, undefined);
    });
  }
});
