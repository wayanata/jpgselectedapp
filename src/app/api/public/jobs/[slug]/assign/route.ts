import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Folder, SelectedFile } from "@prisma/client";

/** Plain JSON for Workers / OpenNext (avoid non-JSON-serializable Prisma fields). */
function serializeAssignedFile(
  row: SelectedFile & { folder: Folder | null }
) {
  return {
    id: row.id,
    jobId: row.jobId,
    folderId: row.folderId,
    driveFileId: row.driveFileId,
    name: row.name,
    mimeType: row.mimeType,
    thumbnailLink: row.thumbnailLink,
    webViewLink: row.webViewLink,
    iconLink: row.iconLink,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
    folder: row.folder
      ? {
          id: row.folder.id,
          jobId: row.folder.jobId,
          name: row.folder.name,
          sortOrder: row.folder.sortOrder,
          createdAt:
            row.folder.createdAt instanceof Date
              ? row.folder.createdAt.toISOString()
              : String(row.folder.createdAt),
        }
      : null,
  };
}

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
    let folderId: string | null = null;

    try {
      const raw = await req.text();
      if (!raw.trim()) {
        return NextResponse.json({ error: "Empty body" }, { status: 400 });
      }
      const body = JSON.parse(raw) as Record<string, unknown>;
      if (typeof body?.selectedFileId !== "string" || !body.selectedFileId) {
        return NextResponse.json(
          { error: "selectedFileId required" },
          { status: 400 }
        );
      }
      selectedFileId = body.selectedFileId.trim();
      if (!("folderId" in body)) {
        return NextResponse.json(
          { error: "folderId required (use null for Unsorted)" },
          { status: 400 }
        );
      }
      if (body.folderId === null || body.folderId === undefined) {
        folderId = null;
      } else if (typeof body.folderId === "string") {
        const t = body.folderId.trim();
        folderId = t === "" ? null : t;
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
      data: { folderId },
      include: { folder: true },
    });

    return NextResponse.json({ file: serializeAssignedFile(updated) });
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

/** POST: some stacks mishandle PATCH on Workers. */
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
