import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function runAssign(
  req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await ctx.params;

    const job = await prisma.job.findUnique({ where: { slug } });
    if (!job) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let selectedFileId: string | undefined;
    let folderId: string | null | undefined;

    try {
      const body = await req.json();
      if (typeof body?.selectedFileId !== "string" || !body.selectedFileId) {
        return NextResponse.json(
          { error: "selectedFileId required" },
          { status: 400 }
        );
      }
      selectedFileId = body.selectedFileId;
      if (!("folderId" in body)) {
        return NextResponse.json(
          { error: "folderId required (use null for Unsorted)" },
          { status: 400 }
        );
      }
      if (body.folderId === null) {
        folderId = null;
      } else if (typeof body.folderId === "string") {
        folderId = body.folderId;
      } else {
        return NextResponse.json({ error: "Invalid folderId" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const file = await prisma.selectedFile.findFirst({
      where: { id: selectedFileId, jobId: job.id },
    });
    if (!file) {
      return NextResponse.json({ error: "File not in job" }, { status: 404 });
    }

    if (folderId) {
      const folder = await prisma.folder.findFirst({
        where: { id: folderId, jobId: job.id },
      });
      if (!folder) {
        return NextResponse.json({ error: "Invalid folder" }, { status: 400 });
      }
    }

    const updated = await prisma.selectedFile.update({
      where: { id: selectedFileId },
      data: { folderId: folderId ?? null },
      include: { folder: true },
    });

    return NextResponse.json({ file: updated });
  } catch (e) {
    console.error("[api/public/jobs/assign]", e);
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Could not update assignment",
      },
      { status: 500 }
    );
  }
}

/** POST duplicate: some networks strip or mishandle PATCH; client uses POST first. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  return runAssign(req, ctx);
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  return runAssign(req, ctx);
}
