import { StageToken } from "@embedpdf/react";
import type { Kernel } from "@embedpdf/react";
import { AnnotationToken } from "@embedpdf/plugin-annotation";
import type { AnnotationDTO } from "@embedpdf/plugin-annotation";
import { InteractionToken } from "@embedpdf/plugin-interaction";
import { AnnotationHub, isVisibleAnnotation } from "../annotations/hub";
import {
  dataUrlToBytes,
  fromLegacy,
  legacyRectToPdf,
  namesToFlags,
} from "../annotations/legacy";
import type { AnnotationDraft } from "../annotations/legacy";
import { LockModeType } from "../lock-types";
import type { LockMode } from "../lock-types";
import type { PDFViewerRef } from "../types/public";
import { loadImageDimensions } from "../components/utils";

// Tool ids of the EmbedPDF 3 annotation plugin.
const TOOL = { highlight: "highlight", stamp: "stamp", signature: "ink" } as const;
// Placed images are limited to a 200 x 200 box, as in the 2.x viewer.
const MAX_STAMP_SIZE = 200;

export interface AnnotationApiContext {
  kernel: Kernel;
  documentId: string;
  hub: AnnotationHub;
  /** The viewer's current lock mode, shared with the layers that enforce it. */
  lock: { current: LockMode };
  onLockChange: () => void;
  /** True when the host denied annotation edits (`permissions.overrides.modifyAnnotations`). */
  denyEdits: () => boolean;
  /** Called by the page layer when the user clicks while click-to-place is on. */
  clickToPlace: { current: ((click: ClickToPlaceData) => void) | null };
  /** Bumps whenever imported annotations must be redrawn. */
  refresh: () => void;
  /** Author details applied to annotations created from now on. */
  userInfo: { current: { author?: string; customData?: any } | null };
}

export interface ClickToPlaceData {
  pageIndex: number;
  x: number;
  y: number;
  pageWidth?: number;
  pageHeight?: number;
  target?: HTMLElement | EventTarget;
}

type AnnotationApi = PDFViewerRef["annotation"];

const newId = () => (globalThis.crypto?.randomUUID?.() ?? `a-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

const fitWithin = (width: number, height: number) => {
  const scale = Math.min(1, MAX_STAMP_SIZE / width, MAX_STAMP_SIZE / height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
};

export const createAnnotationApi = (ctx: AnnotationApiContext): AnnotationApi => {
  const { kernel, documentId, hub } = ctx;
  const annotations = () => kernel.capability(AnnotationToken, documentId);
  const interaction = () => kernel.tryCapability(InteractionToken, documentId) ?? kernel.tryCapability(InteractionToken);

  // Locked for creating: the host's lock mode, or the host denied annotation edits.
  const isLocked = () => ctx.lock.current.type === LockModeType.All || ctx.denyEdits();
  const activeToolId = () => {
    try {
      return interaction()?.activeToolId() ?? null;
    } catch {
      return null;
    }
  };
  const activate = (id: string | null) => {
    if (id && isLocked()) return;
    interaction()?.activateTool(id ?? "pointer");
  };

  const selectedDto = (): AnnotationDTO | null => {
    const selected = annotations().getSelected().filter(isVisibleAnnotation);
    return selected[0] ?? null;
  };

  const interactive = (a: any) => {
    const flags: string[] = a?.flags ?? [];
    return !flags.includes("noView") && !flags.includes("hidden") && !flags.includes("readOnly") && ctx.lock.current.type !== LockModeType.All;
  };

  const stampBytes = (dataUrl: string) => {
    const bytes = dataUrlToBytes(dataUrl);
    if (!bytes) throw new Error("Invalid image data");
    return bytes;
  };

  /** Creates a stamp annotation; its app-side fields are recorded before the engine reports it. */
  const createStamp = async (dataUrl: string, pageIndex: number, x: number, y: number, width: number, height: number, extras: Record<string, any> = {}) => {
    const page = hub.pageByIndex(pageIndex);
    const id = newId();
    hub.setExtras(id, { imageSrc: dataUrl, subject: "Stamp", ...extras });
    const draft = {
      subtype: "stamp",
      nm: id,
      rect: legacyRectToPdf({ origin: { x, y }, size: { width, height } }, page),
      source: stampBytes(dataUrl),
      subject: "Stamp",
      flags: { print: true },
    } as AnnotationDraft;
    await annotations().create(page.pon as any, draft);
    return id;
  };

  const placeAt = async (dataUrl: string, pageIndex: number, x: number, y: number) => {
    const natural = await loadImageDimensions(dataUrl);
    const { width, height } = fitWithin(natural.width, natural.height);
    // The click point is where the stamp's top-left lands, as in 2.x.
    return createStamp(dataUrl, pageIndex, x, y, width, height, { ...(ctx.userInfo.current?.customData ? { customData: ctx.userInfo.current.customData } : {}), ...(ctx.userInfo.current?.author ? { author: ctx.userInfo.current.author } : {}) });
  };

  const deleteIds = async (ids: string[]) => {
    const refs = ids.map((id) => hub.refOf(id)).filter((ref): ref is NonNullable<typeof ref> => !!ref);
    for (const ref of refs) await hub.remove(ref);
    return refs.length > 0;
  };

  return {
    // ── tools ─────────────────────────────────────────────────────────────
    activateHighlighter: () => activate(TOOL.highlight),
    deactivateHighlighter: () => activate(null),
    isHighlighterActive: () => activeToolId() === TOOL.highlight,

    activateStamp: async (imageDataUrl) => {
      if (isLocked()) return;
      if (!imageDataUrl) {
        activate(TOOL.stamp);
        return;
      }
      try {
        const natural = await loadImageDimensions(imageDataUrl);
        const { width } = fitWithin(natural.width, natural.height);
        hub.setArmed({
          imageSrc: imageDataUrl,
          subject: "Stamp",
          ...(ctx.userInfo.current?.author ? { author: ctx.userInfo.current.author } : {}),
          ...(ctx.userInfo.current?.customData ? { customData: ctx.userInfo.current.customData } : {}),
        });
        await annotations().armStamp({ source: stampBytes(imageDataUrl), targetWidth: width, subject: "Stamp" });
      } catch (error) {
        console.error("Failed to activate custom stamp tool", error);
      }
    },
    deactivateStamp: () => {
      hub.setArmed(null);
      annotations().disarmStamp();
      if (activeToolId() === TOOL.stamp) activate(null);
    },
    isStampActive: () => activeToolId() === TOOL.stamp,
    activateSignature: () => activate(TOOL.signature),
    deactivateSignature: () => activate(null),
    isSignatureActive: () => activeToolId() === TOOL.signature,
    activateTool: (toolId) => activate(toolId),
    deactivateTool: () => activate(null),
    getActiveTool: () => {
      const id = activeToolId();
      return id && id !== "pointer" ? { id } : null;
    },

    // ── creating ──────────────────────────────────────────────────────────
    addStampAnnotation: (imageDataUrl, pageIndex, x, y, width, height, userInfo) => {
      if (isLocked()) return false;
      void createStamp(imageDataUrl, pageIndex, x, y, width, height, {
        ...(userInfo?.author ? { author: userInfo.author } : {}),
        ...(userInfo?.customData ? { customData: userInfo.customData } : {}),
      }).catch((error) => console.error("Failed to add stamp annotation", error));
      return true;
    },
    addSignatureAnnotation: () => {
      console.warn("addSignatureAnnotation is not supported. Use activateSignature() to let users draw a signature.");
      return false;
    },
    placeStampAtPosition: async (imageDataUrl, pageIndex, x, y) => {
      try {
        await placeAt(imageDataUrl, pageIndex, x, y);
      } catch (error) {
        console.error("Error placing stamp", error);
      }
      ctx.clickToPlace.current = null;
    },
    enableClickToPlace: (callback) => {
      ctx.clickToPlace.current = callback;
    },

    // ── deleting ──────────────────────────────────────────────────────────
    deleteSelectedAnnotation: () => {
      const dto = selectedDto();
      if (!dto || ctx.denyEdits()) return false;
      void hub.remove(dto.ref).catch((error) => console.error("Failed to delete annotation", error));
      return true;
    },
    deleteAnnotationById: (_pageIndex, annotationId) => {
      if (ctx.denyEdits()) return false;
      void deleteIds([annotationId]);
      return true;
    },
    deleteAnnotationsById: async (items) => (items.length && !ctx.denyEdits() ? deleteIds(items.map((i) => i.annotationId)) : false),

    // ── reading ───────────────────────────────────────────────────────────
    getSelectedAnnotation: () => {
      const dto = selectedDto();
      return dto ? hub.legacy(dto) : null;
    },
    getSelectedAnnotationDetails: () => {
      const dto = selectedDto();
      return dto ? hub.legacy(dto) : null;
    },
    getAllAnnotations: () => hub.list().map((dto) => hub.legacy(dto)),
    getAllAnnotationsWithMetadata: (annotationsArray?: any[]) =>
      (annotationsArray ?? hub.list().map((dto) => hub.legacy(dto))).map((a: any) => ({
        ...a,
        createdBy: a.createdBy || a.author || "Unknown",
        createdAt: a.createdAt || a.created || null,
        updatedAt: a.updatedAt || a.modified || null,
        userEmail: a.userEmail || null,
        userId: a.userId || null,
      })),
    exportAnnotationsAsJSON: () => {
      const all = hub.list().map((dto) => hub.legacy(dto));
      const byType: Record<string, number> = {};
      for (const a of all) byType[a.type] = (byType[a.type] || 0) + 1;
      return JSON.stringify(
        {
          documentInfo: { totalPages: kernel.capability(StageToken, documentId).pageCount(), exportedAt: new Date().toISOString() },
          annotations: all,
          summary: { totalAnnotations: all.length, byType },
        },
        null,
        2,
      );
    },
    onAnnotationEvent: (callback) => hub.subscribe(callback),
    onStateChange: (callback) => kernel.subscribe(() => callback(undefined)),

    // ── changing ──────────────────────────────────────────────────────────
    updateAnnotation: (_pageIndex, annotationId, updates) => {
      const dto = hub.find(annotationId);
      if (!dto) return false;
      const subtype = (dto as any).subtype;
      const patch: Record<string, any> = { subtype };
      let changedInEngine = false;
      const extras: Record<string, any> = {};
      for (const [key, value] of Object.entries(updates ?? {})) {
        if (key === "flags") {
          patch.flags = namesToFlags(value as string[]);
          changedInEngine = true;
        } else if (key === "rect" && (value as any)?.origin) {
          patch.rect = legacyRectToPdf(value as any, hub.page(dto.ref.pageObjectNumber));
          changedInEngine = true;
        } else if (key === "contents") {
          patch.contents = String(value ?? "");
          changedInEngine = true;
        } else if (!["id", "type", "pageIndex"].includes(key)) {
          // author / userId / createdBy / customData …: kept by the viewer only.
          extras[key] = value;
        }
      }
      if (Object.keys(extras).length) hub.setExtras(annotationId, extras);
      if (changedInEngine) {
        void annotations()
          .update(dto.ref, patch as any)
          .catch((error) => console.error("Failed to update annotation", String(error?.message ?? error)));
      }
      return true;
    },
    selectAnnotation: (_pageIndex, annotationId) => {
      if (annotationId === null) {
        annotations().deselect();
        return true;
      }
      const ref = hub.refOf(annotationId);
      if (!ref) return false;
      annotations().select(ref);
      return true;
    },
    importAnnotations: async (items) => {
      let success = 0;
      let failed = 0;
      for (const item of items) {
        const page = hub.pageByIndex(item.pageIndex);
        const legacy = { ...item.annotation };
        const draft = fromLegacy(legacy, page);
        if (!draft) {
          failed++;
          continue;
        }
        const id = String(legacy.id ?? (draft as any).nm ?? newId());
        (draft as any).nm = id;
        hub.setExtras(id, legacy);
        try {
          await hub.silently([id], () => annotations().create(page.pon as any, draft));
          success++;
        } catch (error) {
          console.error(`[importAnnotations] Failed to import annotation on page ${item.pageIndex}`, error);
          hub.forget(id);
          failed++;
        }
      }
      ctx.refresh();
      return { success, failed };
    },

    // ── locks ─────────────────────────────────────────────────────────────
    isAnnotationInteractive: (a) => interactive(a),
    isAnnotationStructurallyLocked: (a) => !interactive(a) || ((a as any)?.flags ?? []).includes("locked"),
    isAnnotationContentLocked: (a) => !interactive(a) || ((a as any)?.flags ?? []).includes("lockedContents"),
    setLocked: (mode) => {
      ctx.lock.current = mode;
      if (isLocked()) {
        annotations().disarmStamp();
        interaction()?.activateTool("pointer");
        annotations().deselect();
      }
      ctx.onLockChange();
    },
    getLocked: () => ctx.lock.current,
  };
};
