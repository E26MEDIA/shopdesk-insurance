import { z } from "zod";
import { activateLicense } from "@/lib/license-service";
import { getClientIp, jsonOk } from "@/lib/api-utils";

const schema = z.object({
  licenseKey: z.string().min(10),
  machineFingerprint: z.string().min(8),
  appVersion: z.string().optional(),
  deviceName: z.string().optional(),
  operatingSystem: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const result = await activateLicense({
      ...body,
      ipAddress: getClientIp(request),
    });
    const status = result.code === "ACTIVATION_SUCCESS" ? 200 : 400;
    return jsonOk(result, status);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonOk({ code: "INVALID_LICENSE", message: "Invalid request." }, 400);
    }
    return jsonOk({ code: "INVALID_LICENSE", message: "Activation failed." }, 500);
  }
}
