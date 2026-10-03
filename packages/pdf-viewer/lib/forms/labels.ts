// Field labels: a label is a FreeText annotation linked to its form field and
// placed just before it. The marker below tags those annotations.
export const FORM_FIELD_LABEL_MARKER = "cmFormFieldLabel";

export const isFormFieldLabel = (annotation: any) => !!annotation?.custom?.[FORM_FIELD_LABEL_MARKER];

// ---------------------------------------------------------------------------
// Layout
//
// The label is right-aligned, ending LABEL_GAP points left of the field — or
// above the field when there is no room on its left. Coordinates here are the
// 2.x ones: points from the page's top-left corner, y pointing down.
// ---------------------------------------------------------------------------

// Space between the end of the label and the field, in points.
const LABEL_GAP = 10;

// Helvetica advance widths (1/1000 em) for ASCII 32–126, from the standard
// Adobe font metrics — the standard Helvetica font is what the label is drawn
// with, so this measures labels exactly.
const HELVETICA_WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, // space ! " # $ % & ' ( ) * + , - . /
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, // 0–9 : ; < = > ?
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, // @ A–O
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, // P–Z [ \ ] ^ _
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, // ` a–o
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, // p–z { | } ~
];

const measureHelvetica = (text: string, fontSize: number) => {
  let units = 0;
  for (const char of text) {
    const code = char.charCodeAt(0);
    // Characters outside ASCII: assume a wide glyph rather than clip it.
    units += code >= 32 && code <= 126 ? HELVETICA_WIDTHS[code - 32]! : 667;
  }
  return (units / 1000) * fontSize;
};

/** "Name" → "Name :" (a colon the user typed isn't doubled). */
export const formatLabelText = (text: string) => `${text.trim().replace(/[\s:]+$/, "")} :`;

export interface LabelLayout {
  fontSize: number;
  /** Top-left origin, y down. */
  rect: { x: number; y: number; width: number; height: number };
  textAlign: "left" | "right";
}

/** Where a label goes for a field box on a page `pageWidth` points wide. */
export const layoutLabel = (
  field: { x: number; y: number; width: number; height: number; fontSize?: number },
  text: string,
  pageWidth: number,
): LabelLayout => {
  const fontSize = field.fontSize && field.fontSize >= 6 && field.fontSize <= 20 ? field.fontSize : 11;
  const lineHeight = Math.ceil(fontSize * 1.6);
  // Measured text plus room for the margin PDFium keeps inside a FreeText
  // box; right-aligned, so any slack ends up on the label's left.
  const width = Math.ceil(measureHelvetica(text, fontSize) + fontSize * 0.6 + 6);
  // Single-line fields: centre on the field. Tall ones (list boxes,
  // multi-line text): align with their first line.
  const height = field.height <= lineHeight * 1.5 ? field.height : lineHeight;

  if (field.x - LABEL_GAP - width >= 0) {
    return { fontSize, rect: { x: field.x - LABEL_GAP - width, y: field.y, width, height }, textAlign: "right" };
  }
  const aboveY = field.y - lineHeight - 2;
  if (aboveY >= 0) {
    return {
      fontSize,
      rect: { x: field.x, y: aboveY, width: Math.min(Math.max(width, field.width), pageWidth - field.x), height: lineHeight },
      textAlign: "left",
    };
  }
  return { fontSize, rect: { x: 0, y: field.y, width: Math.max(field.x - LABEL_GAP, 10), height }, textAlign: "right" };
};
