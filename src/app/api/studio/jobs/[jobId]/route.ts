import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ jobId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await ctx.params;

  const job = await prisma.job.findFirst({
    where: { id: jobId, photographerId: session.user.id },
  });
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let finished: boolean | undefined;
  try {
    const body = (await req.json()) as { finished?: unknown };
    if (typeof body?.finished === "boolean") {
      finished = body.finished;
    } else {
      return NextResponse.json(
        { error: 'Body must include { "finished": true|false }' },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updated = await prisma.job.update({
    where: { id: jobId },
    data: {
      finishedAt: finished ? new Date() : null,
    },
    include: {
      _count: { select: { selections: true } },
    },
  });

  return NextResponse.json({ job: updated });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ jobId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await ctx.params;

  const job = await prisma.job.findFirst({
    where: { id: jobId, photographerId: session.user.id },
    select: { id: true },
  });
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.job.delete({ where: { id: jobId } });

  return new NextResponse(null, { status: 204 });
}
