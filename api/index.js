const GAS_URL = 'https://script.google.com/macros/s/AKfycbzLLhQ8Vcn1sEljXtGrGkafmLQf26FcYPT2HA9HR9RGB5HtpA5OHm_KuqNgFy2ogBGR8w/exec';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      service: 'COGNIORA Vercel API',
      status: 'online'
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed.'
    });
  }

  try {
    let payload = req.body;

    if (typeof payload === 'string') {
      payload = JSON.parse(payload || '{}');
    }

    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Request body tidak valid.'
      });
    }

    const upstream = await fetch(GAS_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*'
      },
      body: JSON.stringify(payload)
    });

    const raw = await upstream.text();
    const contentType = upstream.headers.get('content-type') || '';

    res.setHeader(
      'Content-Type',
      contentType.includes('application/json') ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8'
    );

    return res.status(upstream.status).send(raw);
  } catch (error) {
    console.error('COGNIORA API proxy error:', error);

    return res.status(502).json({
      success: false,
      message: 'Vercel tidak dapat menghubungi Google Apps Script.',
      detail: error?.message || 'Upstream request failed.'
    });
  }
}
