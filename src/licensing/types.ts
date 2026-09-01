export type LicenseStatus = {
  valid: boolean;
  skip?: boolean;
  needsActivation?: boolean;
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
