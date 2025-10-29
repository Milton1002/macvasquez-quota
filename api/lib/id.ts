import { parse } from "cookie";

export function getClientIP(req: Request): string {
  const h = req.headers;
  const ip =
    h.get("x-forwarded-for")?.split(",")[0] ||
    h.get("x-real-ip") ||
    h.get("cf-connecting-ip") ||
    "";
  return ip.trim() || "0.0.0.0";
}

export function getContext(req: Request) {
  const url = new URL(req.url);
  let deviceId = req.headers.get("x-device-id") || url.searchParams.get("deviceId") || "";
  const cookies = parse(req.headers.get("cookie") || "");
  if (!deviceId && cookies.deviceId) deviceId = cookies.deviceId;
  if (!deviceId) deviceId = crypto.randomUUID();

  const d = new Date();
  const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

  const ip = getClientIP(req);
  return { deviceId, dayKey, ip, url };
}

export function json(data: any, init: number | ResponseInit = 200) {
  const status = typeof init === "number" ? init : (init as ResponseInit).status || 200;
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
    },
  });
}
