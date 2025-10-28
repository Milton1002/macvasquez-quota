// src/pages/api/payphone/confirm.ts
import { json, getContext } from '../../../lib/id';

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') return json({ ok: true });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const { deviceId } = getContext(req);
  const body = await req.json().catch(() => ({}));
  const { id, clientTxId, endpoint } = body;

  if (!id || !clientTxId || !endpoint) {
    return json({ error: 'id, clientTxId y endpoint son requeridos' }, 
