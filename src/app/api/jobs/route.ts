import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobs = await prisma.job.findMany({
    where: { customerId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { selections: true } },
    },
  });

  return NextResponse.json({ jobs });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let title = "Photo selections";
  try {
    const body = await req.json();
    if (typeof body?.title === "string" && body.title.trim()) {
      title = body.title.trim().slice(0, 120);
    }
  } catch {
    /* empty body */
  }

  const slug = nanoid(18);

  const job = await prisma.job.create({
    data: {
      title,
      slug,
      customerId: session.user.id,
    },
  });

  return NextResponse.json({ job });
}
