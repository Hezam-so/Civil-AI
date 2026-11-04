// Civil AI - Autodesk Platform Services (APS) gateway.
// Node.js serverless Vercel function. Secrets are set in Vercel, never in GitHub.
// All non-health actions require CIVIL_AI_VIEWER_PASSWORD over HTTPS.
const { timingSafeEqual, randomUUID } = require('node:crypto');
const BASE = 'https://developer.api.autodesk.com';
const MB = 1024 * 1024;
const CHUNK = 10 * MB;
const MAX_FILE = 100 * MB;
const EXT = new Set(['dwg', 'dxf', 'rvt', 'rfa', 'ifc', 'nwd', 'nwc']);
const validKey = /^civilai-[0-9a-f-]{36}\.(dwg|dxf|rvt|rfa|ifc|nwd|nwc)$/;
function auth(req) {
  const expected = process.env.CIVIL_AI_VIEWER_PASSWORD;
  const given = req.headers['x-civil-ai-password'];
  if (!expected || expected.length < 12 || typeof given !== 'string') return false;
  const a = Buffer.from(given), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
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
    if (!auth(req)) return res.status(401).json({ error: 'Access denied: enter the workspace password' });
    if (action === 'viewer-token' && req.method === 'GET') {
      const t = await token(READER);
      return res.status(200).json({ access_token: t.access_token, expires_in: t.expires_in });
    }
    if (action === 'prepare' && req.method === 'POST') {
      const body = parseBody(req), name = String(body.name || '');
      const ext = name.split('.').pop().toLowerCase(), size = Number(body.size);
      if (!EXT.has(ext)) return res.status(400).json({ error: 'Unsupported format. Robot .RTD needs export from Robot.' });
      if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_FILE) return res.status(400).json({ error: 'File size must be 1 byte to 100 MB' });
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
        return res.status(200).json({ status: manifest.status, progress: manifest.progress || '', region: manifest.region || 'US' });
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