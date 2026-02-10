import { NextResponse } from "next/server";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasSecretKey = !!process.env.SUPABASE_SECRET_KEY;
  const hasPublishableKey = !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  
  // Check if keys have values (but don't expose them)
  const secretKeyLength = process.env.SUPABASE_SECRET_KEY?.length || 0;
  const publishableKeyLength = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.length || 0;
  const urlLength = supabaseUrl?.length || 0;

  return NextResponse.json({
    status: "ok",
    env: {
      hasSupabaseUrl: !!supabaseUrl,
      supabaseUrlLength: urlLength,
      hasSecretKey: hasSecretKey,
      secretKeyLength: secretKeyLength,
      hasPublishableKey: hasPublishableKey,
      publishableKeyLength: publishableKeyLength,
      secretKeyStartsWith: process.env.SUPABASE_SECRET_KEY?.substring(0, 15) || "not set",
      publishableKeyStartsWith: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.substring(0, 15) || "not set",
    },
  });
}
