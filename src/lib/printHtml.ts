import { isOfflineDesktop } from "./persist";

/** Print HTML inside browser; desktop builds save a real PDF file instead. */
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

  const runPrint = () => {
    try {
      frameWindow.focus();
      frameWindow.print();
    } catch (err) {
      console.error(err);
      alert("Could not open the print dialog. Try again.");
    } finally {
      cleanup();
    }
  };

  setTimeout(runPrint, 350);
}

/** Desktop: save PDF under E:\\insurance desk\\report\\daily report\\YYYY-MM-DD_kind.pdf */
export async function saveOrPrintReport(opts: {
  html: string;
  kind: string;
  date?: string;
}): Promise<{ path?: string; fileName?: string } | null> {
  if (isOfflineDesktop() && window.shopdesk?.savePdfReport) {
    try {
      const result = await window.shopdesk.savePdfReport({
        html: opts.html,
        kind: opts.kind,
        date: opts.date,
      });
      alert(
        `PDF saved:\n${result.path}\n\nFolder: E:\\insurance desk\\report\\daily report`,
      );
      return result;
    } catch (err) {
      console.error(err);
      alert(
        "Could not save the PDF file. Check that E:\\insurance desk is available, then try again.",
      );
      return null;
    }
  }

  printHtmlDocument(opts.html);
  return null;
}
