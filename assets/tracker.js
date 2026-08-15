/**
 * Trio Kitchen — Visitor analytics tracker
 * Sends events to Vercel /api/track (IP + geo resolved server-side).
 * Also keeps a local cache so admin works offline / before deploy.
 */
(function () {
  "use strict";

  const STORAGE_KEY = "trio_analytics_events";
  const VISITOR_KEY = "trio_visitor_id";
  const API_URL = "/api/track";

  let visitorId = localStorage.getItem(VISITOR_KEY);
  if (!visitorId) {
    visitorId = "vis_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    localStorage.setItem(VISITOR_KEY, visitorId);
  }

  const urlParams = new URLSearchParams(window.location.search);
  let refHost = "Direct";
  try {
    if (document.referrer) refHost = new URL(document.referrer).hostname || "Direct";
  } catch (e) {
    refHost = document.referrer || "Direct";
  }

  const utmSource = urlParams.get("utm_source") || refHost;
  const utmMedium = urlParams.get("utm_medium") || "organic";
  const utmCampaign = urlParams.get("utm_campaign") || "none";

  function getDeviceType() {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return "Tablet";
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(ua)) {
      return "Mobile";
    }
    return "Desktop";
  }

  function cacheLocal(payload) {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    existing.push(payload);
    if (existing.length > 2000) existing.splice(0, existing.length - 2000);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    window.dispatchEvent(new CustomEvent("trio_event_logged", { detail: payload }));
  }

  function sendToServer(payload) {
    const body = JSON.stringify(payload);
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        const ok = navigator.sendBeacon(API_URL, blob);
        if (ok) return;
      }
    } catch (e) {}

    fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body,
      keepalive: true
    }).catch(function () {});
  }

  function logEvent(eventType, eventData) {
    const payload = {
      id: "evt_" + Math.random().toString(36).substr(2, 9),
      visitorId: visitorId,
      type: eventType,
      timestamp: new Date().toISOString(),
      device: getDeviceType(),
      screen: window.innerWidth + "x" + window.innerHeight,
      referrer: utmSource,
      campaign: utmCampaign,
      medium: utmMedium,
      path: window.location.pathname,
      data: eventData || {}
    };

    cacheLocal(payload);
    sendToServer(payload);
  }

  window.TrioAnalytics = {
    track: logEvent,
    getEvents: function () {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    },
    clearEvents: function () {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  logEvent("page_view", {
    title: document.title,
    url: window.location.href
  });
})();
