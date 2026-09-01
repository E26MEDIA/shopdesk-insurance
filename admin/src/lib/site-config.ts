export const siteConfig = {
  name: "Insurance Desk",
  brand: "E26",
  tagline: "Professional Insurance Management Software",
  description:
    "Insurance Desk is a professional desktop software solution for managing customers, policies, renewals, payments and daily insurance operations.",
  colors: {
    primary: "#0f3d3e",
    primaryHover: "#1a5c5e",
    primaryDark: "#0c3233",
  },
} as const;

export function getDownloadConfig() {
  const url = process.env.NEXT_PUBLIC_INSURANCE_DESK_DOWNLOAD_URL?.trim() ?? "";
  const version =
    process.env.NEXT_PUBLIC_INSURANCE_DESK_VERSION?.trim() || "0.1.0";
  const apiUrl = process.env.NEXT_PUBLIC_DOWNLOAD_API_URL?.trim() ?? "";

  return {
    url,
    version,
    apiUrl,
    isConfigured: Boolean(url),
  };
}

export function getGoogleFormConfig() {
  const actionUrl =
    process.env.NEXT_PUBLIC_GOOGLE_FORM_ACTION_URL?.trim() ?? "";

  const entries = {
    fullName:
      process.env.NEXT_PUBLIC_GOOGLE_FORM_ENTRY_FULL_NAME?.trim() ?? "",
    businessName:
      process.env.NEXT_PUBLIC_GOOGLE_FORM_ENTRY_BUSINESS_NAME?.trim() ?? "",
    mobile: process.env.NEXT_PUBLIC_GOOGLE_FORM_ENTRY_MOBILE?.trim() ?? "",
    email: process.env.NEXT_PUBLIC_GOOGLE_FORM_ENTRY_EMAIL?.trim() ?? "",
    city: process.env.NEXT_PUBLIC_GOOGLE_FORM_ENTRY_CITY?.trim() ?? "",
    state: process.env.NEXT_PUBLIC_GOOGLE_FORM_ENTRY_STATE?.trim() ?? "",
    numUsers:
      process.env.NEXT_PUBLIC_GOOGLE_FORM_ENTRY_NUM_USERS?.trim() ?? "",
    currentSoftware:
      process.env.NEXT_PUBLIC_GOOGLE_FORM_ENTRY_CURRENT_SOFTWARE?.trim() ??
      "",
    message: process.env.NEXT_PUBLIC_GOOGLE_FORM_ENTRY_MESSAGE?.trim() ?? "",
  };

  const requiredEntries = [
    entries.fullName,
    entries.businessName,
    entries.mobile,
    entries.email,
    entries.city,
    entries.state,
    entries.numUsers,
  ];

  return {
    actionUrl,
    entries,
    isConfigured: Boolean(actionUrl && requiredEntries.every(Boolean)),
  };
}
