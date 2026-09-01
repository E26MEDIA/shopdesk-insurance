import { getGoogleFormConfig } from "./site-config";

export type RequestFormData = {
  fullName: string;
  businessName: string;
  mobile: string;
  email: string;
  city: string;
  state: string;
  numUsers: string;
  currentSoftware: string;
  message: string;
};

export async function submitToGoogleForm(
  data: RequestFormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { actionUrl, entries, isConfigured } = getGoogleFormConfig();

  if (!isConfigured) {
    return {
      ok: false,
      error:
        "Request form is not configured yet. Please contact E26 directly.",
    };
  }

  const body = new URLSearchParams();
  body.set(entries.fullName, data.fullName);
  body.set(entries.businessName, data.businessName);
  body.set(entries.mobile, data.mobile);
  body.set(entries.email, data.email);
  body.set(entries.city, data.city);
  body.set(entries.state, data.state);
  body.set(entries.numUsers, data.numUsers);
  if (entries.currentSoftware) {
    body.set(entries.currentSoftware, data.currentSoftware);
  }
  if (entries.message) {
    body.set(entries.message, data.message);
  }

  try {
    await fetch(actionUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    // no-cors responses are opaque; assume success when fetch does not throw
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "Submission failed. Please check your connection and try again.",
    };
  }
}
