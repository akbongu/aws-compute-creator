import { NextResponse } from "next/server";
import { getAWSConfig } from "@/lib/aws-client";

export async function GET() {
  try {
    const config = getAWSConfig();
    return NextResponse.json({
      configured: !!config,
      region: config?.region || null,
    });
  } catch (error: any) {
    return NextResponse.json(
      { configured: false, error: error.message },
      { status: 500 }
    );
  }
}
