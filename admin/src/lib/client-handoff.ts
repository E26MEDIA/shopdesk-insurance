export function buildClientMessage({
  shopName,
  licenseKey,
  downloadUrl,
}: {
  shopName: string;
  licenseKey: string;
  downloadUrl: string;
}) {
  const downloadLine = downloadUrl
    ? downloadUrl
    : "https://insurance.e26media.com/download";

  return `Hello ${shopName},

Your Insurance Desk software is ready.

DOWNLOAD (Windows installer):
${downloadLine}

LICENSE KEY:
${licenseKey}

INSTALL STEPS:
1. Download and run the installer on your Windows computer
2. When asked, paste the verification key above
3. Open Insurance Desk from the Start menu if it is not already open
4. Internet is needed only once for activation — daily work is offline

— E26 / Insurance Desk`;
}

export function buildClientEmailSubject(shopName: string) {
  return `Insurance Desk — Software & License Key for ${shopName}`;
}
