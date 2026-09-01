import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "./db";
import { hashToken } from "./crypto";
import type { Admin, AdminRole } from "@prisma/client";

const SESSION_COOKIE = "e26_admin_session";
const SESSION_DAYS = 7;

export type SessionAdmin = Pick<Admin, "id" | "name" | "email" | "role" | "status">;

export async function createAdminSession(
  adminId: string,
  meta?: { ipAddress?: string; userAgent?: string },
): Promise<string> {
  const token = (await import("./crypto")).generateSessionToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);

  await prisma.adminSession.create({
    data: {
      adminId,
      tokenHash,
      expiresAt,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return token;
}

export async function destroyAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.adminSession.deleteMany({
      where: { tokenHash: hashToken(token) },
    });
  }
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSessionAdmin(): Promise<SessionAdmin | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { admin: true },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.adminSession.delete({ where: { id: session.id } });
    }
    return null;
  }

  if (session.admin.status !== "ACTIVE") return null;

  return {
    id: session.admin.id,
    name: session.admin.name,
    email: session.admin.email,
    role: session.admin.role,
    status: session.admin.status,
  };
}

export function requireRole(admin: SessionAdmin, roles: AdminRole[]): boolean {
  return roles.includes(admin.role);
}

export function unauthorized() {
  return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
}

export { SESSION_COOKIE };
