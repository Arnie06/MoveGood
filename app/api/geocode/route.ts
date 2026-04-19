import { NextResponse } from "next/server";

import { evaluateManualAddress } from "@/lib/demo-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address")?.trim();

  if (!address) {
    return NextResponse.json({ error: "Address is required." }, { status: 400 });
  }

  const result = await evaluateManualAddress(address);
  if (!result) {
    return NextResponse.json({ error: "Address could not be geocoded." }, { status: 404 });
  }

  return NextResponse.json({ result });
}
