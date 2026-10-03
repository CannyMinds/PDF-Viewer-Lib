import type { AnnotationCapability, AnnotationDTO } from "@embedpdf/plugin-annotation";

// The 2.x viewer described annotations with numeric subtypes, top-left page
// coordinates and string flag lists — and that is what consuming apps keep in
// their databases. EmbedPDF 3 uses named subtypes, PDF user space (origin at the
// bottom-left) and boolean flag maps. This module converts both ways.

export type AnnotationDraft = Parameters<AnnotationCapability["create"]>[1];

/** A page's position in PDF user space: the crop box that the viewer displays. */
export interface PageGeometry {
  index: number;
  pon: number;
  width: number;
  height: number;
  /** Crop box left / top edge, in PDF user space. */
  left: number;
  top: number;
}

export const DEFAULT_PAGE: Omit<PageGeometry, "index" | "pon"> = { width: 612, height: 792, left: 0, top: 792 };

export const SUBTYPE_TO_TYPE: Record<string, number> = {
  text: 1,
  link: 2,
  "free-text": 3,
  line: 4,
  square: 5,
  circle: 6,
  polygon: 7,
  polyline: 8,
  highlight: 9,
  underline: 10,
  squiggly: 11,
  strikeout: 12,
  stamp: 13,
  caret: 14,
  ink: 15,
  "file-attachment": 17,
  widget: 20,
  redact: 28,
};
export const TYPE_TO_SUBTYPE: Record<number, string> = Object.fromEntries(
  Object.entries(SUBTYPE_TO_TYPE).map(([subtype, type]) => [type, subtype]),
);

const BLEND_MODES = [
  "normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn",
  "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity",
] as const;
type BlendMode = (typeof BLEND_MODES)[number];
const blendToNumber = (mode: string | undefined) => Math.max(BLEND_MODES.indexOf((mode ?? "normal") as BlendMode), 0);
const numberToBlend = (value: unknown): BlendMode =>
  typeof value === "number" ? (BLEND_MODES[value] ?? "normal") : BLEND_MODES.includes(value as BlendMode) ? (value as BlendMode) : "normal";

export const FLAG_NAMES = [
  "invisible", "hidden", "print", "noZoom", "noRotate", "noView", "readOnly", "locked", "toggleNoView", "lockedContents",
] as const;
export type FlagName = (typeof FLAG_NAMES)[number];

export const flagsToNames = (flags: Record<string, boolean> | undefined): string[] =>
  flags ? FLAG_NAMES.filter((name) => flags[name]) : [];

/** A patch for the engine: every flag the 2.x list names is on, every other one off. */
export const namesToFlags = (names: readonly string[] | undefined): Record<FlagName, boolean> =>
  Object.fromEntries(FLAG_NAMES.map((name) => [name, !!names?.includes(name)])) as Record<FlagName, boolean>;

// ── colors ────────────────────────────────────────────────────────────────
const hex = (n: number) => Math.round(Math.min(Math.max(n, 0), 255)).toString(16).padStart(2, "0");
export const colorToHex = (c: { r: number; g: number; b: number } | null | undefined): string | undefined =>
  c ? `#${hex(c.r)}${hex(c.g)}${hex(c.b)}`.toUpperCase() : undefined;

export const hexToColor = (value: unknown): { r: number; g: number; b: number } | undefined => {
  if (typeof value === "string") {
    const m = /^#?([0-9a-f]{6})$/i.exec(value.trim());
    if (m) {
      const n = parseInt(m[1]!, 16);
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
  }
  if (value && typeof value === "object") {
    const o = value as Record<string, number>;
    if ("r" in o) return { r: o.r!, g: o.g!, b: o.b! };
    if ("red" in o) return { r: o.red!, g: o.green!, b: o.blue! };
  }
  return undefined;
};

// ── geometry ──────────────────────────────────────────────────────────────
type TopLeftRect = { origin: { x: number; y: number }; size: { width: number; height: number } };
type PdfRect = { left: number; top: number; right: number; bottom: number };

export const pdfRectToLegacy = (rect: PdfRect, page: PageGeometry): TopLeftRect => ({
  origin: { x: rect.left - page.left, y: page.top - Math.max(rect.top, rect.bottom) },
  size: { width: Math.abs(rect.right - rect.left), height: Math.abs(rect.top - rect.bottom) },
});

export const legacyRectToPdf = (rect: TopLeftRect, page: PageGeometry): PdfRect => ({
  left: rect.origin.x + page.left,
  right: rect.origin.x + rect.size.width + page.left,
  top: page.top - rect.origin.y,
  bottom: page.top - rect.origin.y - rect.size.height,
});

const quadToLegacyRect = (q: { p1: any; p2: any; p3: any; p4: any }, page: PageGeometry): TopLeftRect => {
  const xs = [q.p1.x, q.p2.x, q.p3.x, q.p4.x];
  const ys = [q.p1.y, q.p2.y, q.p3.y, q.p4.y];
  return pdfRectToLegacy({ left: Math.min(...xs), right: Math.max(...xs), top: Math.max(...ys), bottom: Math.min(...ys) }, page);
};

const legacyRectToQuad = (rect: TopLeftRect, page: PageGeometry) => {
  const r = legacyRectToPdf(rect, page);
  return { p1: { x: r.left, y: r.top }, p2: { x: r.right, y: r.top }, p3: { x: r.left, y: r.bottom }, p4: { x: r.right, y: r.bottom } };
};

// ── annotation → 2.x object ───────────────────────────────────────────────
/** What the app attached to an annotation that the PDF itself does not hold. */
export type Extras = Record<string, any>;

/**
 * The 2.x object for an annotation. `extras` carries the app's own fields
 * (author / userId / customData / imageSrc …), which 3.x does not store.
 */
export const toLegacy = (dto: AnnotationDTO, page: PageGeometry, extras: Extras = {}): Record<string, any> => {
  const d: any = dto;
  const type = SUBTYPE_TO_TYPE[d.subtype] ?? 0;
  const out: Record<string, any> = {
    // `extras` first: the PDF's own state below always wins over what the app remembers.
    ...extras,
    id: d.nm ?? `annot-${d.ref.annotObjectNumber}`,
    type,
    pageIndex: page.index,
    rect: pdfRectToLegacy(d.rect, page),
    flags: flagsToNames(d.flags),
    blendMode: blendToNumber(d.blendMode),
  };
  if (d.author != null) out.author = extras.author ?? d.author;
  if (d.created != null && out.created == null) out.created = d.created;
  if (d.modified != null) out.modified = d.modified;
  if (d.contents != null) out.contents = d.contents;
  if (d.subject != null && out.subject == null) out.subject = d.subject;
  if (d.opacity != null) out.opacity = d.opacity;

  const color = colorToHex(d.color);
  if (color) {
    out.color = color;
    out.strokeColor = color;
  }
  switch (d.subtype) {
    case "highlight":
    case "underline":
    case "squiggly":
    case "strikeout":
      out.segmentRects = (d.quadPoints ?? []).map((q: any) => quadToLegacyRect(q, page));
      break;
    case "ink":
      out.inkList = (d.inkList ?? []).map((stroke: any[]) => ({
        points: stroke.map((p) => ({ x: p.x - page.left, y: page.top - p.y })),
      }));
      out.strokeWidth = d.strokeWidth;
      break;
    case "text":
      out.icon = d.icon;
      break;
    case "free-text":
      out.fontColor = colorToHex(d.fontColor);
      out.fontSize = d.fontSize;
      break;
  }
  return out;
};

// ── 2.x object → draft ────────────────────────────────────────────────────
const dataUrlToBytes = (dataUrl: string): Uint8Array | null => {
  const m = /^data:[^;,]*(;base64)?,(.*)$/s.exec(dataUrl);
  if (!m) return null;
  const raw = m[1] ? atob(m[2]!) : decodeURIComponent(m[2]!);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
};
export { dataUrlToBytes };

const colorOf = (a: Record<string, any>, ...keys: string[]) => {
  for (const key of keys) {
    const c = hexToColor(a[key]);
    if (c) return c;
  }
  return undefined;
};

/** A create-draft for a 2.x annotation object, or null for kinds the viewer cannot author. */
export const fromLegacy = (a: Record<string, any>, page: PageGeometry): AnnotationDraft | null => {
  const subtype = TYPE_TO_SUBTYPE[a.type as number];
  const rect = a.rect?.origin ? legacyRectToPdf(a.rect, page) : null;
  const base: Record<string, any> = {
    ...(a.id ? { nm: String(a.id) } : {}),
    ...(a.contents != null ? { contents: String(a.contents) } : {}),
    ...(a.subject != null ? { subject: String(a.subject) } : {}),
    ...(Array.isArray(a.flags) ? { flags: namesToFlags(a.flags) } : {}),
  };

  switch (subtype) {
    case "highlight":
    case "underline":
    case "squiggly":
    case "strikeout": {
      const segments: TopLeftRect[] = a.segmentRects?.length ? a.segmentRects : a.rect ? [a.rect] : [];
      if (!segments.length) return null;
      const quads = segments.map((s) => legacyRectToQuad(s, page));
      const xs = quads.flatMap((q) => [q.p1.x, q.p2.x]);
      const ys = quads.flatMap((q) => [q.p1.y, q.p3.y]);
      return {
        ...base,
        subtype,
        color: colorOf(a, "color", "strokeColor") ?? { r: 255, g: 205, b: 69 },
        opacity: a.opacity ?? 1,
        blendMode: numberToBlend(a.blendMode ?? (subtype === "highlight" ? 1 : 0)),
        quadPoints: quads,
        rect: { left: Math.min(...xs), right: Math.max(...xs), top: Math.max(...ys), bottom: Math.min(...ys) },
      } as AnnotationDraft;
    }
    case "stamp": {
      const src = a.imageSrc ?? a.custom?.imageSrc ?? a.customData?.imageSrc;
      const bytes = typeof src === "string" ? dataUrlToBytes(src) : null;
      if (!rect || !bytes) return null;
      return { ...base, subtype: "stamp", rect, source: bytes } as AnnotationDraft;
    }
    case "ink": {
      const strokes = (a.inkList ?? []).map((s: any) => (s.points ?? s).map((p: any) => ({ x: p.x + page.left, y: page.top - p.y })));
      if (!rect || !strokes.length) return null;
      return {
        ...base,
        subtype: "ink",
        inkList: strokes,
        rect,
        color: colorOf(a, "strokeColor", "color") ?? { r: 0, g: 0, b: 0 },
        opacity: a.opacity ?? 1,
        strokeWidth: a.strokeWidth ?? 2,
      } as AnnotationDraft;
    }
    case "text": {
      if (!rect) return null;
      return { ...base, subtype: "text", rect, color: colorOf(a, "color", "strokeColor"), opacity: a.opacity ?? 1 } as AnnotationDraft;
    }
    default:
      return null;
  }
};
