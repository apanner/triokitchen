const BLOB_PATH = "trio-analytics-events.json";
const MAX_EVENTS = 5000;

/** @type {any[]} */
let memoryEvents = [];

function getAdminPin() {
  return process.env.ADMIN_PIN || "2026";
}

function assertAdmin(req) {
  const pin = req.headers["x-admin-pin"] || req.query?.pin || "";
  if (String(pin) !== getAdminPin()) {
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }
}

async function loadEvents() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return memoryEvents;

  try {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: BLOB_PATH, limit: 1, token });
    if (!blobs.length) return memoryEvents;

    const res = await fetch(blobs[0].url, { cache: "no-store" });
    if (!res.ok) return memoryEvents;
    const data = await res.json();
    if (Array.isArray(data)) {
      memoryEvents = data;
      return memoryEvents;
    }
  } catch (e) {
    console.error("loadEvents failed", e.message);
  }
  return memoryEvents;
}

async function saveEvents(events) {
  memoryEvents = events.slice(-MAX_EVENTS);
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return { ok: true, durable: false };

  try {
    const { put } = await import("@vercel/blob");
    await put(BLOB_PATH, JSON.stringify(memoryEvents), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      token
    });
    return { ok: true, durable: true };
  } catch (e) {
    console.error("saveEvents failed", e.message);
    return { ok: true, durable: false, error: e.message };
  }
}

async function appendEvent(event) {
  const events = await loadEvents();
  events.push(event);
  const result = await saveEvents(events);
  return { event, ...result, total: events.length };
}

function getClientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length) return xf.split(",")[0].trim();
  const real = req.headers["x-real-ip"];
  if (typeof real === "string" && real.length) return real;
  return req.socket?.remoteAddress || "";
}

async function lookupGeo(ip) {
  const fallback = {
    ip: ip || "unknown",
    city: "Unknown",
    region: "Unknown",
    country: "Unknown",
    isp: "Unknown"
  };
  if (!ip || ip === "::1" || ip.startsWith("127.") || ip === "unknown") {
    return { ...fallback, city: "Local", region: "Dev", country: "Local", isp: "Localhost" };
  }

  try {
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      headers: { Accept: "application/json" }
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    if (data.error) return fallback;
    return {
      ip: data.ip || ip,
      city: data.city || "Unknown",
      region: data.region || data.region_code || "Unknown",
      country: data.country_name || data.country || "Unknown",
      isp: data.org || data.asn || "Unknown"
    };
  } catch {
    return fallback;
  }
}

function aggregateStats(events) {
  const pageViews = events.filter((e) => e.type === "page_view");
  const visits = pageViews.length || events.length;
  const uniques = new Set(events.map((e) => e.visitorId).filter(Boolean)).size;
  const interac = events.filter((e) => e.type === "copy_interac_email").length;
  const banks = events.filter((e) => e.type === "bank_clicked" || e.type === "bank_app_launched");
  const reviews = events.filter((e) => e.type === "google_review_clicked").length;
  const cartAdds = events.filter((e) => e.type === "add_to_cart");

  const bankCounts = {};
  banks.forEach((e) => {
    const name = (e.data && (e.data.bank || e.data.bankId)) || "Unknown";
    bankCounts[name] = (bankCounts[name] || 0) + 1;
  });
  const topBank = Object.entries(bankCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

  const cities = {};
  events.forEach((e) => {
    const key = `${e.city || "Unknown"}, ${e.region || ""}`.trim();
    cities[key] = (cities[key] || 0) + 1;
  });

  const sources = {};
  events.forEach((e) => {
    const s = e.referrer || "Direct";
    sources[s] = (sources[s] || 0) + 1;
  });

  const devices = {};
  events.forEach((e) => {
    const d = e.device || "Unknown";
    devices[d] = (devices[d] || 0) + 1;
  });

  const dishes = {};
  cartAdds.forEach((e) => {
    const name = (e.data && e.data.name) || "Item";
    dishes[name] = (dishes[name] || 0) + 1;
  });

  const byHour = {};
  events.forEach((e) => {
    const d = new Date(e.timestamp);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:00`;
    byHour[key] = (byHour[key] || 0) + 1;
  });

  return {
    visits,
    uniques,
    interac,
    bankClicks: banks.length,
    reviews,
    cartAdds: cartAdds.length,
    conversion: visits > 0 ? Number(((interac / visits) * 100).toFixed(1)) : 0,
    topBank,
    bankCounts,
    cities,
    sources,
    devices,
    dishes,
    byHour,
    totalEvents: events.length,
    durable: Boolean(process.env.BLOB_READ_WRITE_TOKEN)
  };
}

module.exports = {
  assertAdmin,
  getAdminPin,
  loadEvents,
  saveEvents,
  appendEvent,
  getClientIp,
  lookupGeo,
  aggregateStats,
  MAX_EVENTS
};
