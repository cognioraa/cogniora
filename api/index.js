const GAS_URL = 'https://script.google.com/macros/s/AKfycbzLLhQ8Vcn1sEljXtGrGkafmLQf26FcYPT2HA9HR9RGB5HtpA5OHm_KuqNgFy2ogBGR8w/exec';
const UPSTREAM_TIMEOUT_MS = 45000;

function json(res, status, body) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Cogniora-API', 'vercel-proxy-v4');
  return res.status(status).json(body);
}

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
    if (typeof req.body === 'object') return req.body;
  }

  let raw = '';
  for await (const chunk of req) raw += chunk;
  return JSON.parse(raw || '{}');
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      redirect: 'follow',
      cache: 'no-store'
    });
  } finally {
    clearTimeout(timer);
  }
}

async function parseUpstreamJson(response) {
  const raw = await response.text();
  const contentType = response.headers.get('content-type') || '';

  let data = null;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    const preview = String(raw || '').replace(/\\s+/g, ' ').slice(0, 500);
    throw new Error(
      `Google Apps Script mengembalikan response bukan JSON. HTTP ${response.status}. ` +
      `Content-Type: ${contentType || '(kosong)'}. Preview: ${preview || '(empty)'}`
    );
  }

  return { data, raw, contentType };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(204).end();

  // GET /api = real upstream health check. This is deliberately not a local
  // "online" response, so it can distinguish Vercel availability from GAS availability.
  if (req.method === 'GET') {
    try {
      const upstream = await fetchWithTimeout(`${GAS_URL}?api=health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json, text/plain, */*' }
      });
      const { data, contentType } = await parseUpstreamJson(upstream);

      return json(res, upstream.ok ? 200 : 502, {
        success: upstream.ok && data?.success !== false,
        service: 'COGNIORA Vercel API',
        proxy: 'online',
        gas: data,
        upstreamStatus: upstream.status,
        upstreamContentType: contentType || null,
        gasUrlConfigured: Boolean(GAS_URL)
      });
    } catch (error) {
      console.error('COGNIORA API health check error:', error);
      return json(res, 502, {
        success: false,
        service: 'COGNIORA Vercel API',
        proxy: 'online',
        gas: 'unreachable',
        message: error?.name === 'AbortError'
          ? 'Google Apps Script tidak merespons dalam batas waktu.'
          : 'Vercel tidak dapat menghubungi Google Apps Script.',
        detail: error?.message || 'Upstream health check failed.'
      });
    }
  }

  if (req.method !== 'POST') {
    return json(res, 405, {
      success: false,
      message: 'Method not allowed.'
    });
  }

  let payload;
  try {
    payload = await readBody(req);
  } catch (error) {
    return json(res, 400, {
      success: false,
      message: 'Request body JSON tidak valid.',
      detail: error?.message || 'Invalid JSON body.'
    });
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return json(res, 400, {
      success: false,
      message: 'Request body tidak valid.'
    });
  }

  const action = String(payload.action || '').trim();
  const args = Array.isArray(payload.args) ? payload.args : [];

  if (!action) {
    return json(res, 400, {
      success: false,
      message: 'Action API tidak boleh kosong.'
    });
  }

  console.log('[COGNIORA API] forwarding action:', action, 'args:', args.length);

  try {
    // text/plain avoids unnecessary browser/CORS semantics and is fully readable
    // by Apps Script through e.postData.contents.
    const upstream = await fetchWithTimeout(GAS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
        'Accept': 'application/json, text/plain, */*'
      },
      body: JSON.stringify({ action, args })
    });

    const { data, contentType } = await parseUpstreamJson(upstream);
    const upstreamSuccess = data?.success !== false;

    if (!upstream.ok) {
      return json(res, 502, {
        success: false,
        message: data?.message || `Google Apps Script HTTP ${upstream.status}.`,
        upstreamStatus: upstream.status,
        upstreamContentType: contentType || null,
        gas: data
      });
    }

    // Apps Script can return HTTP 200 with {success:false}; preserve that result
    // so the frontend receives the actual business error instead of a generic 502.
    return json(res, upstreamSuccess ? 200 : 200, data);
  } catch (error) {
    console.error('COGNIORA API proxy error:', error);

    return json(res, 502, {
      success: false,
      message: error?.name === 'AbortError'
        ? 'Request ke Google Apps Script timeout.'
        : 'Vercel tidak dapat menghubungi Google Apps Script.',
      detail: error?.message || 'Upstream request failed.',
      action
    });
  }
}
