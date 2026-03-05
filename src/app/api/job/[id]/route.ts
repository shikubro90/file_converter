import { NextRequest, NextResponse } from "next/server";
import { Job } from "bullmq";
import { conversionQueue } from "@/lib/queue";

type JobStatus = "queued" | "processing" | "done" | "failed";

function mapState(state: string): JobStatus {
  if (state === "active") return "processing";
  if (state === "completed") return "done";
  if (state === "failed") return "failed";
  return "queued"; // waiting, delayed, paused, unknown
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const bullJob = await Job.fromId(conversionQueue, params.id);
  if (!bullJob) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const state = await bullJob.getState();
  const status = mapState(state);
  const progress = status === "done" ? 100 : (typeof bullJob.progress === "number" ? bullJob.progress : 0);

  return NextResponse.json({
    id: bullJob.id,
    fileId: bullJob.data.fileId,
    inputPath: bullJob.data.inputPath,
    outputPath: bullJob.data.outputPath,
    status,
    progress,
    ...(status === "failed" && { error: bullJob.failedReason }),
  });
}
