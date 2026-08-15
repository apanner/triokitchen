const { assertAdmin, loadEvents } = require("../lib/store");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-pin");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    assertAdmin(req);
    const events = await loadEvents();
    const limit = Math.min(Number(req.query?.limit) || 100, 500);
    const recent = [...events].reverse().slice(0, limit);
    return res.status(200).json({
      ok: true,
      count: events.length,
      events: recent
    });
  } catch (e) {
    const code = e.statusCode || 500;
    return res.status(code).json({ error: e.message || "Events failed" });
  }
};
