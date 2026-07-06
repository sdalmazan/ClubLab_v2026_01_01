import { NextRequest, NextResponse } from "next/server";
import { getVideoAnalysis, saveVideoAnalysis } from "@/services/videoAnalysis";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: matchId } = await params;
    const data = await getVideoAnalysis(matchId);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load video analysis" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: matchId } = await params;
    const videoData = await request.json();
    await saveVideoAnalysis(matchId, videoData);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to save video analysis" },
      { status: 500 }
    );
  }
}
