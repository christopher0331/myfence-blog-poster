export { auth as middleware } from "@/lib/auth";

export const config = {
  // Protect all routes except login, client feedback submit, feedback API, cron, and static assets
  matcher: ["/((?!login|submit-feedback|api/auth|api/feedback|api/cron|api/test-gemini|api/test-github|_next/static|_next/image|favicon.ico).*)"],
};
