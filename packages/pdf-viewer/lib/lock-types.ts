/**
 * Local shim for @embedpdf/plugin-annotation v2.14.1 lock-mode types.
 *
 * The local PDF-Viewer-Lib source is still on the v1.3.x plugin baseline
 * (no @embedpdf/plugin-annotation installed). Once the plugin-migration TODO
 * in PDFViewer.tsx is completed and the package is registered, replace usages
 * of these with the real exports:
 *
 *   import { LockModeType } from '@embedpdf/plugin-annotation';
 *   import type { LockMode } from '@embedpdf/plugin-annotation';
 *
 * Numeric values intentionally match the upstream enum so the shim is
 * wire-compatible with the engine.
 */

export enum LockModeType {
  None = 0,
  All = 1,
  Include = 2,
  Exclude = 3,
}

export type LockMode =
  | { type: LockModeType.None }
  | { type: LockModeType.All }
  | { type: LockModeType.Include; categories: string[] }
  | { type: LockModeType.Exclude; categories: string[] };

/**
 * PDF annotation flag names recognized by @embedpdf/plugin-annotation v2.14.1.
 * `lockedContents` is new in 2.14.1; older runtimes silently ignore it.
 */
export type PdfAnnotationFlagName =
  | 'invisible'
  | 'hidden'
  | 'print'
  | 'noZoom'
  | 'noRotate'
  | 'noView'
  | 'readOnly'
  | 'locked'
  | 'toggleNoView'
  | 'lockedContents';
