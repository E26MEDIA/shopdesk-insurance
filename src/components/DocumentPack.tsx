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
}: {
  documents: DocumentMeta[];
  onChange: (docs: DocumentMeta[]) => void;
}) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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
      if (preview.fileId && offline) {
        const url = await readDocumentPreview(preview.fileId);
        if (!cancelled) setPreviewUrl(url);
        return;
      }
      setPreviewUrl(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [preview, offline]);

  async function upload(type: DocType, file: File | null) {
    if (!file) return;
    const max = diskStorage ? 25 * 1024 * 1024 : 4 * 1024 * 1024;
    if (file.size > max) {
      alert(
        diskStorage
          ? "Keep each file under 25 MB."
          : "Keep each file under 4 MB for browser storage.",
      );
      return;
    }
    const dataUrl = await readFile(file);
    const id = uid("doc");
    const fileId = `${id}_${file.name.replace(/[^\w.-]+/g, "_")}`;
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
      });
      // Keep preview available immediately in this session
      next.dataUrl = dataUrl;
    }

    const old = documents.find((d) => d.type === type);
    if (old?.fileId && diskStorage) {
      await removeDocumentFile(old.fileId);
    }

    const without = documents.filter((d) => d.type !== type);
    onChange([...without, next]);
    setPreviewId(next.id);
  }

  async function remove(type: DocType) {
    if (!(await requireOfficeAdminPin("remove a document"))) return;
    const old = documents.find((d) => d.type === type);
    if (old?.fileId && diskStorage) {
      await removeDocumentFile(old.fileId);
    }
    onChange(documents.filter((d) => d.type !== type));
    if (preview?.type === type) {
      setPreviewId(null);
      setPreviewUrl(null);
    }
  }

  return (
    <div className="space-y-4">
      {sharedOffice ? (
        <p className="text-xs text-slate-600">
          Shared office mode: documents are stored on the main office PC and are available to all connected computers.
        </p>
      ) : offline ? (
        <p className="text-xs text-slate-600">
          Offline mode: documents are saved on this PC and open here without
          internet.
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {DOC_LABELS.map(({ type, label }) => {
          const doc = documents.find((d) => d.type === type);
          return (
            <div
              key={type}
              className="rounded-md border border-slate-200 bg-slate-50 p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-800">{label}</p>
                {doc ? (
                  <div className="flex gap-1">
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
                      onClick={() => void remove(type)}
                    >
                      Remove
                    </Button>
                  </div>
                ) : null}
              </div>
              {doc ? (
                <p className="truncate text-xs text-slate-600">{doc.name}</p>
              ) : (
                <Field label="Upload">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="block w-full text-xs"
                    onChange={(e) =>
                      void upload(type, e.target.files?.[0] || null)
                    }
                  />
                </Field>
              )}
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
