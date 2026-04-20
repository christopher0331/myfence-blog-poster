import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Shared admin (service-role) Supabase client for server-only code.
 * Cached on a module-level singleton to avoid recreating the client per request.
 */
let cached: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  if (!secret) throw new Error("SUPABASE_SECRET_KEY is not set");

  cached = createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
