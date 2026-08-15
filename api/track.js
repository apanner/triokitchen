const {
  appendEvent,
  getClientIp,
  lookupGeo
} = require("../lib/store");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const ip = getClientIp(req);
    const geo = await lookupGeo(ip);

    const event = {
      id: body.id || ("evt_" + Math.random().toString(36).slice(2, 10)),
      visitorId: body.visitorId || "anon",
      type: body.type || "page_view",
      timestamp: body.timestamp || new Date().toISOString(),
      device: body.device || "Unknown",
      screen: body.screen || "",
      referrer: body.referrer || "Direct",
      campaign: body.campaign || "none",
      medium: body.medium || "organic",
      path: body.path || "/",
      userAgent: req.headers["user-agent"] || "",
      ip: geo.ip,
      city: geo.city,
      region: geo.region,
      country: geo.country,
      isp: geo.isp,
      data: body.data || {}
    };

    const result = await appendEvent(event);
    return res.status(200).json({
      ok: true,
      id: event.id,
      durable: result.durable,
      total: result.total
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || "Track failed" });
  }
};
