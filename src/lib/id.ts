// src/lib/id.ts
import { parse } from 'cookie';

// Contexto del request: deviceId y fecha (zona Ecuador)
export function getContext(req: Request) {
  const url = new URL(req.url);
  const headers = Object.fromEntries(req.headers.entries());

  // 1) x-device-id (cliente)
  let deviceId = headers['x-device-id'] || url.searchParams.get('deviceId') || '';

  // 2) Cookie fallback
  const cookieHeader = req.headers.get('cookie') || '';
  const cookies = parse(cookieHeader || '');
  if (!deviceId && cookies.deviceId) deviceId = cookies.deviceId;

  // 3) Si no hay, generamos uno (ideal: que siempre lo mande el cliente)
  if (!deviceId) deviceId = crypto.randomUUID();

  // Fecha local (aprox) YYYY-MM-DD
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const dayKey = `${y}-${m}-${d}`;

  return { deviceId, dayKey, headers, url };
}

// Llaves para KV
export function keys(dayKey: string, endpoint: string, deviceId: string) {
  const base = `${dayKey}:${endpoint}:${deviceId}`;
  return {
    countKey: `quota:${base}`,   // contador de consultas de hoy
    unlockKey: `unlock:${base}`  // flag de pago aprobado de hoy
  };
}

// Respuesta JSON con CORS
export function json(data: any, init: number | ResponseInit = 200) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS'
  };
  const status = typeof init === 'number' ? init : (init as ResponseInit).status || 200;
  return new Response(JSON.stringify(data), { status, headers: { ...headers, ...(typeof init === 'object' ? (init as ResponseInit).headers || {} : {}) } });
}
