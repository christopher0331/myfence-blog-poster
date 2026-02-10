import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

// Create a lazy-initialized client to avoid build-time errors when env vars aren't set
let _supabase: SupabaseClient | null = null;

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_supabase) {
      if (!supabaseUrl || !supabasePublishableKey) {
        // During build/SSG, return a stub that returns empty results
        const stub: any = () => stub;
        stub.then = (resolve: any) => resolve({ data: [], count: 0, error: null });
        stub.select = stub;
        stub.insert = stub;
        stub.update = stub;
        stub.delete = stub;
        stub.eq = stub;
        stub.in = stub;
        stub.not = stub;
        stub.order = stub;
        stub.limit = stub;
        stub.single = () => Promise.resolve({ data: null, error: null });
        stub.from = () => stub;
        return stub[prop as string] || stub;
      }
      _supabase = createClient(supabaseUrl, supabasePublishableKey);
    }
    return (_supabase as any)[prop];
  },
});

/**
 * Server-side client with secret key for admin operations.
 * Only use in API routes / server actions — never expose to client.
 */
export function getServiceClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY!;
  return createClient(supabaseUrl, secretKey);
}
