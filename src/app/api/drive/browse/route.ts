import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listDriveChildren } from "@/lib/drive";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const folderId = searchParams.get("folderId") ?? "root";
  const pageToken = searchParams.get("pageToken") ?? undefined;

  try {
    const data = await listDriveChildren(session.user.id, folderId, pageToken);
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Drive error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
