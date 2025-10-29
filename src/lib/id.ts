import { parse } from 'cookie';

// Devuelve deviceId + fecha YYYY-MM-DD + objetos útiles
export function getContext(req: Request) {
  const url = new URL(req.url);
  const headers = Object.fromEntries(req.headers.entries());

  let deviceId = headers['x-device-id'] || url.searchParams.get('deviceId') || '';
  const cookieHeader = req.headers.get('cookie') || '';
  const cookies = parse(cookieHeader);
  if (!deviceId && cookies.deviceId) deviceId = cookies.deviceId;
  if (!deviceId) deviceId = crypto.randomUUID();

  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const dayKey = `${y}-${m}-${d}`;

  return { deviceId, dayKey, headers, url };
}

export function keys(dayKey: string, endpoint: string, deviceId: string) {
  const base = `${dayKey}:${endpoint}:${deviceId}`;
  return {
    countKey: `quota:${base}`,
    unlockKey: `unlock:${base}`
  };
}

export function json(data: any, init: number | ResponseInit = 200) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS'
  };
  const status = typeof init === 'number' ? init :
