/**
 * In-app dialogs. Electron does not implement window.prompt (it returns null
 * immediately), so Admin PIN checks that used prompt silently cancelled Delete.
 */

type PromptOptions = {
  title?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  password?: boolean;
};

type ConfirmOptions = {
  title?: string;
  confirmLabel?: string;
  danger?: boolean;
};

let dialogQueue: Promise<unknown> = Promise.resolve();

function runExclusive<T>(work: () => Promise<T>): Promise<T> {
  const next = dialogQueue.then(work, work);
  dialogQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

function overlayRoot(): HTMLDivElement {
  const root = document.createElement("div");
  root.setAttribute("data-shopdesk-dialog", "1");
  root.style.cssText = [
    "position:fixed",
    "inset:0",
    "z-index:2147483000",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "padding:16px",
    "background:rgba(15,23,42,0.45)",
  ].join(";");
  return root;
}

function panel(title: string, message: string): { box: HTMLDivElement; body: HTMLDivElement } {
  const box = document.createElement("div");
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.style.cssText = [
    "width:100%",
    "max-width:420px",
    "border-radius:16px",
    "border:1px solid #e2e8f0",
    "background:#fff",
    "box-shadow:0 25px 50px rgba(15,23,42,0.25)",
    "font-family:inherit",
    "color:#0f172a",
  ].join(";");

  const inner = document.createElement("div");
  inner.style.cssText = "padding:24px 24px 8px;";

  const heading = document.createElement("h2");
  heading.textContent = title;
  heading.style.cssText = "margin:0;font-size:18px;font-weight:600;";
  inner.appendChild(heading);

  const text = document.createElement("p");
  text.textContent = message;
  text.style.cssText = "margin:8px 0 0;font-size:14px;line-height:1.5;color:#475569;white-space:pre-wrap;";
  inner.appendChild(text);

  box.appendChild(inner);
  return { box, body: inner };
}

function footer(): HTMLDivElement {
  const bar = document.createElement("div");
  bar.style.cssText =
    "display:flex;justify-content:flex-end;gap:8px;padding:16px 24px;border-top:1px solid #e2e8f0;background:#f8fafc;border-radius:0 0 16px 16px;";
  return bar;
}

function button(label: string, kind: "primary" | "secondary" | "danger"): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.textContent = label;
  const styles =
    kind === "danger"
      ? "background:#dc2626;color:#fff;border:0;"
      : kind === "primary"
        ? "background:#0f3d3e;color:#fff;border:0;"
        : "background:#fff;color:#334155;border:1px solid #cbd5e1;";
  el.style.cssText = `${styles}border-radius:8px;padding:8px 14px;font-size:14px;font-weight:600;cursor:pointer;`;
  return el;
}

function mountDialog(root: HTMLDivElement): () => void {
  const previous = document.activeElement as HTMLElement | null;
  document.body.appendChild(root);
  return () => {
    root.remove();
    previous?.focus?.();
  };
}

export function appPrompt(message: string, options: PromptOptions = {}): Promise<string | null> {
  if (typeof document === "undefined") return Promise.resolve(null);
  return runExclusive(
    () =>
      new Promise((resolve) => {
        const root = overlayRoot();
        const { box, body } = panel(options.title || "Admin PIN", message);
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = options.placeholder || "";
        input.value = options.defaultValue || "";
        input.autocomplete = "one-time-code";
        input.setAttribute("autocapitalize", "off");
        input.setAttribute("spellcheck", "false");
        input.setAttribute("aria-label", options.title || "Admin PIN");
        input.dataset.shopdesk = "dialog-input";
        input.inputMode = options.password ? "numeric" : "text";
        input.style.cssText =
          "margin-top:16px;width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:8px;padding:10px 12px;font-size:16px;outline:none;" +
          (options.password ? "-webkit-text-security:disc;" : "");
        body.appendChild(input);

        const bar = footer();
        const ok = button(options.confirmLabel || "Continue", "primary");
        ok.dataset.shopdesk = "dialog-ok";
        const cancel = button("Cancel", "secondary");
        cancel.dataset.shopdesk = "dialog-cancel";
        bar.append(cancel, ok);
        box.appendChild(bar);
        root.appendChild(box);

        const cleanup = mountDialog(root);
        let done = false;
        const finish = (value: string | null) => {
          if (done) return;
          done = true;
          document.removeEventListener("keydown", onKey);
          cleanup();
          resolve(value);
        };
        const onKey = (event: KeyboardEvent) => {
          if (!root.isConnected) {
            document.removeEventListener("keydown", onKey);
            return;
          }
          if (!root.contains(event.target as Node)) return;
          if (event.key === "Escape") finish(null);
          if (event.key === "Enter") finish(input.value);
        };
        document.addEventListener("keydown", onKey);
        cancel.onclick = () => finish(null);
        ok.onclick = () => finish(input.value);
        queueMicrotask(() => input.focus());
      }),
  );
}

export function appConfirm(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  if (typeof document === "undefined") return Promise.resolve(false);
  return runExclusive(
    () =>
      new Promise((resolve) => {
        const root = overlayRoot();
        const { box } = panel(options.title || "Please confirm", message);
        const bar = footer();
        const cancel = button("Cancel", "secondary");
        cancel.dataset.shopdesk = "dialog-cancel";
        const ok = button(
          options.confirmLabel || "Delete",
          options.danger === false ? "primary" : "danger",
        );
        ok.dataset.shopdesk = "dialog-ok";
        bar.append(cancel, ok);
        box.appendChild(bar);
        root.appendChild(box);

        const cleanup = mountDialog(root);
        let done = false;
        const finish = (value: boolean) => {
          if (done) return;
          done = true;
          document.removeEventListener("keydown", onKey);
          cleanup();
          resolve(value);
        };
        const onKey = (event: KeyboardEvent) => {
          if (!root.isConnected) {
            document.removeEventListener("keydown", onKey);
            return;
          }
          if (!root.contains(event.target as Node)) return;
          if (event.key === "Escape") finish(false);
          if (event.key === "Enter") finish(true);
        };
        document.addEventListener("keydown", onKey);
        cancel.onclick = () => finish(false);
        ok.onclick = () => finish(true);
        queueMicrotask(() => ok.focus());
      }),
  );
}

export function appAlert(message: string, title = "Insurance Desk"): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  return runExclusive(
    () =>
      new Promise((resolve) => {
        const root = overlayRoot();
        const { box } = panel(title, message);
        const bar = footer();
        const ok = button("OK", "primary");
        ok.dataset.shopdesk = "dialog-ok";
        bar.append(ok);
        box.appendChild(bar);
        root.appendChild(box);
        const cleanup = mountDialog(root);
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          document.removeEventListener("keydown", onKey);
          cleanup();
          resolve();
        };
        const onKey = (event: KeyboardEvent) => {
          if (!root.isConnected) {
            document.removeEventListener("keydown", onKey);
            return;
          }
          if (!root.contains(event.target as Node)) return;
          if (event.key === "Escape" || event.key === "Enter") finish();
        };
        document.addEventListener("keydown", onKey);
        ok.onclick = () => finish();
        queueMicrotask(() => ok.focus());
      }),
  );
}
