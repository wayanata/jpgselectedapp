import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await ctx.params;

    const job = await prisma.job.findUnique({ where: { slug } });
    if (!job) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let name = "Folder";
    try {
      const body = await req.json();
      if (typeof body?.name === "string" && body.name.trim()) {
        name = body.name.trim().slice(0, 80);
      }
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const maxOrder = await prisma.folder.aggregate({
      where: { jobId: job.id },
      _max: { sortOrder: true },
    });

    const folder = await prisma.folder.create({
      data: {
        jobId: job.id,
        name,
        sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      },
    });

    return NextResponse.json({ folder });
  } catch (e) {
    console.error("[api/public/jobs/folders]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not create folder" },
      { status: 500 }
    );
  }
}
