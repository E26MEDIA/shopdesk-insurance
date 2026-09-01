import { getLicenseFromToken } from "@/lib/license-service";
import { jsonError, jsonOk } from "@/lib/api-utils";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return jsonError("UNAUTHORIZED", 401);

  try {
    const payload = await getLicenseFromToken(token);
    return jsonOk({
      code: "VALIDATION_SUCCESS",
      license: {
        licenseId: payload.licenseId,
        licenseDisplayId: payload.licenseDisplayId,
        shopId: payload.shopId,
        shopCode: payload.shopCode,
        shopName: payload.shopName,
        deviceId: payload.deviceId,
        productId: payload.productId,
        productName: payload.productName,
        edition: payload.edition,
        modules: payload.modules,
        expiryDate: payload.expiryDate,
        offlineUntil: payload.offlineUntil,
        issuedAt: payload.issuedAt,
      },
    });
  } catch {
    return jsonError("INVALID_TOKEN", 401);
  }
}
