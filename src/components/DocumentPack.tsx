"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DocType, DocumentMeta } from "@/lib/types";
import {
  isOfflineDesktop,
  isSharedOffice,
  persistDocumentFile,
  readDocumentPreview,
  removeDocumentFile,
  requireOfficeAdminPin,
} from "@/lib/persist";
import { documentFolderName, uid } from "@/lib/utils";
import { Button, Field, Input } from "./ui";

const DOC_LABELS: { type: Exclude<DocType, "other">; label: string }[] = [
  { type: "rc", label: "RC" },
  { type: "old_insurance", label: "Old insurance" },
  { type: "aadhaar", label: "Aadhaar" },
  { type: "pan", label: "PAN" },
];

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function otherTitle(doc: DocumentMeta): string {
  return (doc.label || "Other").trim() || "Other";
}

const FILE_ACCEPT =
  "image/*,application/pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.pdf";

function slotInputId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `doc-upload-other-${slug || "other"}`;
}

function AddFilesButton({
  inputId,
  onFiles,
}: {
  inputId: string;
  onFiles: (files: FileList | null) => void;
}) {
  return (
    <>
      <input
        id={inputId}
        type="file"
        multiple
        accept={FILE_ACCEPT}
        className="sr-only"
        onChange={(e) => {
          const files = e.target.files;
          e.target.value = "";
          onFiles(files);
        }}
      />
      <label
        htmlFor={inputId}
        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[#0f3d3e] bg-white text-xl font-semibold leading-none text-[#0f3d3e] hover:bg-teal-50"
        aria-label="Add files"
        title="Add files"
      >
        +
      </label>
    </>
  );
}

export function DocumentPack({
  documents,
  onChange,
  clientName,
  variant,
  vehicleMode,
  portal,
}: {
  documents: DocumentMeta[];
  onChange: (docs: DocumentMeta[]) => void;
  clientName?: string;
  variant?: string;
  vehicleMode?: string;
  portal?: string;
}) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [otherName, setOtherName] = useState("");
  const [customSlots, setCustomSlots] = useState<string[]>([]);
  const documentsRef = useRef(documents);
  useEffect(() => {
    documentsRef.current = documents;
  }, [documents]);

  const offline = isOfflineDesktop();
  const sharedOffice = isSharedOffice();
  const diskStorage = offline || sharedOffice;

  const preview = useMemo(
    () => documents.find((d) => d.id === previewId) || null,
    [documents, previewId],
  );

  const otherGroups = useMemo(() => {
    const names: string[] = [];
    const seen = new Set<string>();
    function add(name: string) {
      const key = name.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      names.push(name);
    }
    for (const slot of customSlots) add(slot);
    for (const doc of documents.filter((d) => d.type === "other")) add(otherTitle(doc));
    return names;
  }, [customSlots, documents]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!preview) {
        setPreviewUrl(null);
        return;
      }
      if (preview.dataUrl) {
        setPreviewUrl(preview.dataUrl);
        return;
      }
      if (preview.fileId && diskStorage) {
        const url = await readDocumentPreview(preview.fileId);
        if (!cancelled) setPreviewUrl(url);
        return;
      }
      setPreviewUrl(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [preview, diskStorage]);

  async function upload(type: DocType, files: FileList | null, label?: string) {
    if (!files?.length) return;
    const max = diskStorage ? 25 * 1024 * 1024 : 4 * 1024 * 1024;
    const folder = documentFolderName({
      clientName,
      variant,
      vehicleMode,
      portal,
    });
    const added: DocumentMeta[] = [];
    const current = documentsRef.current;

    for (const file of Array.from(files)) {
      if (file.size > max) {
        alert(
          diskStorage
            ? `${file.name} is over 25 MB. Keep each file under 25 MB.`
            : `${file.name} is over 4 MB. Keep each file under 4 MB for browser storage.`,
        );
        continue;
      }
      let dataUrl: string;
      try {
        dataUrl = await readFile(file);
      } catch (error) {
        console.error(error);
        alert(`Could not read ${file.name}. Try the file again.`);
        continue;
      }
      const id = uid("doc");
      const safeName = file.name.replace(/[^\w.-]+/g, "_");
      const fileId = `${folder}/${id}_${safeName}`;
      const next: DocumentMeta = {
        id,
        type,
        name: file.name,
        mime: file.type || "application/octet-stream",
        uploadedAt: new Date().toISOString(),
        dataUrl,
        label: type === "other" ? label || "Other" : undefined,
      };

      if (diskStorage) {
        try {
          const savedId = await persistDocumentFile({
            fileId,
            name: file.name,
            mime: next.mime,
            dataUrl,
            clientName: folder,
            type,
          });
          if (savedId) next.fileId = savedId;
        } catch (error) {
          console.error(error);
          alert(
            error instanceof Error
              ? error.message
              : `Could not save ${file.name}. It stays on this form until you save again.`,
          );
        }
      }
      added.push(next);
    }

    if (added.length) {
      onChange([...current, ...added]);
      setPreviewId(added[added.length - 1].id);
    }
  }

  async function remove(id: string) {
    if (!(await requireOfficeAdminPin("remove a document"))) return;
    const current = documentsRef.current;
    const old = current.find((d) => d.id === id);
    if (old?.fileId && diskStorage) {
      await removeDocumentFile(old.fileId);
    }
    onChange(current.filter((d) => d.id !== id));
    if (previewId === id) {
      setPreviewId(null);
      setPreviewUrl(null);
    }
  }

  function addOtherSlot() {
    const name = otherName.trim();
    if (!name) {
      alert("Enter a name for the other document, then tap Add.");
      return;
    }
    setCustomSlots((prev) =>
      prev.some((item) => item.toLowerCase() === name.toLowerCase())
        ? prev
        : [...prev, name],
    );
    setOtherName("");
  }

  function docsFor(type: DocType, label?: string) {
    return documents.filter((d) => {
      if (d.type !== type) return false;
      if (type !== "other") return true;
      return otherTitle(d).toLowerCase() === (label || "Other").toLowerCase();
    });
  }

  function renderCard(title: string, type: DocType, inputId: string, label?: string) {
    const docs = docsFor(type, label);
    return (
      <div key={inputId} className="rounded-md border border-slate-200 bg-slate-50 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-800">
            {title}
            {docs.length ? (
              <span className="ml-1 text-xs font-normal text-slate-500">
                ({docs.length} file{docs.length === 1 ? "" : "s"})
              </span>
            ) : null}
          </p>
          <AddFilesButton
            inputId={inputId}
            onFiles={(files) => void upload(type, files, label)}
          />
        </div>
        {docs.length ? (
          <ul className="space-y-2">
            {docs.map((doc) => (
              <li
                key={doc.id}
                className="flex items-start justify-between gap-2 rounded border border-slate-200 bg-white px-2 py-1.5"
              >
                <p className="min-w-0 truncate text-xs text-slate-700">
                  {doc.name}
                </p>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="secondary"
                    className="!px-2 !py-1 text-xs"
                    onClick={() => setPreviewId(doc.id)}
                  >
                    View
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    className="!px-2 !py-1 text-xs"
                    onClick={() => void remove(doc.id)}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-500">No files yet. Tap + to add.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sharedOffice ? (
        <p className="text-xs text-slate-600">
          Shared office mode: every computer uses the same customer folders. If Father PC or a laptop uploads RC/Aadhaar, the other computers receive that file automatically. Click Data folder to see the shared files.
        </p>
      ) : offline ? (
        <p className="text-xs text-slate-600">
          Offline mode: documents are saved on this PC and open here without
          internet.
        </p>
      ) : null}
      <p className="text-xs text-slate-600">
        RC, old insurance, Aadhaar and PAN: tap + as many times as you need.
        For any extra paper, add a name under Add other document, then tap +.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {DOC_LABELS.map(({ type, label }) =>
          renderCard(label, type, `doc-upload-${type}`),
        )}
        {otherGroups.map((name) =>
          renderCard(name, "other", slotInputId(name), name),
        )}
      </div>

      <div className="rounded-md border border-dashed border-slate-300 bg-white p-3">
        <p className="mb-2 text-sm font-medium text-slate-800">Add other document</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[12rem] flex-1">
            <Field label="Document name">
              <Input
                value={otherName}
                onChange={(e) => setOtherName(e.target.value)}
                placeholder="e.g. PUC, Form 29"
              />
            </Field>
          </div>
          <Button type="button" variant="secondary" onClick={addOtherSlot}>
            Add
          </Button>
        </div>
      </div>

      {preview && previewUrl ? (
        <div className="rounded-md border border-slate-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-800">
              Preview: {preview.name}
            </p>
            <Button
              type="button"
              variant="secondary"
              className="!px-2 !py-1 text-xs"
              onClick={() => {
                setPreviewId(null);
                setPreviewUrl(null);
              }}
            >
              Close
            </Button>
          </div>
          {preview.mime.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={preview.name}
              className="max-h-[420px] w-full object-contain"
            />
          ) : preview.mime === "application/pdf" ? (
            <iframe
              title={preview.name}
              src={previewUrl}
              className="h-[420px] w-full rounded border border-slate-200"
            />
          ) : (
            <a
              href={previewUrl}
              download={preview.name}
              className="text-sm text-[#0f3d3e] underline"
            >
              Download file
            </a>
          )}
        </div>
      ) : null}
    </div>
  );
}
