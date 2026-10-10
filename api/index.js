// COGNIORA — Vercel serverless proxy ke Google Apps Script (GAS)
// Browser -> /api (same-origin, tanpa CORS) -> GAS_URL (+ api_key rahasia) -> Google Sheets/Drive.
// Environment Variables (Vercel > Project > Settings > Environment Variables):
//   GAS_URL      = https://script.google.com/macros/s/AKfycbzPGt9a9KbGIaxtgrLkLkr46sZfw9ecxRbsY4RmYg1V-6cs5IXS1gcNdOFtgBkjoW1-/exec
//   GAS_API_KEY  = 59872f7af981e58de0ec1165fdd18817bd73928ef683f26b

const GAS_URL = process.env.GAS_URL || '';
const GAS_API_KEY = process.env.GAS_API_KEY || '';
const TIMEOUT_MS = 55000;
const ALLOWED_PREFIX = /^(public|auth|student|admin)\.|^form:/;
const ACTION_RE = /^(form:)?[A-Za-z]+(\.[A-Za-z0-9]+)+$/;

// Cache memori singkat untuk konten publik (landing page, gambar) agar tidak menunggu GAS berulang kali.
const CACHEABLE = new Set(['public.content', 'public.programs', 'public.packages', 'public.syllabus', 'public.testimonials', 'public.image']);
const TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 40;
const cache = new Map();

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

function fail(res, status, code, message, extra) {
  return send(res, status, Object.assign({ success: false, code, message }, extra || {}));
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return null; } }
  return await new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch (e) { resolve(null); } });
    req.on('error', () => resolve(null));
  });
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    // Cek cepat di browser: https://DOMAIN-ANDA/api
    return send(res, 200, { success: true, data: { service: 'COGNIORA Vercel proxy', gas_url_configured: !!GAS_URL, api_key_configured: !!GAS_API_KEY } });
  }
  if (req.method !== 'POST') return fail(res, 405, 'METHOD_NOT_ALLOWED', 'Use POST.');
  if (!GAS_URL || !GAS_API_KEY) {
    return fail(res, 500, 'PROXY_NOT_CONFIGURED', 'GAS_URL atau GAS_API_KEY belum diisi di Vercel Environment Variables (lalu Redeploy).');
  }

  const body = await readBody(req);
  if (!body || typeof body !== 'object') return fail(res, 400, 'BAD_REQUEST', 'Body harus JSON.');
  const action = String(body.action || '');
  if (!ACTION_RE.test(action) || !ALLOWED_PREFIX.test(action)) return fail(res, 400, 'BAD_ACTION', 'Action tidak valid.');
  const data = body.data && typeof body.data === 'object' ? Object.assign({}, body.data) : {};
  delete data.api_key; // api_key tidak pernah boleh datang dari browser
  const sessionToken = typeof body.session_token === 'string' ? body.session_token : '';

  const cacheKey = CACHEABLE.has(action) ? action + '|' + JSON.stringify(data) : '';
  if (cacheKey) {
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.t < TTL_MS) return send(res, 200, hit.body);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(GAS_URL, {
      method: 'POST',
      redirect: 'follow', // GAS membalas 302 ke script.googleusercontent.com; ini normal
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, data, session_token: sessionToken, api_key: GAS_API_KEY }),
      signal: controller.signal
    });
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch (e) { /* bukan JSON */ }
    if (!json) {
      const looksLikeLogin = /accounts\.google\.com|ServiceLogin|Sign in/i.test(text);
      return fail(res, 502, 'GAS_BAD_RESPONSE',
        looksLikeLogin
          ? 'GAS meminta login Google. Di Deploy > Manage deployments atur "Who has access" = Anyone, lalu deploy versi baru.'
          : 'GAS tidak mengembalikan JSON (HTTP ' + r.status + '). Pastikan GAS_URL benar (/exec) dan sudah di-deploy ulang.',
        { http_status: r.status });
    }
    if (cacheKey && json.success) {
      if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value);
      cache.set(cacheKey, { t: Date.now(), body: json });
    }
    return send(res, 200, json);
  } catch (err) {
    if (err && err.name === 'AbortError') return fail(res, 504, 'GAS_TIMEOUT', 'GAS terlalu lama merespons (>55 detik). Coba lagi.');
    return fail(res, 502, 'GAS_UNREACHABLE', 'Tidak dapat menghubungi GAS: ' + String(err && err.message || err));
  } finally {
    clearTimeout(timer);
  }
};
