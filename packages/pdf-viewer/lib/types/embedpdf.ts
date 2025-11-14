/**
 * Type definitions for @embedpdf plugin interfaces
 * These types provide better type safety for plugin APIs
 */

export interface EngineInstance {
  initialize: () => Promise<void>;
  destroy: () => void;
  [key: string]: unknown;
}

export interface ZoomProvides {
  zoomIn: () => void;
  zoomOut: () => void;
  requestZoom: (level: number | string) => void;
}

export interface ZoomState {
  zoomLevel: number | string;
}

export interface ZoomPlugin {
  provides: ZoomProvides | null;
  state: ZoomState | null;
}

export interface ScrollProvides {
  scrollToPage: (options: { pageNumber: number; pageCoordinates?: { x: number; y: number }; center?: boolean }) => void;
}

export interface ScrollState {
  currentPage: number;
  totalPages: number;
}

export interface ScrollPlugin {
  provides: ScrollProvides | null;
  state: ScrollState | null;
}

export interface SearchResult {
  pageIndex: number;
  matchIndex: number;
  [key: string]: unknown;
}

export interface SearchProvides {
  searchAllPages: (keyword: string) => { toPromise: () => Promise<unknown> };
  nextResult: () => number;
  previousResult: () => number;
  goToResult: (index: number) => number;
  stopSearch: () => void;
  startSearch: () => void;
  getState: () => unknown;
  setShowAllResults: (show: boolean) => void;
}

export interface SearchPlugin {
  provides: SearchProvides | null;
  state: unknown;
}

export interface RotateProvides {
  rotateForward: () => void;
  rotateBackward: () => void;
  setRotation: (rotation: number) => void;
  getRotation: () => number;
}

export interface RotatePlugin {
  provides: RotateProvides | null;
}

export interface AnnotationTool {
  id: string;
  name?: string;
  interaction?: {
    exclusive?: boolean;
    cursor?: string;
  };
  matchScore?: () => number;
  defaults?: Record<string, unknown>;
}

export interface AnnotationObject {
  id: string;
  type: number;
  pageIndex: number;
  rect?: {
    origin?: { x: number; y: number };
    size?: { width: number; height: number };
  };
  author?: string;
  subject?: string;
  created?: string;
  customData?: unknown;
  [key: string]: unknown;
}

export interface AnnotationSelection {
  object: AnnotationObject;
}

export interface AnnotationEvent {
  type: 'create' | 'update' | 'delete' | 'select' | 'deselect';
  annotation: AnnotationObject;
}

export interface AnnotationProvides {
  setActiveTool: (toolId: string | null) => void;
  getActiveTool: () => AnnotationTool | null;
  getTool: (toolId: string) => AnnotationTool | null;
  addTool: (tool: AnnotationTool) => void;
  setToolDefaults: (toolId: string, defaults: Record<string, unknown>) => void;
  getSelectedAnnotation: () => AnnotationSelection | null;
  deleteAnnotation: (pageIndex: number, annotationId: string) => void;
  createAnnotation?: (pageIndex: number, annotationData: Record<string, unknown>) => void;
  commit?: () => void;
  getAllAnnotations?: () => AnnotationObject[];
  getAnnotations?: () => AnnotationObject[];
  onAnnotationEvent?: (callback: (event: AnnotationEvent) => void) => (() => void) | null;
}

export interface AnnotationPlugin {
  provides: AnnotationProvides | null;
}

export interface RenderPageOptions {
  pageIndex: number;
  scale: number;
  width: number;
  height: number;
  document?: { id: string };
  rotation?: number;
}
