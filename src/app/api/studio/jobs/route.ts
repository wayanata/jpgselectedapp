import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseDriveFolderId } from "@/lib/drive-folder";
import { getPublicOrigin } from "@/lib/public-origin";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobs = await prisma.job.findMany({
    where: { photographerId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { selections: true } },
    },
  });

  const base = getPublicOrigin();

  const jobsOut = jobs.map((j) => ({
    ...j,
    pickUrl: `${base}/pick/${j.customerToken}`,
    photographerUrl: `${base}/p/${j.slug}`,
  }));

  return NextResponse.json({ jobs: jobsOut });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let title = "Photo selections";
  let driveFolderRaw = "";
  try {
    const body = await req.json();
    if (typeof body?.title === "string" && body.title.trim()) {
      title = body.title.trim().slice(0, 120);
    }
    if (typeof body?.driveFolderId === "string") {
      driveFolderRaw = body.driveFolderId;
    }
  } catch {
    /* empty */
  }

  const driveFolderId = parseDriveFolderId(driveFolderRaw);
  if (!driveFolderId) {
    return NextResponse.json(
      {
        error:
          "Paste a Google Drive folder link or folder ID (the gallery root for this job).",
      },
      { status: 400 }
    );
  }

  const slug = nanoid(18);
  const customerToken = nanoid(24);

  const job = await prisma.job.create({
    data: {
      title,
      slug,
      customerToken,
      driveFolderId,
      photographerId: session.user.id,
    },
  });

  const base = getPublicOrigin();

  return NextResponse.json({
    job,
    pickUrl: `${base}/pick/${job.customerToken}`,
    photographerUrl: `${base}/p/${job.slug}`,
  });
}
