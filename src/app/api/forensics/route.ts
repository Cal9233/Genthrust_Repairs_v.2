import { runConditionForensics } from "@/app/actions/forensics";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const result = await runConditionForensics();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Forensics error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
