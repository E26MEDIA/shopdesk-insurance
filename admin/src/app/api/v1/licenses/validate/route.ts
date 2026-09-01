import { z } from "zod";
import { validateLicense } from "@/lib/license-service";
import { getClientIp, jsonOk } from "@/lib/api-utils";

const schema = z.object({
  token: z.string().min(10),
  machineFingerprint: z.string().min(8),
  appVersion: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const result = await validateLicense({
      ...body,
      ipAddress: getClientIp(request),
    });
    const ok = result.code === "VALIDATION_SUCCESS";
    return jsonOk(result, ok ? 200 : 400);
  } catch {
    return jsonOk({ code: "INVALID_TOKEN", message: "Validation failed." }, 400);
  }
}
