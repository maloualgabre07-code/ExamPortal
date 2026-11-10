'use strict';
const crypto = require('crypto');

// Safe Exam Browser official Config Key specification:
// X-SafeExamBrowser-ConfigKeyHash = SHA256(absoluteURLWithoutFragment + configKey)
// Config Key itself is a 64-hex-character value copied from the finalized .seb file.
function configHash(url, configKey) {
  return crypto.createHash('sha256').update(url + configKey, 'utf8').digest('hex');
}
function isValidConfigKey(req, options = process.env) {
  if (options.SEB_REQUIRED !== 'true') return true;
  const key = (options.SEB_CONFIG_KEY || '').trim().toLowerCase();
  const base = (options.SEB_BASE_URL || '').trim();
  if (!/^[a-f0-9]{64}$/.test(key) || !/^https?:\/\//.test(base)) return false;
  const received = req.get('X-SafeExamBrowser-ConfigKeyHash');
  if (!/^[a-f0-9]{64}$/i.test(received || '')) return false;
  // Explicit canonical origin avoids trusting spoofable Host / forwarded headers.
  // SEB_BASE_URL MUST match the exact origin SEB uses (e.g., https://exam.school.edu).
  let absolute;
  try {
    const expectedOrigin = new URL(base);
    if (expectedOrigin.pathname !== '/' || expectedOrigin.search || expectedOrigin.hash || expectedOrigin.username || expectedOrigin.password) return false;
    absolute = new URL(req.originalUrl, expectedOrigin.origin).href.split('#')[0];
  } catch { return false; }
  const expected = Buffer.from(configHash(absolute, key), 'hex');
  const actual = Buffer.from(received, 'hex');
  return crypto.timingSafeEqual(expected, actual);
}
function requireSeb(req, res, next) {
  if (isValidConfigKey(req)) return next();
  return res.status(403).json({message:'This examination requires the approved Safe Exam Browser configuration. Open the school-provided .seb file. If already using SEB, contact your instructor.'});
}
module.exports = {configHash,isValidConfigKey,requireSeb};
