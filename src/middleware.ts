export { auth as middleware } from "@/lib/auth";

export const config = {
  // Protect all routes except login page, API auth routes, cron jobs, and static assets
  matcher: ["/((?!login|api/auth|api/cron|api/test-gemini|api/test-github|_next/static|_next/image|favicon.ico).*)"],
};
