import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  assertDriveFileInJobTree,
  fetchDriveFileBytes,
  getPhotographerDriveAccessToken,
} from "@/lib/drive";

function inferImageMimeType(name: string, mimeType: string): string | null {
  if (mimeType.startsWith("image/")) return mimeType;
  const lower = name.toLowerCase();
  if (/\.(jpe?g)$/.test(lower)) return "image/jpeg";
  if (/\.png$/.test(lower)) return "image/png";
  if (/\.webp$/.test(lower)) return "image/webp";
  if (/\.gif$/.test(lower)) return "image/gif";
  if (/\.bmp$/.test(lower)) return "image/bmp";
  if (/\.avif$/.test(lower)) return "image/avif";
  if (/\.heic$/.test(lower)) return "image/heic";
  if (/\.heif$/.test(lower)) return "image/heif";
  if (/\.tiff?$/.test(lower)) return "image/tiff";
  return null;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ customerToken: string }> }
) {
  try {
    const { customerToken } = await ctx.params;
    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get("fileId")?.trim();
    if (!fileId) {
      return NextResponse.json({ error: "Missing fileId" }, { status: 400 });
    }

    const job = await prisma.job.findUnique({
      where: { customerToken },
      select: {
        driveFolderId: true,
        photographerId: true,
      },
    });
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const accessToken = await getPhotographerDriveAccessToken(job.photographerId);
    const meta = await assertDriveFileInJobTree(
      accessToken,
      fileId,
      job.driveFolderId
    );
    const contentType = inferImageMimeType(meta.name, meta.mimeType);
    if (!contentType) {
      return NextResponse.json(
        { error: "Requested file is not an image" },
        { status: 400 }
      );
    }

    const bytes = await fetchDriveFileBytes(accessToken, fileId, meta.mimeType);
    const body = new Blob([bytes], { type: contentType });
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=120",
      },
    });
  } catch (e) {
    console.error("[api/pick/preview]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Preview failed" },
      { status: 500 }
    );
  }
}
