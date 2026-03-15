import { NextResponse } from "next/server";
import { getSites } from "@/lib/get-site";

export async function GET() {
  try {
    const sites = await getSites();
    return NextResponse.json({ success: true, sites });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to load sites" },
      { status: 500 },
    );
  }
}
