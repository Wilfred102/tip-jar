import express from 'express';

const router = express.Router();

// In-memory cache for project ID to avoid repeated lookups
let cachedProjectId = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h

async function getProjectId() {
  const now = Date.now();
  if (cachedProjectId && (now - cachedAt) < CACHE_TTL_MS) return cachedProjectId;

  const org = process.env.SENTRY_ORG;
  const projectSlug = process.env.SENTRY_PROJECT_SLUG;
  const token = process.env.SENTRY_API_TOKEN;
  if (!org || !projectSlug || !token) {
    throw new Error('Missing Sentry env: SENTRY_ORG, SENTRY_PROJECT_SLUG, SENTRY_API_TOKEN');
  }

  const url = `https://sentry.io/api/0/projects/${encodeURIComponent(org)}/${encodeURIComponent(projectSlug)}/`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`Sentry project lookup failed ${r.status}: ${body}`);
  }
  const data = await r.json();
  cachedProjectId = data.id; // numeric project id as string
  cachedAt = now;
  return cachedProjectId;
}

// GET /api/monitor/errors -> [{ts: number, count: number}]
router.get('/errors', async (_req, res) => {
  try {
    const token = process.env.SENTRY_API_TOKEN;
    const org = process.env.SENTRY_ORG;
    if (!token || !org) return res.status(500).json({ error: 'Sentry monitoring not configured' });

    const projectId = await getProjectId();

    const params = new URLSearchParams({
      statsPeriod: '14d',
      interval: '1d',
      yAxis: 'event.type:error',
      project: String(projectId),
    });
    const url = `https://sentry.io/api/0/organizations/${encodeURIComponent(org)}/events-stats/?${params.toString()}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) {
      const body = await r.text();
      return res.status(502).json({ error: 'Sentry API error', status: r.status, body });
    }
    const data = await r.json();
    // data format: { intervals: [iso...], groups: [{ by: {}, series: { "event.type:error": [counts...] } }] }
    let out = [];
    if (Array.isArray(data.intervals) && Array.isArray(data.groups) && data.groups[0]?.series?.['event.type:error']) {
      const intervals = data.intervals;
      const counts = data.groups[0].series['event.type:error'];
      out = intervals.map((iso, i) => ({ ts: Date.parse(iso), count: counts[i] ?? 0 }));
    }
    return res.json({ ok: true, series: out });
  } catch (e) {
    console.error('monitor/errors failed:', e);
    return res.status(500).json({ error: 'monitor_failed', message: e?.message || String(e) });
  }
});

export default router;
