import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { deleteMemory } from "@/lib/db/queries/memories";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const userResult = await requireUser(request);
  if (!userResult.ok) {
    return NextResponse.json({ error: userResult.error.message }, { status: 401 });
  }
  const parsed = z.string().uuid().safeParse((await params).id);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid memory id" }, { status: 400 });
  }
  const deleted = await deleteMemory(parsed.data, userResult.value.id);
  if (!deleted) {
    return NextResponse.json({ error: "Memory not found" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
