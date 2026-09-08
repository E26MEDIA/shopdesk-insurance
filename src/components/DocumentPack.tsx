"use client";

import { useEffect, useMemo, useState } from "react";
import type { DocType, DocumentMeta } from "@/lib/types";
import {
  isOfflineDesktop,
  isSharedOffice,
  persistDocumentFile,
  readDocumentPreview,
  removeDocumentFile,
  requireOfficeAdminPin,
} from "@/lib/persist";
import { uid } from "@/lib/utils";
import { Button, Field } from "./ui";

const DOC_LABELS: { type: DocType; label: string }[] = [
  { type: "rc", label: "RC" },
  { type: "old_insurance", label: "Old insurance" },
  { type: "aadhaar", label: "Aadhaar" },
  { type: "pan", label: "PAN" },
  { type: "other", label: "Other" },
];

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function DocumentPack({
  documents,
  onChange,
  clientName,
}: {
  documents: DocumentMeta[];
  onChange: (docs: DocumentMeta[]) => void;
  clientName?: string;
}) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [inputKeys, setInputKeys] = useState<Record<DocType, number>>({
    rc: 0,
    old_insurance: 0,
    aadhaar: 0,
    pan: 0,
    other: 0,
  });
  const offline = isOfflineDesktop();
  const sharedOffice = isSharedOffice();
  const diskStorage = offline || sharedOffice;

  const preview = useMemo(
    () => documents.find((d) => d.id === previewId) || null,
    [documents, previewId],
  );

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

  async function upload(type: DocType, files: FileList | null) {
    if (!files?.length) return;
    const max = diskStorage ? 25 * 1024 * 1024 : 4 * 1024 * 1024;
    const folder =
      (clientName || "").trim().replace(/[<>:"/\\|?*]+/g, " ") || "Unknown Customer";
    const added: DocumentMeta[] = [];

    for (const file of Array.from(files)) {
      if (file.size > max) {
        alert(
          diskStorage
            ? `${file.name} is over 25 MB. Keep each file under 25 MB.`
            : `${file.name} is over 4 MB. Keep each file under 4 MB for browser storage.`,
        );
        continue;
      }
      const dataUrl = await readFile(file);
      const id = uid("doc");
      const safeName = file.name.replace(/[^\w.-]+/g, "_");
      const fileId = `${folder}/${id}_${safeName}`;
      const next: DocumentMeta = {
        id,
        type,
        name: file.name,
        mime: file.type || "application/octet-stream",
        uploadedAt: new Date().toISOString(),
        dataUrl: diskStorage ? undefined : dataUrl,
        fileId: diskStorage ? fileId : undefined,
      };

      if (diskStorage) {
        await persistDocumentFile({
          fileId,
          name: file.name,
          mime: next.mime,
          dataUrl,
          clientName: folder,
          type,
        });
        next.dataUrl = dataUrl;
      }
      added.push(next);
    }

    if (added.length) {
      onChange([...documents, ...added]);
      setPreviewId(added[added.length - 1].id);
    }
    setInputKeys((prev) => ({ ...prev, [type]: prev[type] + 1 }));
  }

  async function remove(id: string) {
    if (!(await requireOfficeAdminPin("remove a document"))) return;
    const old = documents.find((d) => d.id === id);
    if (old?.fileId && diskStorage) {
      await removeDocumentFile(old.fileId);
    }
    onChange(documents.filter((d) => d.id !== id));
    if (previewId === id) {
      setPreviewId(null);
      setPreviewUrl(null);
    }
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
        RC, Aadhaar and other papers often need 3–4 photos. Upload as many files
        as you need for each document, then use Add more documents.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {DOC_LABELS.map(({ type, label }) => {
          const docs = documents.filter((d) => d.type === type);
          return (
            <div
              key={type}
              className="rounded-md border border-slate-200 bg-slate-50 p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-800">
                  {label}
                  {docs.length ? (
                    <span className="ml-1 text-xs font-normal text-slate-500">
                      ({docs.length} file{docs.length === 1 ? "" : "s"})
                    </span>
                  ) : null}
                </p>
              </div>
              {docs.length ? (
                <ul className="mb-3 space-y-2">
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
                <p className="mb-2 text-xs text-slate-500">No files yet.</p>
              )}
              <Field label="Add more documents">
                <input
                  key={`${type}-${inputKeys[type]}`}
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  className="block w-full text-xs"
                  onChange={(e) => void upload(type, e.target.files)}
                />
              </Field>
            </div>
          );
        })}
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
