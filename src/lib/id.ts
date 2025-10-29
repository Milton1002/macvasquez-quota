// src/lib/id.ts
import type { VercelRequest } from '@vercel/node';

export function getClientIp(req: VercelRequest): string {
  const xf = (req.headers['x-forwarded-for'] || '') as string;
  const first = xf.split(',')[0]?.trim();
  return first || (req.socket?.remoteAddress || '0.0.0.0');
}

export function getDeviceId(req: VercelRequest): string {
  return (req.headers['x-device-id'] as string)?.trim() || '';
}

export function todayISO(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function secondsUntilTomorrowUTC(): number {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0
  ));
  return Math.max(1, Math.floor((+tomorrow - +now) / 1000));
}
