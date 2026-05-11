import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPublicOrigin } from "@/lib/public-origin";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ customerToken: string }> }
) {
  const { customerToken } = await ctx.params;

  const job = await prisma.job.findUnique({
    where: { customerToken },
    include: {
      selections: {
        orderBy: { createdAt: "asc" },
        include: { folder: true },
      },
      folders: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const base = getPublicOrigin();

  return NextResponse.json({
    job,
    photographerUrl: `${base}/p/${job.slug}`,
    pickUrl: `${base}/pick/${job.customerToken}`,
    driveFolderId: job.driveFolderId,
  });
}
