// src/lib/id.ts
export function getIdentity(req: Request) {
  const h = req.headers;
  const device = (h.get("x-device-id") || "anon").trim().toLowerCase();
  const ip = h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
  return { id: `${device}@${ip}`, ip };
}

export function dayKey(timeZone = "America/Guayaquil") {
  const d = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const [{ value: y }, , { value: m }, , { value: dy }] = fmt.formatToParts(d);
  return `${y}-${m}-${dy}`;
}
