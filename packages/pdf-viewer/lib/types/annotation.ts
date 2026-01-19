/**
 * Annotation API type definitions
 */

import type { AnnotationObject } from './embedpdf';

export interface AnnotationAPI {
  activateHighlighter: () => void;
  deactivateHighlighter: () => void;
  isHighlighterActive: () => boolean;
  activateStamp: (imageDataUrl?: string) => Promise<void>;
  deactivateStamp: () => void;
  isStampActive: () => boolean;
  addStampAnnotation: (
    imageDataUrl: string,
    pageIndex: number,
    x: number,
    y: number,
    width: number,
    height: number,
    userInfo?: { author?: string; customData?: unknown }
  ) => boolean;
  activateSignature: () => void;
  deactivateSignature: () => void;
  isSignatureActive: () => boolean;
  addSignatureAnnotation: () => boolean;
  deleteSelectedAnnotation: () => boolean;
  getSelectedAnnotation: () => AnnotationObject | null;
  getSelectedAnnotationDetails: () => AnnotationObject | null;
  getAllAnnotations: () => AnnotationObject[];
  onAnnotationEvent: (callback: (event: unknown) => void) => (() => void) | null;
}

export interface AnnotationSelectionMenuProps {
  menuWrapperProps?: {
    style?: React.CSSProperties;
    ref?: React.Ref<HTMLDivElement>;
    className?: string;
    [key: string]: unknown;
  };
  selected: boolean;
  rect?: {
    origin?: { x: number; y: number };
    size?: { width: number; height: number };
    width?: number;
    height?: number;
  };
  annotation?: AnnotationObject;
  onDelete?: () => void;
  getSelectedAnnotation?: () => AnnotationObject | null;
}
