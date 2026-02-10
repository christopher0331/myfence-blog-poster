import { NextResponse } from "next/server";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const hasAnonKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  // Check if keys have values (but don't expose them)
  const serviceKeyLength = process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0;
  const anonKeyLength = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0;
  const urlLength = supabaseUrl?.length || 0;

  return NextResponse.json({
    status: "ok",
    env: {
      hasSupabaseUrl: !!supabaseUrl,
      supabaseUrlLength: urlLength,
      hasServiceRoleKey: hasServiceKey,
      serviceKeyLength: serviceKeyLength,
      hasAnonKey: hasAnonKey,
      anonKeyLength: anonKeyLength,
      serviceKeyStartsWith: process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 10) || "not set",
      anonKeyStartsWith: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 10) || "not set",
    },
  });
}
