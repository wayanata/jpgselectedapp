import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listDriveChildrenScoped } from "@/lib/drive";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const jobToken = searchParams.get("jobToken");
  const folderIdParam = searchParams.get("folderId");
  const pageToken = searchParams.get("pageToken") ?? undefined;

  if (!jobToken?.trim()) {
    return NextResponse.json(
      { error: "Missing jobToken (customer pick link)." },
      { status: 400 }
    );
  }

  const job = await prisma.job.findUnique({
    where: { customerToken: jobToken.trim() },
    select: {
      driveFolderId: true,
      photographerId: true,
    },
  });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const folderId = folderIdParam?.trim() || job.driveFolderId;

  try {
    const data = await listDriveChildrenScoped(
      job.photographerId,
      job.driveFolderId,
      folderId,
      pageToken
    );
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Drive error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
