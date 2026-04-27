// Scheduled function that checks for due drafts and publishes them.
// Runs every 5 minutes so posts go live shortly after their scheduled time.

export default async (_req, _context) => {
  const base = process.env.URL || process.env.DEPLOY_URL;
  if (!base) {
    return new Response("Missing URL env", { status: 500 });
  }

  const secret = process.env.CRON_SECRET;
  const res = await fetch(`${base}/api/cron/publish-blogs`, {
    method: "GET",
    headers: secret ? { Authorization: `Bearer ${secret}` } : {},
  });

  const text = await res.text();
  console.log(`[cron-publish] ${res.status}: ${text.slice(0, 500)}`);
  return new Response(text, { status: res.status });
};

export const config = {
  schedule: "*/5 * * * *",
};
