import { jsonOk } from "@/lib/api-utils";
import { destroyAdminSession, getSessionAdmin } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function POST() {
  const admin = await getSessionAdmin();
  if (admin) {
    await writeAuditLog({
      adminId: admin.id,
      action: "ADMIN_LOGOUT",
      entityType: "admin",
      entityId: admin.id,
    });
  }
  await destroyAdminSession();
  return jsonOk({ ok: true });
}

export async function GET() {
  const admin = await getSessionAdmin();
  if (!admin) return jsonOk({ admin: null });
  return jsonOk({ admin });
}
