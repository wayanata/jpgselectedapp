import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await ctx.params;

    const job = await prisma.job.findUnique({
      where: { slug },
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

    return NextResponse.json({ job });
  } catch (e) {
    console.error("[api/public/jobs/GET]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not load job" },
      { status: 500 }
    );
  }
}
