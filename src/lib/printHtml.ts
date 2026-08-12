import { isOfflineDesktop } from "./persist";

/** Browser-only print fallback (not used by offline desktop). */
export function printHtmlDocument(html: string) {
  if (typeof document === "undefined") return;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "ShopDesk print");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDoc = frameWindow?.document;
  if (!frameWindow || !frameDoc) {
    document.body.removeChild(iframe);
    alert("Could not open print preview.");
    return;
  }

  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();

  const cleanup = () => {
    setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 1500);
  };

  setTimeout(() => {
    try {
      frameWindow.focus();
      frameWindow.print();
    } catch (err) {
      console.error(err);
      alert("Could not open the print dialog. Try again.");
    } finally {
      cleanup();
    }
  }, 350);
}

/**
 * Desktop: always save a PDF file (never open print dialog).
 * Path: E:\\insurance desk\\report\\daily report\\YYYY-MM-DD_kind.pdf
 */
export async function saveOrPrintReport(opts: {
  html: string;
  kind: string;
  date?: string;
}): Promise<{ path?: string; fileName?: string } | null> {
  // Offline desktop must download/save only — never print
  if (isOfflineDesktop()) {
    if (!window.shopdesk?.savePdfReport) {
      alert(
        "This ShopDesk build cannot save PDF files. Install the latest Setup.exe.",
      );
      return null;
    }
    try {
      const result = await window.shopdesk.savePdfReport({
        html: opts.html,
        kind: opts.kind,
        date: opts.date,
      });
      alert(`PDF downloaded:\n${result.path}`);
      return result;
    } catch (err) {
      console.error(err);
      alert(
        `Could not download PDF.\n${err instanceof Error ? err.message : String(err)}\n\nCheck E:\\insurance desk is available.`,
      );
      return null;
    }
  }

  // Browser web mode only
  printHtmlDocument(opts.html);
  return null;
}
