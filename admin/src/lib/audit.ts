import { prisma } from "./db";
import type { AdminRole } from "@prisma/client";

export async function writeAuditLog(input: {
  adminId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      adminId: input.adminId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? undefined,
    },
  });
}

export function canManageAdmins(role: AdminRole): boolean {
  return role === "SUPER_ADMIN";
}

export function canManageProducts(role: AdminRole): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

export function canCreateLicense(role: AdminRole): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

export function canSuspendLicense(role: AdminRole): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

export function canDeactivateDevice(role: AdminRole): boolean {
  return role !== "SUPPORT" || true; // SUPPORT can deactivate per spec
}

export function canViewOnly(role: AdminRole): boolean {
  return role === "SUPPORT";
}
