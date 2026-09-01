import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  checkLoginRateLimit,
  getClientIp,
  jsonError,
  jsonOk,
  loginSchema,
  recordLoginAttempt,
} from "@/lib/api-utils";
import { createAdminSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const body = loginSchema.parse(await request.json());
    const email = body.email.toLowerCase();
    const ip = getClientIp(request);

    if (!(await checkLoginRateLimit(email))) {
      return jsonError("TOO_MANY_ATTEMPTS", 429);
    }

    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin || admin.status !== "ACTIVE") {
      await recordLoginAttempt(email, false, ip);
      await writeAuditLog({
        action: "ADMIN_LOGIN_FAILED",
        entityType: "admin",
        metadata: { email },
      });
      return jsonError("INVALID_CREDENTIALS", 401);
    }

    const valid = await bcrypt.compare(body.password, admin.passwordHash);
    if (!valid) {
      await recordLoginAttempt(email, false, ip);
      await writeAuditLog({
        adminId: admin.id,
        action: "ADMIN_LOGIN_FAILED",
        entityType: "admin",
        entityId: admin.id,
      });
      return jsonError("INVALID_CREDENTIALS", 401);
    }

    await recordLoginAttempt(email, true, ip);
    await createAdminSession(admin.id, {
      ipAddress: ip,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });
    await writeAuditLog({
      adminId: admin.id,
      action: "ADMIN_LOGIN",
      entityType: "admin",
      entityId: admin.id,
    });

    return jsonOk({
      admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role },
    });
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError("INVALID_INPUT", 400);
    return jsonError("LOGIN_FAILED", 500);
  }
}
