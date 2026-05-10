import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ jobId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await ctx.params;

  const job = await prisma.job.findFirst({
    where: { id: jobId, customerId: session.user.id },
    include: {
      selections: {
        orderBy: { createdAt: "asc" },
        include: { folder: true },
      },
      folders: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const origin =
    process.env.NEXTAUTH_URL ??
    process.env.AUTH_URL ??
    "http://localhost:3000";

  return NextResponse.json({
    job,
    photographerUrl: `${origin.replace(/\/$/, "")}/p/${job.slug}`,
  });
}
