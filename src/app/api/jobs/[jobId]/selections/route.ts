import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type IncomingFile = {
  driveFileId: string;
  name: string;
  mimeType?: string | null;
  thumbnailLink?: string | null;
  webViewLink?: string | null;
  iconLink?: string | null;
};

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ jobId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await ctx.params;

  const job = await prisma.job.findFirst({
    where: { id: jobId, customerId: session.user.id },
  });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  let files: IncomingFile[] = [];
  try {
    const body = await req.json();
    files = Array.isArray(body?.files) ? body.files : [];
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const normalized = files
    .filter((f) => f?.driveFileId && f?.name)
    .map((f) => ({
      driveFileId: String(f.driveFileId),
      name: String(f.name).slice(0, 512),
      mimeType: f.mimeType ?? null,
      thumbnailLink: f.thumbnailLink ?? null,
      webViewLink: f.webViewLink ?? null,
      iconLink: f.iconLink ?? null,
    }));

  const incomingIds = new Set(normalized.map((f) => f.driveFileId));

  await prisma.$transaction(async (tx) => {
    await tx.selectedFile.deleteMany({
      where: {
        jobId,
        driveFileId: { notIn: [...incomingIds] },
      },
    });

    for (const f of normalized) {
      await tx.selectedFile.upsert({
        where: {
          jobId_driveFileId: {
            jobId,
            driveFileId: f.driveFileId,
          },
        },
        create: {
          jobId,
          driveFileId: f.driveFileId,
          name: f.name,
          mimeType: f.mimeType,
          thumbnailLink: f.thumbnailLink,
          webViewLink: f.webViewLink,
          iconLink: f.iconLink,
        },
        update: {
          name: f.name,
          mimeType: f.mimeType,
          thumbnailLink: f.thumbnailLink,
          webViewLink: f.webViewLink,
          iconLink: f.iconLink,
        },
      });
    }

    await tx.job.update({
      where: { id: jobId },
      data: { updatedAt: new Date() },
    });
  });

  const selections = await prisma.selectedFile.findMany({
    where: { jobId },
    orderBy: { createdAt: "asc" },
    include: { folder: true },
  });

  return NextResponse.json({ selections });
}
