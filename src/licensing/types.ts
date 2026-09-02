export type LicenseStatus = {
  valid: boolean;
  skip?: boolean;
  needsActivation?: boolean;
  pendingKey?: string;
  needsOnlineRefresh?: boolean;
  offlineGraceExpired?: boolean;
  message: string;
  license?: {
    shopName?: string;
    edition?: string;
    productName?: string;
    expiryDate?: string | null;
    offlineUntil?: string;
  };
  modules?: string[];
};
