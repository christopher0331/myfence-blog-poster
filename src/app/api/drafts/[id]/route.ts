import { NextRequest, NextResponse } from "next/server";
import { getSiteFromRequest } from "@/lib/get-site";
import { getAdminClient } from "@/lib/supabase-admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const site = await getSiteFromRequest(request);
    const client = getAdminClient();

    const { data, error } = await client
      .from("blog_drafts")
      .select("*")
      .eq("id", id)
      .eq("site_id", site.id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const site = await getSiteFromRequest(request);
    const client = getAdminClient();

    const { data, error } = await client
      .from("blog_drafts")
      .update(body)
      .eq("id", id)
      .eq("site_id", site.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const site = await getSiteFromRequest(request);
    const client = getAdminClient();

    const { error } = await client
      .from("blog_drafts")
      .delete()
      .eq("id", id)
      .eq("site_id", site.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
