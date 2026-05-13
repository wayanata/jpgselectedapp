import { zipSync } from "fflate";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  assertDriveFileInJobTree,
  fetchDriveFileBytes,
  getPhotographerDriveAccessToken,
  zipEntryFilename,
} from "@/lib/drive";

const MAX_FILES = 60;
const MAX_TOTAL_BYTES = 95 * 1024 * 1024;

function slugZipName(title: string): string {
  const s = title.replace(/[/\\?*:|"<>]/g, "_").trim().slice(0, 48) || "selections";
  return `${s}.zip`;
}

function uniqueZipPath(used: Map<string, number>, filename: string): string {
  const lower = filename.toLowerCase();
  const count = used.get(lower) ?? 0;
  used.set(lower, count + 1);
  if (count === 0) return filename;
  const suffix = ` (${count})`;
  const dot = filename.lastIndexOf(".");
  if (dot > 0) {
    return `${filename.slice(0, dot)}${suffix}${filename.slice(dot)}`;
  }
  return `${filename}${suffix}`;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await ctx.params;

    const job = await prisma.job.findUnique({
      where: { slug },
      select: {
        id: true,
        title: true,
        driveFolderId: true,
        photographerId: true,
      },
    });
    if (!job) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let selectedFileIds: string[] = [];
    try {
      const raw = await req.text();
      if (!raw.trim()) {
        return NextResponse.json({ error: "Empty body" }, { status: 400 });
      }
      const body = JSON.parse(raw) as { selectedFileIds?: unknown };
      if (!Array.isArray(body?.selectedFileIds)) {
        return NextResponse.json(
          { error: "selectedFileIds array required" },
          { status: 400 }
        );
      }
      selectedFileIds = body.selectedFileIds.filter(
        (id): id is string => typeof id === "string" && id.length > 0
      );
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const uniqueIds = [...new Set(selectedFileIds)];
    if (uniqueIds.length === 0) {
      return NextResponse.json(
        { error: "Select at least one image to download." },
        { status: 400 }
      );
    }
    if (uniqueIds.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Too many files at once (max ${MAX_FILES}).` },
        { status: 400 }
      );
    }

    const selections = await prisma.selectedFile.findMany({
      where: {
        jobId: job.id,
        id: { in: uniqueIds },
      },
      select: {
        id: true,
        driveFileId: true,
        name: true,
      },
    });

    if (selections.length !== uniqueIds.length) {
      return NextResponse.json(
        { error: "Some selections were not found for this job." },
        { status: 400 }
      );
    }

    const accessToken = await getPhotographerDriveAccessToken(
      job.photographerId
    );

    const zipFiles: Record<string, Uint8Array> = {};
    const usedNames = new Map<string, number>();
    let totalBytes = 0;

    for (const sel of selections) {
      const meta = await assertDriveFileInJobTree(
        accessToken,
        sel.driveFileId,
        job.driveFolderId
      );
      const sizeGuess = meta.size ? Number.parseInt(meta.size, 10) : NaN;
      if (!Number.isNaN(sizeGuess) && totalBytes + sizeGuess > MAX_TOTAL_BYTES) {
        return NextResponse.json(
          {
            error: `Total download size would exceed ${Math.floor(MAX_TOTAL_BYTES / (1024 * 1024))} MiB. Download fewer files or smaller items.`,
          },
          { status: 400 }
        );
      }

      const bytes = await fetchDriveFileBytes(
        accessToken,
        sel.driveFileId,
        meta.mimeType
      );
      totalBytes += bytes.byteLength;
      if (totalBytes > MAX_TOTAL_BYTES) {
        return NextResponse.json(
          {
            error: `Total download size exceeds ${Math.floor(MAX_TOTAL_BYTES / (1024 * 1024))} MiB. Try fewer files.`,
          },
          { status: 400 }
        );
      }

      const baseName = zipEntryFilename(sel.name || meta.name, meta.mimeType);
      const pathInZip = uniqueZipPath(usedNames, baseName);
      zipFiles[pathInZip] = bytes;
    }

    // Use zipSync: async `zip()` from fflate spawns Web Workers (Blob URLs), which
    // Cloudflare Workers do not support ("The Worker method is not implemented").
    const zipped = zipSync(zipFiles, { level: 6 });

    const filename = slugZipName(job.title);

    const body = new Uint8Array(zipped.byteLength);
    body.set(zipped);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[api/public/jobs/download]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Download failed" },
      { status: 500 }
    );
  }
}
