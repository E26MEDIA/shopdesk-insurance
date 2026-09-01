import { SignJWT, jwtVerify, importPKCS8, importSPKI, type KeyLike } from "jose";

export type LicenseTokenPayload = {
  licenseId: string;
  licenseDisplayId: string;
  shopId: string;
  shopCode: string;
  shopName: string;
  deviceId: string;
  productId: string;
  productName: string;
  edition: string;
  modules: string[];
  expiryDate: string | null;
  offlineUntil: string;
  issuedAt: string;
};

let privateKeyPromise: Promise<KeyLike> | null = null;
let publicKeyPromise: Promise<KeyLike> | null = null;

function getPrivateKeyPem(): string {
  const pem = process.env.LICENSE_SIGNING_PRIVATE_KEY;
  if (!pem) throw new Error("LICENSE_SIGNING_PRIVATE_KEY is not configured");
  return pem.replace(/\\n/g, "\n");
}

function getPublicKeyPem(): string {
  const pem = process.env.LICENSE_SIGNING_PUBLIC_KEY;
  if (!pem) throw new Error("LICENSE_SIGNING_PUBLIC_KEY is not configured");
  return pem.replace(/\\n/g, "\n");
}

async function getPrivateKey(): Promise<KeyLike> {
  if (!privateKeyPromise) {
    privateKeyPromise = importPKCS8(getPrivateKeyPem(), "Ed25519");
  }
  return privateKeyPromise;
}

async function getPublicKey(): Promise<KeyLike> {
  if (!publicKeyPromise) {
    publicKeyPromise = importSPKI(getPublicKeyPem(), "Ed25519");
  }
  return publicKeyPromise;
}

export async function signLicenseToken(
  payload: LicenseTokenPayload,
  expiresIn = "365d",
): Promise<string> {
  const key = await getPrivateKey();
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "Ed25519" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);
}

export async function verifyLicenseToken(
  token: string,
): Promise<LicenseTokenPayload> {
  const key = await getPublicKey();
  const { payload } = await jwtVerify(token, key, {
    algorithms: ["Ed25519"],
  });
  return payload as unknown as LicenseTokenPayload;
}

export { getPublicKeyPem };
