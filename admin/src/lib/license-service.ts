import {
  ActivationResult,
  ActivationType,
  DeviceStatus,
  LicenseStatus,
  type License,
  type Shop,
  type Product,
  type Device,
  type Prisma,
} from "@prisma/client";
import { prisma } from "./db";
import { hashFingerprint, hashLicenseKey } from "./crypto";
import {
  addDays,
  getOfflineGraceDays,
  getProductModules,
  isLicenseExpired,
} from "./settings";
import { signLicenseToken, type LicenseTokenPayload } from "./jwt";

export type ApiCode =
  | "ACTIVATION_SUCCESS"
  | "VALIDATION_SUCCESS"
  | "INVALID_LICENSE"
  | "LICENSE_EXPIRED"
  | "LICENSE_SUSPENDED"
  | "LICENSE_REVOKED"
  | "DEVICE_LIMIT_REACHED"
  | "DEVICE_NOT_AUTHORIZED"
  | "INVALID_TOKEN";

type LicenseWithRelations = License & {
  shop: Shop;
  product: Product;
};

export type ActivationResponse = {
  code: ApiCode;
  message: string;
  token?: string;
  license?: {
    licenseId: string;
    licenseDisplayId: string;
    shopName: string;
    productName: string;
    edition: string;
    modules: string[];
    expiryDate: string | null;
    offlineUntil: string;
  };
};

async function buildToken(
  license: LicenseWithRelations,
  device: Device,
  modules: string[],
): Promise<{ token: string; payload: LicenseTokenPayload }> {
  const graceDays = await getOfflineGraceDays();
  const now = new Date();
  const offlineUntil = addDays(now, graceDays);

  const payload: LicenseTokenPayload = {
    licenseId: license.id,
    licenseDisplayId: license.licenseDisplayId,
    shopId: license.shopId,
    shopCode: license.shop.shopCode,
    shopName: license.shop.name,
    deviceId: device.id,
    productId: license.productId,
    productName: license.product.name,
    edition: license.edition,
    modules,
    expiryDate: license.expiryDate?.toISOString() ?? null,
    offlineUntil: offlineUntil.toISOString(),
    issuedAt: now.toISOString(),
  };

  const token = await signLicenseToken(payload);
  return { token, payload };
}

async function logActivation(input: {
  licenseId: string;
  deviceId?: string;
  activationType: ActivationType;
  result: ActivationResult;
  ipAddress?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  await prisma.activation.create({
    data: {
      licenseId: input.licenseId,
      deviceId: input.deviceId,
      activationType: input.activationType,
      result: input.result,
      ipAddress: input.ipAddress,
      metadata: input.metadata ?? undefined,
    },
  });
}

function licenseStatusCode(
  status: LicenseStatus,
  expiryDate: Date | null,
): ApiCode | null {
  if (status === "REVOKED") return "LICENSE_REVOKED";
  if (status === "SUSPENDED") return "LICENSE_SUSPENDED";
  if (status === "EXPIRED" || isLicenseExpired(expiryDate)) return "LICENSE_EXPIRED";
  // PENDING is the normal state for a new license awaiting first activation.
  return null;
}

function licenseStatusMessage(code: ApiCode): string {
  switch (code) {
    case "LICENSE_REVOKED":
      return "License has been revoked.";
    case "LICENSE_SUSPENDED":
      return "License is suspended.";
    case "LICENSE_EXPIRED":
      return "License has expired.";
    case "INVALID_LICENSE":
      return "License key not found or not valid.";
    default:
      return "License is not valid.";
  }
}

export async function activateLicense(input: {
  licenseKey: string;
  machineFingerprint: string;
  appVersion?: string;
  deviceName?: string;
  operatingSystem?: string;
  ipAddress?: string;
}): Promise<ActivationResponse> {
  const keyHash = hashLicenseKey(input.licenseKey);
  const fpHash = hashFingerprint(input.machineFingerprint);

  const license = await prisma.license.findUnique({
    where: { licenseKeyHash: keyHash },
    include: { shop: true, product: true, devices: true },
  });

  if (!license) {
    return { code: "INVALID_LICENSE", message: "License key not found." };
  }

  const statusCode = licenseStatusCode(license.status, license.expiryDate);
  if (statusCode) {
    await logActivation({
      licenseId: license.id,
      activationType: "ACTIVATE",
      result: statusCode as ActivationResult,
      ipAddress: input.ipAddress,
    });
    return {
      code: statusCode,
      message: licenseStatusMessage(statusCode),
    };
  }

  const existing = license.devices.find(
    (d) => d.machineFingerprintHash === fpHash,
  );

  if (existing) {
    if (existing.status === "DEACTIVATED") {
      await logActivation({
        licenseId: license.id,
        deviceId: existing.id,
        activationType: "ACTIVATE",
        result: "DEVICE_NOT_AUTHORIZED",
        ipAddress: input.ipAddress,
      });
      return {
        code: "DEVICE_NOT_AUTHORIZED",
        message: "This device was deactivated. Contact E26 support.",
      };
    }

    const device = await prisma.device.update({
      where: { id: existing.id },
      data: {
        lastValidatedAt: new Date(),
        appVersion: input.appVersion,
        deviceName: input.deviceName ?? existing.deviceName,
        operatingSystem: input.operatingSystem ?? existing.operatingSystem,
      },
    });

    const modules = await getProductModules(license.productId, license.edition);
    const { token, payload } = await buildToken(license, device, modules);

    if (license.status === "PENDING") {
      await prisma.license.update({
        where: { id: license.id },
        data: { status: "ACTIVE" },
      });
    }

    await logActivation({
      licenseId: license.id,
      deviceId: device.id,
      activationType: "ACTIVATE",
      result: "SUCCESS",
      ipAddress: input.ipAddress,
      metadata: { reactivation: true },
    });

    return {
      code: "ACTIVATION_SUCCESS",
      message: "Device reactivated successfully.",
      token,
      license: {
        licenseId: payload.licenseId,
        licenseDisplayId: payload.licenseDisplayId,
        shopName: payload.shopName,
        productName: payload.productName,
        edition: payload.edition,
        modules: payload.modules,
        expiryDate: payload.expiryDate,
        offlineUntil: payload.offlineUntil,
      },
    };
  }

  const activeCount = license.devices.filter((d) => d.status === "ACTIVE").length;
  if (activeCount >= license.allowedDevices) {
    await logActivation({
      licenseId: license.id,
      activationType: "ACTIVATE",
      result: "DEVICE_LIMIT_REACHED",
      ipAddress: input.ipAddress,
      metadata: { allowed: license.allowedDevices, active: activeCount },
    });
    return {
      code: "DEVICE_LIMIT_REACHED",
      message: `Device limit reached (${license.allowedDevices}). Contact E26 to replace a device.`,
    };
  }

  const device = await prisma.device.create({
    data: {
      licenseId: license.id,
      shopId: license.shopId,
      machineFingerprintHash: fpHash,
      deviceName: input.deviceName,
      operatingSystem: input.operatingSystem,
      appVersion: input.appVersion,
      status: "ACTIVE",
      lastValidatedAt: new Date(),
    },
  });

  const modules = await getProductModules(license.productId, license.edition);
  const { token, payload } = await buildToken(license, device, modules);

  await prisma.license.update({
    where: { id: license.id },
    data: { status: "ACTIVE" },
  });

  await logActivation({
    licenseId: license.id,
    deviceId: device.id,
    activationType: "ACTIVATE",
    result: "SUCCESS",
    ipAddress: input.ipAddress,
  });

  return {
    code: "ACTIVATION_SUCCESS",
    message: "License activated successfully.",
    token,
    license: {
      licenseId: payload.licenseId,
      licenseDisplayId: payload.licenseDisplayId,
      shopName: payload.shopName,
      productName: payload.productName,
      edition: payload.edition,
      modules: payload.modules,
      expiryDate: payload.expiryDate,
      offlineUntil: payload.offlineUntil,
    },
  };
}

export async function validateLicense(input: {
  token: string;
  machineFingerprint: string;
  appVersion?: string;
  ipAddress?: string;
}): Promise<ActivationResponse> {
  const { verifyLicenseToken } = await import("./jwt");
  let payload: LicenseTokenPayload;
  try {
    payload = await verifyLicenseToken(input.token);
  } catch {
    return { code: "INVALID_TOKEN", message: "Invalid or expired license token." };
  }

  const fpHash = hashFingerprint(input.machineFingerprint);
  if (payload.licenseId) {
    const device = await prisma.device.findFirst({
      where: {
        id: payload.deviceId,
        licenseId: payload.licenseId,
        machineFingerprintHash: fpHash,
        status: "ACTIVE",
      },
    });

    if (!device) {
      return {
        code: "DEVICE_NOT_AUTHORIZED",
        message: "Device not authorized for this license.",
      };
    }
  }

  const license = await prisma.license.findUnique({
    where: { id: payload.licenseId },
    include: { shop: true, product: true },
  });

  if (!license) {
    return { code: "INVALID_LICENSE", message: "License not found." };
  }

  const statusCode = licenseStatusCode(license.status, license.expiryDate);
  if (statusCode) {
    await logActivation({
      licenseId: license.id,
      deviceId: payload.deviceId,
      activationType: "VALIDATE",
      result: statusCode as ActivationResult,
      ipAddress: input.ipAddress,
    });
    return {
      code: statusCode,
      message: licenseStatusMessage(statusCode),
    };
  }

  const device = await prisma.device.update({
    where: { id: payload.deviceId },
    data: {
      lastValidatedAt: new Date(),
      appVersion: input.appVersion,
    },
  });

  const modules = await getProductModules(license.productId, license.edition);
  const { token, payload: newPayload } = await buildToken(license, device, modules);

  await logActivation({
    licenseId: license.id,
    deviceId: device.id,
    activationType: "VALIDATE",
    result: "SUCCESS",
    ipAddress: input.ipAddress,
  });

  return {
    code: "VALIDATION_SUCCESS",
    message: "License validated successfully.",
    token,
    license: {
      licenseId: newPayload.licenseId,
      licenseDisplayId: newPayload.licenseDisplayId,
      shopName: newPayload.shopName,
      productName: newPayload.productName,
      edition: newPayload.edition,
      modules: newPayload.modules,
      expiryDate: newPayload.expiryDate,
      offlineUntil: newPayload.offlineUntil,
    },
  };
}

export async function getLicenseFromToken(token: string) {
  const { verifyLicenseToken } = await import("./jwt");
  return verifyLicenseToken(token);
}

export async function deactivateDevice(deviceId: string, adminId?: string) {
  const device = await prisma.device.update({
    where: { id: deviceId },
    data: { status: DeviceStatus.DEACTIVATED },
  });

  await logActivation({
    licenseId: device.licenseId,
    deviceId: device.id,
    activationType: "DEACTIVATE",
    result: "SUCCESS",
    metadata: { adminId },
  });

  return device;
}
