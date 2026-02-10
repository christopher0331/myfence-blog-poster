import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getAdminClient() {
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  }
  if (!supabaseServiceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");
  }
  return createClient(supabaseUrl.trim(), supabaseServiceKey.trim());
}

export async function GET(request: NextRequest) {
  try {
    // Verify environment variables first
    if (!supabaseUrl) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_SUPABASE_URL is not set" },
        { status: 500 }
      );
    }
    if (!supabaseServiceKey) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY is not set" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const scheduledDateGte = searchParams.get("scheduled_date_gte");
    const scheduledDateLte = searchParams.get("scheduled_date_lte");
    const scheduledDateNotNull = searchParams.get("scheduled_date_not_null");

    const client = getAdminClient();
    let query = client.from("blog_drafts").select("*");

    if (status) {
      query = query.eq("status", status);
    }

    if (scheduledDateGte) {
      query = query.gte("scheduled_date", scheduledDateGte);
    }

    if (scheduledDateLte) {
      query = query.lte("scheduled_date", scheduledDateLte);
    }

    if (scheduledDateNotNull === "true") {
      query = query.not("scheduled_date", "is", null);
    }

    const orderBy = searchParams.get("order") || "updated_at";
    const ascending = searchParams.get("ascending") !== "false";
    query = query.order(orderBy, { ascending });

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

    const { data, error } = await client.from("blog_drafts").insert(body).select().single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
