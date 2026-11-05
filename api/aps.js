// Civil AI - Autodesk Platform Services (APS) gateway.
// Node.js serverless Vercel function. Secrets are set in Vercel, never in GitHub.
// All non-health actions require CIVIL_AI_VIEWER_PASSWORD over HTTPS.
const { timingSafeEqual, randomUUID, createHmac, randomBytes } = require('node:crypto');
const BASE = 'https://developer.api.autodesk.com';
const MB = 1024 * 1024;
const CHUNK = 25 * MB;
const MAX_FILE = 500 * MB;
const EXT = new Set(['dwg', 'dxf', 'rvt', 'rfa', 'ifc', 'nwd', 'nwc']);
const validKey = /^civilai-[0-9a-f-]{36}\.(dwg|dxf|rvt|rfa|ifc|nwd|nwc)$/;
const COOKIE_NAME = 'civilai_aps_session';
const SESSION_SECONDS = 60 * 60 * 24 * 30;
function same(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aa = Buffer.from(a), bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
function sessionSignature(id, expiry) {
  const secret = process.env.CIVIL_AI_VIEWER_PASSWORD || '';
  return createHmac('sha256', secret).update('civilai-aps-session-v1:' + id + ':' + expiry).digest('hex');
}
function sessionCookie(req) {
  const raw = String(req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE_NAME + '='));
  if (!raw) return false;
  const token = raw.slice(COOKIE_NAME.length + 1);
  const match = /^([a-f0-9]{32})\.([0-9]{13})\.([a-f0-9]{64})$/.exec(token);
  if (!match || !process.env.CIVIL_AI_VIEWER_PASSWORD || process.env.CIVIL_AI_VIEWER_PASSWORD.length < 12) return false;
  const expiry = Number(match[2]);
  if (!Number.isSafeInteger(expiry) || expiry <= Date.now() || expiry > Date.now() + SESSION_SECONDS * 1000 + 120000) return false;
  return same(match[3], sessionSignature(match[1], match[2]));
}
function auth(req) {
  const secret = process.env.CIVIL_AI_VIEWER_PASSWORD;
  return sessionCookie(req) || (typeof secret === 'string' && secret.length >= 12 && same(req.headers['x-civil-ai-password'], secret));
}
function cookieOptions(value, maxAge = SESSION_SECONDS) {
  return COOKIE_NAME + '=' + value + '; Path=/api/aps; HttpOnly; Secure; SameSite=Strict; Max-Age=' + maxAge;
}
function originSafe(req) {
  const origin = req.headers.origin;
  if (typeof origin !== 'string') return false;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return origin === 'https://' + host;
}
function bucket() {
  const id = process.env.APS_CLIENT_ID || '';
  // Stable bucket name, globally unique in most cases, with no user input.
  const suffix = id.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 38);
  if (!suffix || suffix.length < 6) throw Error('Invalid APS_CLIENT_ID');
  return 'civilai-' + suffix;
}
function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  return {};
}
async function token(scopes) {
  const id = process.env.APS_CLIENT_ID, secret = process.env.APS_CLIENT_SECRET;
  if (!id || !secret) throw Error('APS credentials are not configured in Vercel');
  const basic = Buffer.from(id + ':' + secret).toString('base64');
  const res = await fetch(BASE + '/authentication/v2/token', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + basic, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: scopes }).toString()
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok || !result.access_token) throw Error('APS authentication failed (' + res.status + ')');
  return result;
}
const WRITER = 'bucket:create bucket:read data:create data:read data:write viewables:read';
const READER = 'data:read viewables:read';
async function aps(path, access, method = 'GET', body, headers = {}) {
  const response = await fetch(BASE + path, {
    method,
    headers: { Authorization: 'Bearer ' + access, ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const raw = await response.text();
  let out;
  try { out = JSON.parse(raw) } catch { out = { detail: raw.slice(0, 400) } }
  if (!response.ok) {
    const detail = typeof out.reason === 'string' ? out.reason : out.developerMessage || out.message || out.detail || '';
    const error = new Error('APS service returned ' + response.status + (detail ? ': ' + String(detail).slice(0, 220) : ''));
    error.status = response.status;
    throw error;
  }
  return out;
}
async function ensureBucket(access) {
  const b = bucket();
  const check = await fetch(BASE + '/oss/v2/buckets/' + b + '/details', {
    headers: { Authorization: 'Bearer ' + access }
  });
  if (check.ok) return b;
  if (check.status !== 404) throw Error('Cannot inspect APS storage bucket (' + check.status + ')');
  try {
    await aps('/oss/v2/buckets', access, 'POST', { bucketKey: b, policyKey: 'temporary' }, { 'x-ads-region': 'US' });
  } catch (e) { if (e.status !== 409) throw e }
  return b;
}
function validateUrn(value) {
  if (typeof value !== 'string' || value.length > 1200 || !/^[A-Za-z0-9_-]+$/.test(value)) throw Error('Invalid model URN');
  let decoded;
  try { decoded = Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8') } catch {}
  if (!decoded || !decoded.startsWith('urn:adsk.objects:os.object:' + bucket() + '/civilai-')) throw Error('Model does not belong to this workspace');
  return value;
}
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    const url = new URL(req.url, 'https://civil-ai.invalid');
    const action = url.searchParams.get('action');
    if (action === 'health' && req.method === 'GET') {
      return res.status(200).json({ configured: Boolean(process.env.APS_CLIENT_ID && process.env.APS_CLIENT_SECRET && process.env.CIVIL_AI_VIEWER_PASSWORD?.length >= 12), supported: ['dwg','dxf','rvt','rfa','ifc','nwd','nwc'], robotRTD: false });
    }
    if (action === 'session' && req.method === 'GET') {
      return res.status(200).json({ authenticated: sessionCookie(req) });
    }
    if (action === 'session' && req.method === 'POST') {
      if (!originSafe(req)) return res.status(403).json({ error: 'Origin verification failed' });
      const pw = parseBody(req).password;
      if (typeof pw !== 'string' || !same(pw, process.env.CIVIL_AI_VIEWER_PASSWORD || '') || pw.length < 12) {
        return res.status(401).json({ error: 'Invalid owner access key' });
      }
      const id = randomBytes(16).toString('hex'), expiry = String(Date.now() + SESSION_SECONDS * 1000);
      res.setHeader('Set-Cookie', cookieOptions(id + '.' + expiry + '.' + sessionSignature(id, expiry)));
      return res.status(200).json({ authenticated: true, deviceRememberedForDays: 30 });
    }
    if (action === 'session' && req.method === 'DELETE') {
      if (!originSafe(req)) return res.status(403).json({ error: 'Origin verification failed' });
      res.setHeader('Set-Cookie', cookieOptions('', 0));
      return res.status(200).json({ authenticated: false });
    }
    if (!auth(req)) return res.status(401).json({ error: 'Unauthorized. Sign in on this device first.' });
    if (action === 'viewer-token' && req.method === 'GET') {
      const t = await token(READER);
      return res.status(200).json({ access_token: t.access_token, expires_in: t.expires_in });
    }
    if (action === 'prepare' && req.method === 'POST') {
      const body = parseBody(req), name = String(body.name || '');
      const ext = name.split('.').pop().toLowerCase(), size = Number(body.size);
      if (!EXT.has(ext)) return res.status(400).json({ error: 'Unsupported format. Robot .RTD needs export from Robot.' });
      if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_FILE) return res.status(400).json({ error: 'File size must be 1 byte to 500 MB' });
      const key = 'civilai-' + randomUUID() + '.' + ext;
      const parts = Math.ceil(size / CHUNK);
      const t = await token(WRITER);
      const b = await ensureBucket(t.access_token);
      // Browser uploads directly to APS-signed S3 URLs, bypassing Vercel body limits.
      const result = await aps('/oss/v2/buckets/' + b + '/objects/' + encodeURIComponent(key) + '/signeds3upload?parts=' + parts + '&minutesExpiration=30', t.access_token);
      if (!Array.isArray(result.urls) || result.urls.length !== parts || typeof result.uploadKey !== 'string') throw Error('APS did not return signed upload URLs');
      return res.status(200).json({ key, uploadKey: result.uploadKey, urls: result.urls, chunkSize: CHUNK });
    }
    if (action === 'complete' && req.method === 'POST') {
      const body = parseBody(req), key = String(body.key || ''), uploadKey = String(body.uploadKey || '');
      if (!validKey.test(key) || !uploadKey || uploadKey.length > 2000) return res.status(400).json({ error: 'Invalid upload session' });
      const t = await token(WRITER), b = bucket();
      const finished = await aps('/oss/v2/buckets/' + b + '/objects/' + encodeURIComponent(key) + '/signeds3upload', t.access_token, 'POST', { uploadKey });
      const objectId = finished.objectId;
      if (typeof objectId !== 'string' || !objectId.includes('/' + key)) throw Error('APS did not return the uploaded object ID');
      const urn = Buffer.from(objectId).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
      await aps('/modelderivative/v2/designdata/job', t.access_token, 'POST', {
        input: { urn },
        output: { formats: [{ type: 'svf2', views: ['2d','3d'] }] }
      });
      return res.status(200).json({ urn, status: 'submitted' });
    }
    if (action === 'status' && req.method === 'GET') {
      const urn = validateUrn(url.searchParams.get('urn'));
      const t = await token(READER);
      try {
        const manifest = await aps('/modelderivative/v2/designdata/' + encodeURIComponent(urn) + '/manifest', t.access_token);
        const messages = [];
        function walk(obj, depth = 0) {
          if (!obj || depth > 3 || messages.length > 12) return;
          if (Array.isArray(obj)) return obj.slice(0, 15).forEach(v => walk(v, depth + 1));
          if (typeof obj !== 'object') return;
          if (Array.isArray(obj.messages)) for (const m of obj.messages.slice(0, 5)) {
            const raw = typeof m === 'string' ? m : m.message || m.code || m.type;
            if (raw) messages.push(String(raw).slice(0, 220));
          }
          if (obj.children) walk(obj.children, depth + 1);
          if (obj.derivatives) walk(obj.derivatives, depth + 1);
        }
        walk(manifest);
        return res.status(200).json({
          status: manifest.status || 'pending',
          progress: manifest.progress || '',
          region: manifest.region || 'US',
          messages: [...new Set(messages)].slice(0, 8)
        });
      } catch (e) {
        if (e.status === 404) return res.status(200).json({ status: 'pending', progress: 'waiting' });
        throw e;
      }
    }
    if (action === 'views' && req.method === 'GET') {
      const urn = validateUrn(url.searchParams.get('urn'));
      const t = await token(READER);
      const data = await aps('/modelderivative/v2/designdata/' + encodeURIComponent(urn) + '/metadata', t.access_token);
      return res.status(200).json({ views: (data.data?.metadata || []).slice(0,100).map(v => ({ name:v.name, role:v.role, guid:v.guid })) });
    }
    return res.status(404).json({ error: 'Unknown action' });
  } catch (e) {
    console.error('Civil AI APS:', e.message);
    return res.status(e.status >= 400 && e.status < 500 ? 502 : 500).json({ error: String(e.message || e).slice(0, 300) });
  }
};