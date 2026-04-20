// Scheduled function that wakes the Next.js cron endpoint on a regular cadence.
// Runs daily at 14:00 UTC (~07:00 PT) — gives the write/schedule task plenty of
// time to finish before any posts are due to go live.

export default async (_req, _context) => {
  const base = process.env.URL || process.env.DEPLOY_URL;
  if (!base) {
    return new Response("Missing URL env", { status: 500 });
  }

  const secret = process.env.CRON_SECRET;
  const res = await fetch(`${base}/api/cron/write-blogs`, {
    method: "GET",
    headers: secret ? { Authorization: `Bearer ${secret}` } : {},
  });

  const text = await res.text();
  console.log(`[cron-write] ${res.status}: ${text.slice(0, 500)}`);
  return new Response(text, { status: res.status });
};

export const config = {
  schedule: "0 14 * * *",
};
