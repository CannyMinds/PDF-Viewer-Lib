import type { Kernel } from "@embedpdf/react";
import { AnnotationToken } from "@embedpdf/plugin-annotation";
import type { AnnotationDTO, AnnotationRef } from "@embedpdf/plugin-annotation";
import { StageToken } from "@embedpdf/react";
import { BridgeToken } from "../bridge";
import { DEFAULT_PAGE, toLegacy } from "./legacy";
import type { Extras, PageGeometry } from "./legacy";

export type LegacyAnnotationEvent = {
  type: "create" | "update" | "delete" | "select" | "deselect";
  annotation: Record<string, any>;
  committed: boolean;
};

// Annotation kinds that belong to other features (form widgets, link areas,
// popups): they never appear in the annotation API.
const HIDDEN_SUBTYPES = new Set(["widget", "link", "popup"]);
export const isVisibleAnnotation = (dto: AnnotationDTO) => !HIDDEN_SUBTYPES.has((dto as any).subtype);

/**
 * The bridge between EmbedPDF 3 annotations and the 2.x annotation API: page
 * geometry, the app's own per-annotation fields, and the create / update /
 * delete / select events 2.x consumers listen for.
 */
export class AnnotationHub {
  private readonly pages = new Map<number, PageGeometry>();
  private readonly extras = new Map<string, Extras>();
  /** Last known 2.x object per annotation object number — a delete event only carries the number. */
  private readonly known = new Map<number, Record<string, any>>();
  /** Annotations being created by importAnnotations(): created silently, as in 2.x. */
  private readonly silent = new Set<string>();
  /** Ids given to annotations the engine leaves unnamed (tool-placed stamps), by object number. */
  private readonly aliases = new Map<number, string>();
  /** Updates the viewer makes itself (e.g. switching a flag on) that are not user actions. */
  private readonly quiet = new Set<string>();
  /** Ids of annotations that are not part of the original file: imported, or created in the viewer. */
  private readonly added = new Set<string>();
  /** Fields for the next annotation a tool places — set while a stamp image is armed. */
  private armed: Extras | null = null;
  private readonly listeners = new Set<(event: LegacyAnnotationEvent) => void>();
  private offEvents: (() => void) | null = null;
  private offSelection: (() => void) | null = null;
  private selected: string[] = [];
  private disposed = false;

  constructor(
    private readonly kernel: Kernel,
    readonly documentId: string,
  ) {}

  private get annotations() {
    return this.kernel.capability(AnnotationToken, this.documentId);
  }
  private get stage() {
    return this.kernel.capability(StageToken, this.documentId);
  }
  private get bridge() {
    return this.kernel.capability(BridgeToken, this.documentId);
  }

  /** Loads page geometry and starts translating engine events. */
  async start() {
    const snapshot: any = await this.bridge.doc().pages.list();
    if (this.disposed) return;
    for (const p of snapshot.pages as any[]) {
      const crop = p.boxes?.crop ?? p.boxes?.media ?? { left: 0, top: p.size.height, right: p.size.width, bottom: 0 };
      this.pages.set(p.pageObjectNumber, {
        index: p.index,
        pon: p.pageObjectNumber,
        width: crop.right - crop.left,
        height: crop.top - crop.bottom,
        left: crop.left,
        top: crop.top,
      });
    }
    // What is already there is "known", so deleting it later can be reported.
    for (const dto of this.list()) this.remember(dto);

    this.offEvents = this.bridge.onDocumentEvent((event: any) => this.onEngineEvent(event));
    this.offSelection = this.kernel.subscribe(() => this.onSelectionMaybeChanged());
  }

  dispose() {
    this.disposed = true;
    this.offEvents?.();
    this.offSelection?.();
    this.listeners.clear();
  }

  // ── geometry ────────────────────────────────────────────────────────────
  page(pon: number): PageGeometry {
    const known = this.pages.get(pon);
    if (known) return known;
    const index = this.stage.pages().find((p) => p.pon === pon)?.index ?? 0;
    return { index, pon, ...DEFAULT_PAGE };
  }

  pageByIndex(index: number): PageGeometry {
    for (const page of this.pages.values()) if (page.index === index) return page;
    const pon = this.stage.pages().find((p) => p.index === index)?.pon ?? 0;
    return { index, pon, ...DEFAULT_PAGE };
  }

  // ── reading ─────────────────────────────────────────────────────────────
  /** Every user-facing annotation in the document. */
  list(): AnnotationDTO[] {
    const out: AnnotationDTO[] = [];
    for (const page of this.stage.pages()) {
      for (const dto of this.annotations.list(page.pon)) if (isVisibleAnnotation(dto)) out.push(dto);
    }
    return out;
  }

  /** The annotation's id: its name in the PDF, or a UUID the viewer assigned. */
  idOf(dto: AnnotationDTO): string {
    const nm = (dto as any).nm;
    if (nm) return nm;
    const number = dto.ref.annotObjectNumber;
    let alias = this.aliases.get(number);
    if (!alias) {
      alias = globalThis.crypto?.randomUUID?.() ?? `a-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      this.aliases.set(number, alias);
    }
    return alias;
  }

  /** Whether the annotation was added after the document was opened. */
  isAdded(id: string): boolean {
    return this.added.has(id);
  }

  /** Fields applied to the next annotation created without an id, until cleared (null). */
  setArmed(extras: Extras | null) {
    this.armed = extras;
  }

  legacy(dto: AnnotationDTO): Record<string, any> {
    const id = this.idOf(dto);
    return { ...toLegacy(dto, this.page(dto.ref.pageObjectNumber), this.extras.get(id)), id };
  }

  /** The annotation with this 2.x id, wherever it is. */
  find(id: string): AnnotationDTO | null {
    return this.list().find((dto) => this.idOf(dto) === id) ?? null;
  }

  refOf(id: string): AnnotationRef | null {
    return this.find(id)?.ref ?? null;
  }

  /**
   * Deletes an annotation. In 2.x a `locked` annotation was only frozen in place
   * (the app decides who may delete it); EmbedPDF 3 also refuses to delete it,
   * so the lock is lifted first.
   */
  async remove(ref: AnnotationRef): Promise<void> {
    const dto: any = this.annotations.get(ref);
    if (dto?.flags?.locked) await this.annotations.update(ref, { subtype: dto.subtype, flags: { locked: false } } as any);
    await this.annotations.delete(ref);
  }

  // ── the app's own fields ────────────────────────────────────────────────
  setExtras(id: string, extras: Extras) {
    this.extras.set(id, { ...this.extras.get(id), ...extras });
  }
  getExtras(id: string): Extras | undefined {
    return this.extras.get(id);
  }
  forget(id: string) {
    this.extras.delete(id);
  }

  /** Runs `create`, without reporting what it creates as a user action. */
  async silently<T>(ids: string[], create: () => Promise<T>): Promise<T> {
    ids.forEach((id) => this.silent.add(id));
    try {
      return await create();
    } finally {
      // Engine events arrive a moment after the create resolves.
      setTimeout(() => ids.forEach((id) => this.silent.delete(id)), 1500);
    }
  }

  // ── events ──────────────────────────────────────────────────────────────
  subscribe(listener: (event: LegacyAnnotationEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: LegacyAnnotationEvent) {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error("[PDFViewer] annotation listener failed:", error);
      }
    });
  }

  private remember(dto: AnnotationDTO) {
    this.known.set(dto.ref.annotObjectNumber, this.legacy(dto));
  }

  private onEngineEvent(event: any) {
    switch (event.type) {
      case "annotation.created":
      case "annotation.updated": {
        const created = event.type === "annotation.created";
        const sent: AnnotationDTO | undefined = created ? event.created : event.updated;
        if (!sent || !isVisibleAnnotation(sent)) return;
        // The event can lag behind: read the live state when it is there.
        const dto = this.annotations.get(sent.ref) ?? sent;
        const id = this.idOf(dto);
        if (created && this.armed && (dto as any).subtype === "stamp" && !this.extras.has(id)) {
          this.extras.set(id, { ...this.armed });
        }
        const legacy = this.legacy(dto);
        this.known.set(dto.ref.annotObjectNumber, legacy);
        if (created) {
          this.added.add(id);
          this.ensurePrintable(dto);
        }
        if (created && this.silent.has(id)) return;
        if (!created && this.quiet.delete(id)) return;
        this.emit({ type: created ? "create" : "update", annotation: legacy, committed: true });
        return;
      }
      case "annotation.deleted": {
        const removed = event.deleted?.kind === "objectNumber" ? [event.deleted.value] : (event.meta?.changed ?? []).map((c: any) => c.value);
        for (const number of removed as number[]) {
          const legacy = this.known.get(number);
          if (!legacy) continue;
          this.known.delete(number);
          this.extras.delete(String(legacy.id));
          this.emit({ type: "delete", annotation: legacy, committed: true });
        }
        return;
      }
    }
  }

  // Annotations print by default (a PDF without the Print flag never prints them).
  // The engine reports an annotation a moment before the plugin can address it,
  // so the update is retried until the plugin knows it.
  private ensurePrintable(dto: AnnotationDTO) {
    const d: any = dto;
    if (d.flags?.hidden || d.flags?.noView) return;
    // An annotation that already prints and already has a name needs nothing.
    if (d.flags?.print && d.nm) return;
    const id = this.idOf(dto);
    this.quiet.add(id);
    const attempt = (triesLeft: number) => {
      if (this.disposed) return;
      this.annotations
        .update(dto.ref, { subtype: d.subtype, flags: { print: true } } as any)
        .catch(() => {
          if (triesLeft > 0) setTimeout(() => attempt(triesLeft - 1), 250);
          else this.quiet.delete(id);
        });
    };
    setTimeout(() => attempt(6), 150);
  }

  private onSelectionMaybeChanged() {
    let ids: string[];
    try {
      ids = this.annotations.getSelected().filter(isVisibleAnnotation).map((dto) => this.idOf(dto));
    } catch {
      return;
    }
    if (ids.length === this.selected.length && ids.every((id, i) => id === this.selected[i])) return;
    const previous = this.selected;
    this.selected = ids;
    for (const id of previous.filter((p) => !ids.includes(p))) {
      const last = [...this.known.values()].find((a) => a.id === id);
      if (last) this.emit({ type: "deselect", annotation: last, committed: true });
    }
    for (const id of ids.filter((i) => !previous.includes(i))) {
      const dto = this.find(id);
      if (dto) this.emit({ type: "select", annotation: this.legacy(dto), committed: true });
    }
  }
}
