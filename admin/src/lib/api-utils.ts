import { NextResponse } from "next/server";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

export function jsonOk(data: unknown, status = 200, headers?: HeadersInit) {
  return NextResponse.json(data, { status, headers });
}

export function jsonError(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export function getClientIp(request: Request): string | undefined {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    undefined
  );
}

export async function checkLoginRateLimit(email: string): Promise<boolean> {
  const { prisma } = await import("./db");
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const failures = await prisma.loginAttempt.count({
    where: {
      email: email.toLowerCase(),
      success: false,
      createdAt: { gte: since },
    },
  });
  return failures < MAX_ATTEMPTS;
}

export async function recordLoginAttempt(
  email: string,
  success: boolean,
  ipAddress?: string,
) {
  const { prisma } = await import("./db");
  await prisma.loginAttempt.create({
    data: { email: email.toLowerCase(), success, ipAddress },
  });
}

export { loginSchema };
