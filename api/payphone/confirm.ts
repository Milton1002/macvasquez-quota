export const config = { runtime: 'edge' };

/**
 * Confirma el pago en PayPhone y, si está Approved,
 * desbloquea la cuota diaria llamando a /api/quota/unlock.
 *
 * Body esperado:
 * {
 *   "id": number,            // id de PayPhone (Confirm)
 *   "clientTxId": string,    // clientTxId que enviaste al crear el botón
 *   "endpoint": "vehicular" | "nombres"   // para qué endpoint se paga
 * }
 *
 * Respuesta:
 *  - { ok:true, approved:true, unlock:{...}, payphone:{...} }
 *  - { ok:true, approved:false, payphone:{...} }
 */
export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') return json({ ok: true });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const { deviceId } = getContext(req);

  // leer body de forma segura
  const { id, clientTxId, endpoint } = await safeJson(req) as {
    id?: number;
    clientTxId?: string;
    endpoint?: string;
  };

  if (!id || !clientTxId || !endpoint) {
    return json({ error: 'id, clientTxId y endpoint son requeridos' }, 400);
  }

  // token PayPhone desde variables de entorno
  const token = process.env.PAYPHONE_TOKEN;
  if (!token) return json({ error: 'PAYPHONE_TOKEN no configurado' }, 500);

  // Confirmar pago en PayPhone
  const ppRes = await fetch('https://pay.payphonetodoesposible.com/api/button/V2/Confirm', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': token
    },
    body: JSON.stringify({ id, clientTxId })
  });

  const data: any = await ppRes.json().catch(() => ({}));
  const approved = data?.transactionStatus === 'Approved';

  if (!approved) {
    // Pago no aprobado
    return json({ ok: true, approved: false, payphone: data });
  }

  // Si fue aprobado, desbloquea la cuota para este deviceId/endpoint
  const unlockUrl = new URL(req.url);
  unlockUrl.pathname = '/api/quota/unlock';

  const unlockRes = await fetch(unlockUrl.toString(), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-device-id': deviceId },
    body: JSON.stringify({ endpoint })
  });

  const unlockJson = await unlockRes.json().catch(() => ({}));

  return json({ ok: true, approved: true, unlock: unlockJson, payphone: data });
}

/* ===================== Utils ===================== */

// (opcional) pequeña validación defensiva del body
async function safeJson(req: Request) {
  try { return await req.json(); } catch { return {}; }
}

function json(data: any, init: number | ResponseInit = 200) {
  const status = typeof init === 'number' ? init : (init as ResponseInit).status || 200;
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // CORS básico para que tu front pueda llamarlo
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS'
    }
  });
}

// Obtiene un deviceId estable: header > query > cookie > UUID
import { parse } from 'cookie';
function getContext(req: Request) {
  const url = new URL(req.url);
  let deviceId =
    req.headers.get('x-device-id') ||
    url.searchParams.get('deviceId') ||
    '';

  const cookies = parse(req.headers.get('cookie') || '');
  if (!deviceId && cookies.deviceId) deviceId = cookies.deviceId;
  if (!deviceId) deviceId = crypto.randomUUID();

  const d = new Date();
  const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;

  return { deviceId, dayKey, url };
}
