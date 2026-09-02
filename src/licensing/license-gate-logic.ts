export type LicensePromptKind =
  | "checking"
  | "activation"
  | "offline"
  | "blocked"
  | "allow";

export function isLocalDesktopHost(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "localhost";
}

export function licensePromptDecision(input: {
  hasShopdesk: boolean;
  hostname: string;
  checking: boolean;
  status: {
    valid?: boolean;
    skip?: boolean;
    needsActivation?: boolean;
    offlineGraceExpired?: boolean;
    message?: string;
  } | null;
}): LicensePromptKind {
  if (input.checking) return "checking";
  if (!input.hasShopdesk) {
    return isLocalDesktopHost(input.hostname) ? "activation" : "allow";
  }
  if (!input.status) return "checking";
  if (!input.status.valid && input.status.needsActivation) return "activation";
  if (!input.status.valid && input.status.offlineGraceExpired) return "offline";
  if (!input.status.valid && !input.status.skip) return "blocked";
  return "allow";
}
