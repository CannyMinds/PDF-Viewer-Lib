import type { Kernel } from "@embedpdf/react";
import { AnnotationHub } from "../annotations/hub";
import { BridgeToken } from "../bridge";

export interface FilledPdfOptions {
  kernel: Kernel;
  documentId: string;
  hub: AnnotationHub;
  /** Ids of the field labels: printed into the page content in the saved file. */
  labelIds: ReadonlySet<string>;
  /** Needed to open the copy when the document is encrypted. */
  password?: string | undefined;
}

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

/**
 * The PDF with its form fields exactly as they are in the viewer — fields
 * added, moved or deleted in design mode, and every filled-in value — but
 * without the annotations that were not part of the original file (the ones the
 * host imported, or the user drew): those stay in the host's own store, and
 * baking them in would make them permanent. Field labels are different: they
 * are printed into the page.
 *
 * Works on a throw-away copy, so the live document is left untouched.
 */
export const buildFilledPdf = async ({ kernel, documentId, hub, labelIds, password }: FilledPdfOptions): Promise<ArrayBuffer> => {
  const bridge = kernel.capability(BridgeToken, documentId);
  const doc = bridge.doc();

  // Annotations are matched by name (/NM): it survives the save, object numbers may not.
  const remove = new Set<string>();
  const flatten = new Set<string>();
  for (const dto of hub.list()) {
    const nm = (dto as any).nm as string | null;
    const id = hub.idOf(dto);
    if (!nm) continue;
    if (labelIds.has(id)) flatten.add(nm);
    else if (hub.isAdded(id)) remove.add(nm);
  }

  // `rewrite` writes a fresh file: nothing deleted since the document was opened stays behind in it.
  const bytes = await doc.download({ mode: "rewrite" });
  if (remove.size === 0 && flatten.size === 0) return toArrayBuffer(bytes);

  const copy = await bridge.engine().open(
    { kind: "bytes", id: `filled-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, bytes: bytes.slice() },
    { scope: ["*"], ...(password ? { password } : {}) },
  );
  try {
    const { pages } = await copy.pages.list();
    for (const page of pages) {
      const handle = copy.page(page.pageObjectNumber);
      const { annotations } = (await handle.annotations.list()) as { annotations: Array<{ nm: string | null; ref: any }> };
      for (const annotation of annotations) {
        if (annotation.nm && remove.has(annotation.nm)) await handle.annotations.delete(annotation.ref);
      }
      const toFlatten = annotations.filter((a) => a.nm && flatten.has(a.nm)).map((a) => a.ref);
      if (toFlatten.length && handle.annotations.flatten) await handle.annotations.flatten(toFlatten, "print");
    }
    return toArrayBuffer(await copy.download({ mode: "rewrite" }));
  } finally {
    await copy.close().catch(() => undefined);
  }
};
