import type { Kernel } from "@embedpdf/react";
import { AnnotationToken } from "@embedpdf/plugin-annotation";
import { FormToken, fieldKeyOf } from "@embedpdf/plugin-form";
import type { FormFieldDTO } from "@embedpdf/plugin-form";
import { InteractionToken } from "@embedpdf/plugin-interaction";
import { AnnotationHub } from "../annotations/hub";
import { legacyRectToPdf, pdfRectToLegacy } from "../annotations/legacy";
import { BridgeToken } from "../bridge";
import type {
  FormFieldChanges,
  FormFieldDetails,
  FormFieldKind,
  FormFieldToolType,
  PDFFormState,
  RenameFormFieldResult,
} from "../types/public";
import { buildFilledPdf } from "./export";
import { FORM_FIELD_LABEL_MARKER, formatLabelText, layoutLabel } from "./labels";

const TOOL_IDS: Record<FormFieldToolType, string> = {
  text: "form-text",
  checkbox: "form-checkbox",
  radio: "form-radio",
  dropdown: "form-combobox",
  listbox: "form-listbox",
};

const KIND_OF_FAMILY: Record<string, FormFieldKind> = {
  text: "text",
  checkbox: "checkbox",
  radio: "radio",
  combobox: "dropdown",
  listbox: "listbox",
};

// Design mode: fields are annotations to select, move and resize. The pointer tool
// would hand them to the fill controls instead, so design mode has a tool of its own
// that edits annotations but does not fill forms.
const DESIGN_TOOL_ID = "cm-form-design";

const widgetId = (annotObjectNumber: number) => `widget-${annotObjectNumber}`;
const widgetNumber = (annotationId: string) => {
  const m = /^widget-(\d+)$/.exec(annotationId);
  return m ? Number(m[1]) : null;
};

const newId = () => globalThis.crypto?.randomUUID?.() ?? `a-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export interface FormsControllerOptions {
  onFormStateChange?: ((state: PDFFormState) => void) | undefined;
  onFormFieldSelect?: ((field: FormFieldDetails | null) => void) | undefined;
  /** The viewer's design-mode switch — field tools only work while it is on. */
  isDesigning: () => boolean;
  password: () => string | undefined;
}

/**
 * Everything the 2.x `forms` API did, on EmbedPDF 3's form plugin. A field is
 * addressed by the id of one of its widgets (`widget-<n>`), as before.
 */
export class FormsController {
  private baseline: { fieldCount: number; values: Record<string, string> } | null = null;
  private structureChanged = false;
  private state: PDFFormState = { hasFormFields: false, fieldCount: 0, isDirty: false };
  private selectedJson = "null";
  private selected: FormFieldDetails | null = null;
  /** Field object number → annotation id of its label. */
  private readonly labels = new Map<number, string>();
  readonly labelIds = new Set<string>();
  private offEvents: (() => void) | null = null;
  private offKernel: (() => void) | null = null;
  private relayout = new Map<number, ReturnType<typeof setTimeout>>();
  private disposed = false;

  constructor(
    private readonly kernel: Kernel,
    readonly documentId: string,
    private readonly hub: AnnotationHub,
    private readonly options: FormsControllerOptions,
  ) {}

  private get form() {
    return this.kernel.capability(FormToken, this.documentId);
  }
  private get annotations() {
    return this.kernel.capability(AnnotationToken, this.documentId);
  }
  private get bridge() {
    return this.kernel.capability(BridgeToken, this.documentId);
  }
  private get interaction() {
    return this.kernel.tryCapability(InteractionToken, this.documentId) ?? this.kernel.tryCapability(InteractionToken);
  }

  start() {
    this.offEvents = this.bridge.onDocumentEvent((event: any) => this.onEngineEvent(event));
    this.offKernel = this.kernel.subscribe(() => this.onKernelChange());
    this.onKernelChange();
  }

  dispose() {
    this.disposed = true;
    this.offEvents?.();
    this.offKernel?.();
    this.relayout.forEach((timer) => clearTimeout(timer));
  }

  // ── reading ─────────────────────────────────────────────────────────────
  fields(): readonly FormFieldDTO[] {
    return this.form.snapshot()?.fields ?? [];
  }

  private values(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const field of this.fields()) out[field.name] = String((field as any).value ?? "");
    return out;
  }

  private fieldOfWidget(annotationId: string): FormFieldDTO | null {
    const n = widgetNumber(annotationId);
    return n === null ? null : this.form.fieldForWidget(n);
  }

  private widgetDto(annotationId: string): any | null {
    const n = widgetNumber(annotationId);
    if (n === null) return null;
    const field = this.form.fieldForWidget(n);
    const widget = field?.widgets.find((w) => w.annotObjectNumber === n);
    if (!widget) return null;
    return this.annotations
      .list(widget.pageObjectNumber)
      .find((a: any) => a.subtype === "widget" && a.ref.annotObjectNumber === n);
  }

  getState(): PDFFormState {
    return this.state;
  }

  getFormFields() {
    return this.fields().map((field: any) => ({
      name: field.name,
      type: field.family,
      value: String(field.value ?? ""),
      readOnly: !!field.flags?.readOnly,
      required: !!field.flags?.required,
      ...(field.maxLength ? { maxLength: field.maxLength } : {}),
      annotationId: field.widgets[0] ? widgetId(field.widgets[0].annotObjectNumber) : undefined,
    }));
  }

  getFormValues() {
    return this.values();
  }

  async setFormValues(values: Record<string, string>): Promise<boolean> {
    let ok = true;
    for (const field of this.fields() as any[]) {
      if (!(field.name in values)) continue;
      const value = values[field.name]!;
      const key = fieldKeyOf(field);
      try {
        if (field.family === "text") await this.form.setText(key, value);
        else if (field.family === "checkbox" || field.family === "radio") await this.form.toggle(key, value === "Off" || value === "" ? null : value);
        else await this.form.choose(key, value === "" ? [] : [value]);
      } catch (error) {
        console.error(`[PDFViewer] could not set "${field.name}":`, error);
        ok = false;
      }
    }
    this.publishState();
    return ok;
  }

  // ── state ───────────────────────────────────────────────────────────────
  private lastSnapshot: unknown = null;

  private onKernelChange() {
    if (this.disposed) return;
    const snapshot = this.form.snapshot();
    if (!this.baseline && snapshot) this.markSaved();
    // The model updates a moment after the engine reports a write (a field commits
    // on blur), so the saved/dirty state follows the snapshot itself.
    else if (snapshot !== this.lastSnapshot) this.publishState();
    this.lastSnapshot = snapshot;
    this.publishSelection();
  }

  private onEngineEvent(event: any) {
    const type: string = event.type;
    if (type.startsWith("form.")) {
      if (type !== "form.valueChanged" && type !== "form.effectsApplied") this.structureChanged = true;
      this.publishState();
      return;
    }
    if (type.startsWith("annotation.")) {
      const dto = event.created ?? event.updated;
      if (dto?.subtype === "widget") {
        this.structureChanged = true;
        if (type === "annotation.updated") this.scheduleRelayout(dto.fieldObjectNumber);
        this.publishState();
      }
    }
  }

  publishState() {
    if (this.disposed) return;
    const values = this.values();
    const fieldCount = this.fields().length;
    const base = this.baseline;
    const next: PDFFormState = {
      hasFormFields: fieldCount > 0,
      fieldCount,
      isDirty:
        this.structureChanged ||
        (!!base && (fieldCount !== base.fieldCount || JSON.stringify(values) !== JSON.stringify(base.values))),
    };
    const prev = this.state;
    this.state = next;
    if (prev.hasFormFields !== next.hasFormFields || prev.fieldCount !== next.fieldCount || prev.isDirty !== next.isDirty) {
      this.options.onFormStateChange?.(next);
    }
  }

  /** The current fields and values count as saved. */
  markSaved() {
    this.structureChanged = false;
    this.baseline = { fieldCount: this.fields().length, values: this.values() };
    this.publishState();
  }

  // ── the PDF ─────────────────────────────────────────────────────────────
  async getFilledPdf(): Promise<ArrayBuffer> {
    return buildFilledPdf({
      kernel: this.kernel,
      documentId: this.documentId,
      hub: this.hub,
      labelIds: this.labelIds,
      password: this.options.password(),
    });
  }

  // ── design mode ─────────────────────────────────────────────────────────
  enterDesign() {
    const interaction = this.interaction;
    if (!interaction) return;
    interaction.registerTool({
      id: DESIGN_TOOL_ID,
      cursor: "default",
      enables: new Set(["annotation-edit", "annotation-marquee", "text-select"]),
    });
    interaction.activateTool(DESIGN_TOOL_ID);
  }

  exitDesign() {
    const interaction = this.interaction;
    if (!interaction) return;
    const active = interaction.activeToolId();
    if (active === DESIGN_TOOL_ID || this.getActiveTool()) interaction.activateTool("pointer");
  }

  // ── field tools ─────────────────────────────────────────────────────────
  activateTool(type: FormFieldToolType) {
    if (!this.options.isDesigning()) {
      console.warn("[PDFViewer] activateFieldTool: enable form design mode (enableFormDesign) first");
      return;
    }
    this.interaction?.activateTool(TOOL_IDS[type]);
  }

  /** Disarms a field tool; in design mode the design tool takes over again. */
  deactivateTool() {
    if (!this.getActiveTool()) return;
    if (this.options.isDesigning()) this.interaction?.activateTool(DESIGN_TOOL_ID);
    else this.interaction?.activateTool("pointer");
  }

  getActiveTool(): FormFieldToolType | null {
    const id = this.interaction?.activeToolId();
    const entry = Object.entries(TOOL_IDS).find(([, toolId]) => toolId === id);
    return entry ? (entry[0] as FormFieldToolType) : null;
  }

  // ── the selected field ──────────────────────────────────────────────────
  private detailsOf(field: any, widget: any): FormFieldDetails {
    const labelId = this.labels.get(field.fieldObjectNumber);
    const label = labelId ? (this.hub.getExtras(labelId)?.custom?.labelText ?? "") : "";
    const options = Array.isArray(field.options)
      ? field.options.map((o: any) => ({ label: o.label ?? String(o.value ?? ""), isSelected: !!(o.selected ?? o.isSelected ?? (field.selected ?? []).includes?.(o.value)) }))
      : undefined;
    return {
      annotationId: widgetId(widget.ref.annotObjectNumber),
      pageIndex: this.hub.page(widget.ref.pageObjectNumber).index,
      kind: KIND_OF_FAMILY[field.family] ?? "other",
      name: field.name,
      value: String(field.value ?? ""),
      ...(field.maxLength ? { maxLen: field.maxLength } : {}),
      ...(options ? { options } : {}),
      readOnly: !!field.flags?.readOnly,
      required: !!field.flags?.required,
      multiline: !!field.multiline,
      comb: !!field.comb,
      multiSelect: !!field.multiSelect,
      label,
    };
  }

  getSelectedField(): FormFieldDetails | null {
    return this.selected;
  }

  private publishSelection() {
    let next: FormFieldDetails | null = null;
    try {
      const widget: any = this.annotations.getSelected().find((a: any) => a.subtype === "widget");
      if (widget) {
        const field = this.fields().find((f: any) => f.fieldObjectNumber === widget.fieldObjectNumber);
        if (field) next = this.detailsOf(field, widget);
      }
    } catch {
      return;
    }
    const json = JSON.stringify(next);
    if (json === this.selectedJson) return;
    this.selectedJson = json;
    this.selected = next;
    this.options.onFormFieldSelect?.(next);
  }

  // ── editing fields ──────────────────────────────────────────────────────
  updateField(annotationId: string, changes: FormFieldChanges): boolean {
    const field: any = this.fieldOfWidget(annotationId);
    const widget = this.widgetDto(annotationId);
    if (!field || !widget) return false;
    const { label, ...fieldChanges } = changes;
    if (Object.keys(fieldChanges).length > 0) void this.writeField(field, fieldChanges);
    if (label !== undefined) void this.setLabel(widget, field, label).catch((e) => console.error("[PDFViewer] label failed:", e));
    this.structureChanged = true;
    this.publishState();
    return true;
  }

  private async writeField(field: any, changes: Omit<FormFieldChanges, "label">) {
    const key = fieldKeyOf(field);
    const patch: Record<string, any> = { family: field.family };
    if (changes.readOnly !== undefined) patch.readOnly = changes.readOnly;
    if (changes.required !== undefined) patch.required = changes.required;
    if (field.family === "text") {
      if (changes.maxLen !== undefined) {
        // 0 / null removes the limit — and the comb layout, which needs one.
        const maxLength = changes.maxLen && changes.maxLen > 0 ? Math.floor(changes.maxLen) : null;
        patch.maxLength = maxLength;
        if (!maxLength) patch.comb = false;
      }
      if (changes.multiline !== undefined) patch.multiline = changes.multiline;
      if (changes.comb !== undefined && patch.comb === undefined) patch.comb = changes.comb;
      if (changes.value !== undefined) patch.defaultValue = changes.value;
    } else if (field.family === "combobox" || field.family === "listbox") {
      if (changes.options !== undefined) patch.options = changes.options.map((o) => ({ label: o.label, value: o.label }));
      if (field.family === "listbox" && changes.multiSelect !== undefined) patch.multiSelect = changes.multiSelect;
    }
    try {
      await this.form.updateField(key, patch as any);
      if (field.family === "text" && changes.value !== undefined) await this.form.setText(key, changes.value);
      if (changes.options) {
        const selected = changes.options.filter((o) => o.isSelected).map((o) => o.label);
        if (selected.length || changes.options.length) await this.form.choose(key, selected);
      }
    } catch (error) {
      console.error("[PDFViewer] could not update the field:", error);
    }
    this.publishSelection();
    this.publishState();
  }

  async renameField(annotationId: string, name: string): Promise<RenameFormFieldResult> {
    const field: any = this.fieldOfWidget(annotationId);
    if (!field) return { outcome: "no-op" };
    const trimmed = name.trim();
    if (!trimmed || trimmed === field.name) return { outcome: "no-op" };
    const clash: any = this.fields().find((f: any) => f.name === trimmed && f.fieldObjectNumber !== field.fieldObjectNumber);
    if (clash) {
      const target = clash.widgets[0];
      return { outcome: "conflict", fieldName: clash.name, targetAnnotationId: target ? widgetId(target.annotObjectNumber) : "" };
    }
    await this.form.updateField(fieldKeyOf(field), { family: field.family, name: trimmed } as any);
    this.structureChanged = true;
    this.publishSelection();
    this.publishState();
    return { outcome: "renamed" };
  }

  /** Makes the widget a view of the target widget's field. */
  async shareField(annotationId: string, targetAnnotationId: string): Promise<boolean> {
    const n = widgetNumber(annotationId);
    const source: any = this.fieldOfWidget(annotationId);
    const target: any = this.fieldOfWidget(targetAnnotationId);
    if (n === null || !source || !target || source.fieldObjectNumber === target.fieldObjectNumber) return false;
    const widget = source.widgets.find((w: any) => w.annotObjectNumber === n);
    if (!widget) return false;
    try {
      const forms = this.bridge.doc().forms;
      await forms.detachWidget(source.ref, widget);
      await forms.attachWidget(target.ref, widget);
      await this.form.refresh();
      // A field left with no widgets goes away.
      const left: any = this.fields().find((f: any) => f.fieldObjectNumber === source.fieldObjectNumber);
      if (left && left.widgets.length === 0) await forms.deleteField(left.ref).catch(() => undefined);
      await this.form.refresh();
    } catch (error) {
      console.error("[PDFViewer] could not share the field:", error);
      return false;
    }
    this.structureChanged = true;
    this.publishSelection();
    this.publishState();
    return true;
  }

  /** Deletes the widget — and its field, once it is the field's last widget. */
  deleteField(annotationId: string): boolean {
    const field: any = this.fieldOfWidget(annotationId);
    const n = widgetNumber(annotationId);
    const widget = this.widgetDto(annotationId);
    if (!field || n === null || !widget) return false;
    void this.removeWidget(field, n, widget).catch((error) => {
      const merged = /attached to a form field/.test(String(error?.message));
      console.error(
        merged
          ? `[PDFViewer] could not delete "${field.name}": its widget and field are one PDF object (as in many Acrobat/Word forms), and this EmbedPDF 3 engine build cannot delete those yet.`
          : "[PDFViewer] could not delete the field:",
        merged ? "" : error,
      );
    });
    return true;
  }

  private async removeWidget(field: any, n: number, widget: any) {
    const forms = this.bridge.doc().forms;
    const labelId = this.labels.get(field.fieldObjectNumber);
    if (labelId) {
      const ref = this.hub.refOf(labelId);
      if (ref) await this.annotations.delete(ref).catch(() => undefined);
      this.labels.delete(field.fieldObjectNumber);
      this.labelIds.delete(labelId);
    }
    if (field.widgets.length > 1) {
      // One widget of a group: take just that one off the field, then off the page.
      const own = field.widgets.find((w: any) => w.annotObjectNumber === n);
      await forms.detachWidget(field.ref, own);
      await this.annotations.delete(widget.ref);
    } else {
      await this.form.deleteField(fieldKeyOf(field));
    }
    this.annotations.deselect();
    this.structureChanged = true;
    this.publishState();
  }

  // ── labels ──────────────────────────────────────────────────────────────
  private scheduleRelayout(fieldObjectNumber: number | undefined) {
    if (fieldObjectNumber === undefined || !this.labels.has(fieldObjectNumber)) return;
    clearTimeout(this.relayout.get(fieldObjectNumber));
    this.relayout.set(
      fieldObjectNumber,
      setTimeout(() => {
        const field: any = this.fields().find((f: any) => f.fieldObjectNumber === fieldObjectNumber);
        const first = field?.widgets[0];
        if (!field || !first) return;
        const widget = this.widgetDto(widgetId(first.annotObjectNumber));
        const labelId = this.labels.get(fieldObjectNumber)!;
        const text = this.hub.getExtras(labelId)?.custom?.labelText;
        if (widget && text) void this.setLabel(widget, field, text).catch(() => undefined);
      }, 80),
    );
  }

  /** Creates, moves, re-words or (for empty text) removes the label of a field. */
  private async setLabel(widget: any, field: any, text: string) {
    const trimmed = text.trim();
    const existingId = this.labels.get(field.fieldObjectNumber);
    if (!trimmed) {
      if (existingId) {
        const ref = this.hub.refOf(existingId);
        if (ref) await this.annotations.delete(ref);
        this.labels.delete(field.fieldObjectNumber);
        this.labelIds.delete(existingId);
      }
      this.publishSelection();
      return;
    }
    const page = this.hub.page(widget.ref.pageObjectNumber);
    const box = pdfRectToLegacy(widget.rect, page);
    const contents = formatLabelText(trimmed);
    const layout = layoutLabel(
      { x: box.origin.x, y: box.origin.y, width: box.size.width, height: box.size.height, fontSize: widget.fontSize },
      contents,
      page.width,
    );
    const rect = legacyRectToPdf({ origin: { x: layout.rect.x, y: layout.rect.y }, size: { width: layout.rect.width, height: layout.rect.height } }, page);
    const custom = { [FORM_FIELD_LABEL_MARKER]: true, fieldId: widgetId(widget.ref.annotObjectNumber), labelText: trimmed };

    const existingRef = existingId ? this.hub.refOf(existingId) : null;
    if (existingId && existingRef) {
      this.hub.setExtras(existingId, { custom });
      await this.annotations.update(existingRef, { subtype: "free-text", contents, rect, fontSize: layout.fontSize, textAlign: layout.textAlign } as any);
    } else {
      const id = newId();
      this.hub.setExtras(id, { custom });
      this.labels.set(field.fieldObjectNumber, id);
      this.labelIds.add(id);
      await this.hub.silently([id], () =>
        this.annotations.create(widget.ref.pageObjectNumber, {
          subtype: "free-text",
          nm: id,
          intent: "free-text",
          fontFamily: "helvetica",
          fontSize: layout.fontSize,
          textAlign: layout.textAlign,
          fontColor: { r: 0, g: 0, b: 0 },
          // Just the words: no border, no fill.
          strokeWidth: 0,
          interiorColor: null,
          contents,
          rect,
          flags: { print: true, readOnly: true },
        } as any),
      );
    }
    this.publishSelection();
  }
}
