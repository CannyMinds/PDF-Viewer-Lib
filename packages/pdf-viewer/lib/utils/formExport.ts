import { PdfAnnotationSubtype } from "@embedpdf/models";
import type { PdfDocumentObject } from "@embedpdf/models";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRef } from "pdf-lib";

// Helpers for saving fillable-form (AcroForm) edits made in the viewer.

export const taskToPromise = <T,>(task: { wait: (onSuccess: (value: T) => void, onError: (error: any) => void) => void }) =>
  new Promise<T>((resolve, reject) => task.wait(resolve, reject));

/**
 * Produces the PDF with its form fields exactly as they are in the viewer —
 * fields added, moved or removed in design mode, and every filled-in value —
 * but without the annotations that were not part of the original file:
 * `excludedAnnotationIds` holds the ids of annotations the host imported
 * (e.g. annotations kept in its own database) or the user drew in the
 * viewer. Those would otherwise get baked permanently into the saved file.
 *
 * Works on a copy: the live document is left untouched. (Matching against a
 * fresh open of the original bytes isn't possible — PDFium assigns a random
 * id to every annotation without an /NM entry each time a file is opened —
 * whereas ids in a copy of the live document are the ones it already uses.)
 */
export const buildFilledPdf = async (
  engine: any,
  liveDoc: PdfDocumentObject,
  excludedAnnotationIds: ReadonlySet<string>,
  flattenedAnnotationIds: ReadonlySet<string>,
  hasDeletedFields: boolean,
  originalBytes: Uint8Array | ArrayBuffer,
  password?: string,
): Promise<ArrayBuffer> => {
  const bytes = await removeAnnotations(engine, liveDoc, excludedAnnotationIds, flattenedAnnotationIds, password);
  return normalizeFormStructure(bytes, hasDeletedFields ? originalBytes : null);
};

// Removes `excludedAnnotationIds` and flattens `flattenedAnnotationIds` (field
// labels) into page content, on a copy of the live document.
const removeAnnotations = async (
  engine: any,
  liveDoc: PdfDocumentObject,
  excludedAnnotationIds: ReadonlySet<string>,
  flattenedAnnotationIds: ReadonlySet<string>,
  password?: string,
): Promise<ArrayBuffer> => {
  const liveCopy = await taskToPromise<ArrayBuffer>(engine.saveAsCopy(liveDoc));
  if (excludedAnnotationIds.size === 0 && flattenedAnnotationIds.size === 0) return liveCopy;

  const exportDoc = await taskToPromise<PdfDocumentObject>(
    engine.openDocumentBuffer(
      { id: `form-export-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, content: liveCopy },
      password ? { password } : undefined,
    ),
  );

  try {
    let changed = 0;
    for (const page of exportDoc.pages) {
      const annotations = await taskToPromise<any[]>(engine.getPageAnnotations(exportDoc, page));
      for (const annotation of annotations) {
        if (annotation?.type === PdfAnnotationSubtype.WIDGET) continue;
        const id = String(annotation?.id);
        if (flattenedAnnotationIds.has(id)) {
          await taskToPromise(engine.flattenAnnotation(exportDoc, page, annotation));
          changed += 1;
        } else if (excludedAnnotationIds.has(id)) {
          await taskToPromise(engine.removePageAnnotation(exportDoc, page, annotation));
          changed += 1;
        }
      }
    }
    return changed > 0 ? await taskToPromise<ArrayBuffer>(engine.saveAsCopy(exportDoc)) : liveCopy;
  } finally {
    engine.closeDocument(exportDoc).wait(() => undefined, () => undefined);
  }
};

/**
 * Fixes two things PDFium leaves behind when fields are edited, which PDF
 * readers other than PDFium can trip over:
 *
 * - MaxLen written onto a widget whose field is a separate (parent)
 *   dictionary. MaxLen is a field attribute, so it's moved to the parent.
 * - Deleted fields: removing a widget only takes it off the page; the
 *   field in the AcroForm tree keeps pointing at it. When `originalBytes` is
 *   given (fields were deleted), widgets in the tree that are on no page now
 *   but were on a page in the original file — or didn't exist in it (added
 *   and deleted in this session) — are pruned, and fields left without
 *   widgets are dropped. Widgets that were already off-page in the original
 *   (e.g. hidden fields) are left alone. PDFium keeps object numbers when
 *   saving, which is what makes the two files comparable.
 *
 * Encrypted files are returned as-is (pdf-lib can't re-save them).
 */
export const normalizeFormStructure = async (
  bytes: ArrayBuffer,
  originalBytes: Uint8Array | ArrayBuffer | null,
): Promise<ArrayBuffer> => {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, { updateMetadata: false });
  } catch {
    return bytes;
  }
  if (doc.isEncrypted) return bytes;
  const acroForm = doc.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict);
  const fields = acroForm?.lookupMaybe(PDFName.of("Fields"), PDFArray);
  if (!fields) return bytes;

  const { context } = doc;
  const MaxLen = PDFName.of("MaxLen");
  const Parent = PDFName.of("Parent");
  const Kids = PDFName.of("Kids");
  const Subtype = PDFName.of("Subtype");
  const Widget = PDFName.of("Widget");
  let changed = false;

  const widgetsOnPages = (pdf: PDFDocument) => {
    const numbers = new Set<number>();
    for (const page of pdf.getPages()) {
      for (const ref of page.node.Annots()?.asArray() ?? []) {
        if (ref instanceof PDFRef) numbers.add(ref.objectNumber);
      }
    }
    return numbers;
  };

  for (const page of doc.getPages()) {
    for (const ref of page.node.Annots()?.asArray() ?? []) {
      const widget = context.lookup(ref);
      if (!(widget instanceof PDFDict) || widget.get(Subtype) !== Widget) continue;
      const maxLen = widget.get(MaxLen);
      const parent = widget.lookupMaybe(Parent, PDFDict);
      if (maxLen === undefined || !parent) continue;
      parent.set(MaxLen, maxLen);
      widget.delete(MaxLen);
      changed = true;
    }
  }

  if (originalBytes) {
    let original: PDFDocument | null = null;
    try {
      original = await PDFDocument.load(originalBytes, { updateMetadata: false, ignoreEncryption: true });
    } catch {
      original = null;
    }
    if (original) {
      const onPageNow = widgetsOnPages(doc);
      const onPageBefore = widgetsOnPages(original);
      const originalContext = original.context;
      const isDeletedWidget = (ref: PDFRef, dict: PDFDict) => {
        if (dict.get(Subtype) !== Widget || onPageNow.has(ref.objectNumber)) return false;
        if (onPageBefore.has(ref.objectNumber)) return true;
        const before = originalContext.lookup(ref);
        return !(before instanceof PDFDict && before.get(Subtype) === Widget);
      };
      // Removes deleted widgets, and fields left with no widgets, from `array`.
      const prune = (array: PDFArray): void => {
        for (let i = array.size() - 1; i >= 0; i--) {
          const entry = array.get(i);
          if (!(entry instanceof PDFRef)) continue;
          const dict = context.lookup(entry);
          if (!(dict instanceof PDFDict)) continue;
          if (isDeletedWidget(entry, dict)) {
            array.remove(i);
            changed = true;
            continue;
          }
          const kids = dict.lookupMaybe(Kids, PDFArray);
          if (!kids) continue;
          const before = kids.size();
          prune(kids);
          if (before > 0 && kids.size() === 0) {
            array.remove(i);
            changed = true;
          }
        }
      };
      prune(fields);
    }
  }

  if (!changed) return bytes;
  const saved = await doc.save({ useObjectStreams: false });
  return saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer;
};

export const sameFormValues = (a: Record<string, string> | null, b: Record<string, string>) => {
  if (!a) {
    return Object.keys(b).length === 0;
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
};
