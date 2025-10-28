export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') return json({ ok: true });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const { deviceId } = getContext(req);

  const { id, clientTxId, endpoint } = await safeJson(req) as {
    id?: number; clientTxId?: string; endpoint?: string;
  };
  if (!id || !clientTxId || !endpoint) {
    return json({ error: 'id, clientTxId y endpoint son requeridos' }, 400);
  }

  const token = process.env.PAYPHONE_TOKEN;
  if (!token) return json({ error: 'PAYPHONE_TOKEN no configurado' }, 500);

  const ppRes = await fetch('https://pay.payphonetodoesposible.com/api/button/V2/Confirm', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'authorization': token },
    body: JSON.stringify({ id, clientTxId })
  });
  const data: any = await ppRes.json().catch(() => ({}));
  const approved = data?.transactionStatus === 'Approved';

  if (!approved) return json({ ok: true, approved: false, payphone: data });

  const unlockUrl = new URL(req.url); unlockUrl.pathname = '/api/quota/unlock';
  const unlockRes = await fetch(unlockUrl.toString(), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-device-id': deviceId },
    body: JSON.stringify({ endpoint })
  });
  const unlockJson = await unlockRes.json().catch(() => ({}));

  return json({ ok: true, approved: true, unlock: unlockJson, payphone: data });
}

/* ===================== Utils ===================== */

function json(data: any, init: number | ResponseInit = 200) {
  const status = typeof init === 'number' ? init : (init as ResponseInit).status || 200;
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS'
    }
  });
}

async function safeJson(req: Request) {
  try { return await req.json(); } catch { return {}; }
}

function uuid() {
  // @ts-ignore
  if (globalThis.crypto && globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function parseCookies(cookieHeader: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  cookieHeader.split(';').forEach(part => {
    const [k, ...rest] = part.trim().split('=');
    if (!k) return;
    out[k] = decodeURIComponent(rest.join('=') || '');
  });
  return out;
}

function getContext(req: Request) {
  const url = new URL(req.url);
  let deviceId =
    req.headers.get('x-device-id') ||
    url.searchParams.get('deviceId') ||
    '';

  const cookies = parseCookies(req.headers.get('cookie'));
  if (!deviceId && cookies.deviceId) deviceId = cookies.deviceId;
  if (!deviceId) deviceId = uuid();

  const d = new Date();
  const dayKey =
    `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  return { deviceId, dayKey, url };
}
