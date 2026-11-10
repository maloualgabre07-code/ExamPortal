'use strict';

const crypto = require('node:crypto');
const {promisify} = require('node:util');

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const TOKEN_INFO = 'https://oauth2.googleapis.com/tokeninfo';
const random = () => crypto.randomBytes(32).toString('base64url');
const sha256 = value => crypto.createHash('sha256').update(value).digest('base64url');
const errorRedirect = message => '/?google_error=' + encodeURIComponent(message);

function oauthFailure(message) {
  const error = new Error(message);
  error.expected = true;
  return error;
}

function sameSecret(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function validRedirectUri(value) {
  if (typeof value !== 'string' || value.trim() !== value || !URL.canParse(value)) return false;
  const uri = new URL(value);
  const secureOrLocal = uri.protocol === 'https:'
    || (uri.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(uri.hostname));
  return secureOrLocal
    && Boolean(uri.hostname)
    && !uri.username
    && !uri.password
    && uri.pathname === '/auth/google/callback'
    && !uri.search
    && !uri.hash;
}

function attachGoogleAuth(app, pool, options = {}) {
  const clientId = options.clientId ?? process.env.GOOGLE_CLIENT_ID;
  const clientSecret = options.clientSecret ?? process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = options.redirectUri ?? process.env.GOOGLE_REDIRECT_URI;
  const fetchRequest = options.fetch ?? globalThis.fetch;
  const hasValue = value => typeof value === 'string' && value.trim() === value && value.length > 0;
  const enabled = hasValue(clientId) && hasValue(clientSecret) && validRedirectUri(redirectUri);
console.log('[GOOGLE AUTH VALIDATION]', {
    module: __filename,
    clientIdValid: hasValue(clientId),
    clientSecretValid: hasValue(clientSecret),
    redirectUriValid: validRedirectUri(redirectUri),
    enabled: enabled
});
 app.get('/api/google-config', (req, res) => {
  console.log('[GOOGLE CONFIG REQUEST]', {
    file: __filename,
    enabled
  });
  res.json({ enabled });
});

  app.get('/auth/google', async (req, res, next) => {
    try {
      if (!enabled) return res.redirect(errorRedirect('Google Sign-In is not configured yet.'));

      const state = random();
      const nonce = random();
      const verifier = random();
      req.session.googleOAuth = {state, nonce, verifier, createdAt: Date.now()};
      await promisify(req.session.save).call(req.session);

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        nonce,
        code_challenge: sha256(verifier),
        code_challenge_method: 'S256',
        prompt: 'select_account'
      });
      return res.redirect(`${GOOGLE_AUTH}?${params}`);
    } catch (error) {
      return next(error);
    }
  });

  app.get('/auth/google/callback', async (req, res) => {
    const pending = req.session.googleOAuth;
    delete req.session.googleOAuth;

    try {
      await promisify(req.session.save).call(req.session);
      if (!enabled) throw oauthFailure('Google Sign-In is not configured.');
      if (req.query.error) throw oauthFailure('Google sign-in was cancelled or denied.');

      const now = Date.now();
      if (!pending
        || typeof pending.state !== 'string'
        || typeof pending.nonce !== 'string'
        || typeof pending.verifier !== 'string'
        || typeof pending.createdAt !== 'number'
        || now - pending.createdAt > 5 * 60 * 1000
        || pending.createdAt > now + 30_000
        || !sameSecret(req.query.state, pending.state)
        || typeof req.query.code !== 'string'
        || !req.query.code
        || req.query.code.length > 4096) {
        throw oauthFailure('Google sign-in session expired. Please try again.');
      }

      const tokenResponse = await fetchRequest(TOKEN_URL, {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams({
          code: req.query.code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          code_verifier: pending.verifier
        }),
        signal: AbortSignal.timeout(10_000)
      });
      if (!tokenResponse.ok) {
        throw oauthFailure('Google could not complete authentication. Check the OAuth configuration.');
      }
      const tokens = await tokenResponse.json();
      if (typeof tokens.id_token !== 'string' || !tokens.id_token) {
        throw oauthFailure('Google did not provide an identity token.');
      }

      // Google's HTTPS tokeninfo endpoint validates the ID token and its signature.
      const identityResponse = await fetchRequest(
        `${TOKEN_INFO}?id_token=${encodeURIComponent(tokens.id_token)}`,
        {signal: AbortSignal.timeout(10_000)}
      );
      if (!identityResponse.ok) throw oauthFailure('Google identity verification failed.');
      const identity = await identityResponse.json();
      const verifiedEmail = typeof identity.email === 'string' ? identity.email.toLowerCase() : '';
      const expiresAt = Number(identity.exp) * 1000;
      const issuerIsGoogle = ['accounts.google.com', 'https://accounts.google.com'].includes(identity.iss);
      const emailIsVerified = identity.email_verified === true || identity.email_verified === 'true';

      if (!issuerIsGoogle
        || identity.aud !== clientId
        || !emailIsVerified
        || !sameSecret(identity.nonce, pending.nonce)
        || typeof identity.sub !== 'string'
        || !identity.sub
        || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(verifiedEmail)
        || !Number.isFinite(expiresAt)
        || expiresAt <= Date.now()) {
        throw oauthFailure('Google identity verification failed.');
      }
      if (!verifiedEmail.endsWith('@gmail.com') && !(typeof identity.hd === 'string' && identity.hd)) {
        throw oauthFailure('Use a Gmail or Google Workspace account to sign in.');
      }

      const user = (await pool.query(
        'SELECT id, active, auth_version FROM users WHERE lower(email) = $1 LIMIT 1',
        [verifiedEmail]
      )).rows[0];
      if (!user || !user.active) {
        throw oauthFailure('No active ExamPortal account matches this Google email. Register with the same verified email first.');
      }

      await promisify(req.session.regenerate).call(req.session);
      req.session.userId = user.id;
      req.session.authVersion = user.auth_version;
      req.session.csrf = crypto.randomBytes(32).toString('hex');
      await promisify(req.session.save).call(req.session);
      return res.redirect('/');
    } catch (error) {
      if (!error.expected) console.error('Google authentication failed:', error.message);
      const message = error.expected
        ? error.message
        : 'Google sign-in failed. Please try again.';
      return res.redirect(errorRedirect(message));
    }
  });
}

module.exports = {attachGoogleAuth};
