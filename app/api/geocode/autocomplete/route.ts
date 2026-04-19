import { NextResponse } from "next/server";

import { suggestAddresses } from "@/lib/demo-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json({ suggestions: [] });
  }

  const suggestions = await suggestAddresses(query, 6);
  return NextResponse.json({ suggestions });
}
