/** Print HTML inside Electron/desktop without opening about:blank popups. */
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

  // Give the iframe a moment to layout before printing
  setTimeout(runPrint, 350);
}
