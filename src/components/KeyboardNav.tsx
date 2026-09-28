"use client";

import { useEffect } from "react";

function visibleFields(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>("input, select, textarea, button, a[href]")].filter((el) => {
    if (el.hasAttribute("disabled") || el.getAttribute("aria-hidden") === "true") return false;
    if (el.tabIndex < 0) return false;
    if (el instanceof HTMLInputElement && el.type === "hidden") return false;
    const style = window.getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none") return false;
    return true;
  });
}

function moveFocus(from: HTMLElement, direction: 1 | -1) {
  const fields = visibleFields();
  const index = fields.indexOf(from);
  const next = fields[index + direction] || (direction > 0 ? fields[0] : fields[fields.length - 1]);
  next?.focus();
  if (next instanceof HTMLInputElement && next.type !== "date" && typeof next.select === "function") {
    next.select();
  }
}

/** Arrow keys and Enter move through the shop screens. Dropdowns keep Up and Down for their list. */
export function KeyboardNav() {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.isContentEditable) return;

      const arrows = event.key === "ArrowUp" || event.key === "ArrowDown" || event.key === "ArrowLeft" || event.key === "ArrowRight";
      if (!arrows && event.key !== "Enter") return;
      if (target.closest("[data-arrow-menu='open']")) return;
      if (target.closest("[data-file-picker]")) return;

      if (event.key === "Enter") {
        if (target instanceof HTMLTextAreaElement || target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement) return;
        if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
        event.preventDefault();
        moveFocus(target, 1);
        return;
      }

      if (target instanceof HTMLSelectElement && (event.key === "ArrowUp" || event.key === "ArrowDown")) return;
      if (target instanceof HTMLTextAreaElement) return;

      if (target instanceof HTMLInputElement && (target.type === "text" || target.type === "search" || target.type === "tel" || target.type === "")) {
        const start = target.selectionStart ?? 0;
        const end = target.selectionEnd ?? start;
        if (event.key === "ArrowLeft" && start > 0) return;
        if (event.key === "ArrowRight" && end < target.value.length) return;
      }

      event.preventDefault();
      const forward = event.key === "ArrowDown" || event.key === "ArrowRight";
      moveFocus(target, forward ? 1 : -1);
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return null;
}
