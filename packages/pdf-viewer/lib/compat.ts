// Enums kept from the 2.x API so consuming apps don't have to change imports.
// The numeric / string values are mapped onto EmbedPDF 3 stage settings in
// PDFViewer.tsx.

export { ZoomMode } from "@embedpdf/plugin-stage";

export const ScrollStrategy = {
  Vertical: "vertical",
  Horizontal: "horizontal",
} as const;
export type ScrollStrategy = (typeof ScrollStrategy)[keyof typeof ScrollStrategy];

/** Quarter-turn steps clockwise, as in EmbedPDF 2.x. */
export enum Rotation {
  Degree0 = 0,
  Degree90 = 1,
  Degree180 = 2,
  Degree270 = 3,
}

export type PageRotationDegrees = 0 | 90 | 180 | 270;
export const rotationToDegrees = (rotation: Rotation): PageRotationDegrees =>
  ((((rotation % 4) + 4) % 4) * 90) as PageRotationDegrees;
export const degreesToRotation = (degrees: number): Rotation =>
  ((((Math.round(degrees / 90) % 4) + 4) % 4) as Rotation);
