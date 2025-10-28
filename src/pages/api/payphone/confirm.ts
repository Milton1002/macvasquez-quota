export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') return json({ ok: true });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const { deviceId } = getContext(req);
  const { id, clientTxId, endpoint } = await req.json().catch(() => ({})) as { id?: number, clientTxId?: string, endpoint?: string };
  if (!id || !clientTxId || !endpoint) return json({ error: 'id, clientTxId y endpoint son requeridos' }, 400);

  const token = process.env.PAYPHONE_TOKEN;
  if (!token) return json({ error: 'PAYPHONE_TOKEN no configurado' }, 500);

  const res = await fetch('https://pay.payphonetodoesposible.com/api/button/V2/Confirm', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'authorization': token },
    body: JSON.stringify({ id, clientTxId })
  });
  const data = await res.json().catch(()=> ({}));

  if (data?.transactionStatus === 'Approved') {
    const api = new URL(req.url); api.pathname = '/api/quota/unlock';
    const unlockRes = await fetch(api.toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-device-id': deviceId },
      body: JSON.stringify({ endpoint })
    });
    const unlockJson = await unlockRes.json().catch(()=> ({}));
    return json({ ok: true, approved: true, unlock: unlockJson, payphone: data });
  }
  return json({ ok: true, approved: false, payphone: data });
}

/* utils inline */
import { parse } from 'cookie';
function json(data: any, init: number|ResponseInit = 200) {
  const status = typeof init === 'number' ? init : (init as ResponseInit).status || 200;
  return new Response(JSON.stringify(data), { status, headers: {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS'
  }});
}
function getContext(req: Request) {
  const url = new URL(req.url);
  let deviceId = req.headers.get('x-device-id') || url.searchParams.get('deviceId') || '';
  const cookies = parse(req.headers.get('cookie') || '');
  if (!deviceId && cookies.deviceId) deviceId = cookies.deviceId;
  if (!deviceId) deviceId = crypto.randomUUID();
  const d = new Date(), dayKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return { deviceId, dayKey, url };
}
