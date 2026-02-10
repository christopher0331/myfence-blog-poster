import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

function getAdminClient() {
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  }
  if (!supabaseSecretKey) {
    throw new Error("SUPABASE_SECRET_KEY is not set");
  }
  
  const url = supabaseUrl.trim();
  const key = supabaseSecretKey.trim();
  
  // Create client with auth configuration for secret key (bypasses RLS)
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderBy = searchParams.get("order") || "priority";
    const ascending = searchParams.get("ascending") !== "false";

    const client = getAdminClient();
    let query = client.from("blog_topics").select("*");
    
    // Handle multiple order fields (priority desc, created_at desc)
    if (orderBy === "priority") {
      query = query.order("priority", { ascending: false });
      query = query.order("created_at", { ascending: false });
    } else {
      query = query.order(orderBy, { ascending });
    }

    const { data, error } = await query;

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { 
          error: error.message,
          details: error.details || null,
          hint: error.hint || null
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error("API route error:", error);
    return NextResponse.json(
      { 
        error: error.message || "Internal server error",
        type: error.constructor.name
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const client = getAdminClient();

    const { data, error } = await client.from("blog_topics").insert(body).select().single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
