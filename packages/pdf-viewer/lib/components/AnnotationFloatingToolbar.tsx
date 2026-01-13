import React, { useEffect, useState } from 'react';
import type { AnnotationPlugin, AnnotationObject } from '../types/embedpdf';

interface Props {
    annotationPlugin: AnnotationPlugin;
    documentId: string;
    pageIndex: number;
    scale: number;
    pageSize?: { width: number; height: number };
}

export const AnnotationFloatingToolbar: React.FC<Props> = ({ annotationPlugin, documentId, pageIndex, scale, pageSize }) => {
    const [selection, setSelection] = useState<AnnotationObject | null>(null);

    // ... (existing useEffect and handleDelete)

    useEffect(() => {
        // Handle both cases: wrapper object or direct interface
        const provides = annotationPlugin?.provides || (annotationPlugin as any);

        if (!provides) {
            return;
        }

        // --- STRATEGY 1: Event Listener (Fast response) ---
        let unsubscribe: (() => void) | undefined;
        if (provides.onAnnotationEvent) {
            unsubscribe = provides.onAnnotationEvent((event: any) => {
                // Handle select or create event (create implies selection in UI flow)
                if (event.type === 'select' || event.type === 'create') {
                    if (event.annotation) {
                        if (event.annotation.pageIndex === pageIndex) {
                            setSelection(event.annotation);
                        } else {
                            setSelection(null);
                        }
                    }
                }
                // Handle deselect/delete
                else if (event.type === 'deselect' || event.type === 'delete') {
                    setSelection((prev) => {
                        if (prev && event.annotation && prev.id === event.annotation.id) {
                            return null;
                        }
                        return prev;
                    });
                }
                // Handle update event
                else if (event.type === 'update') {
                    setSelection((prev) => {
                        if (prev && event.annotation && prev.id === event.annotation.id) {
                            if (event.annotation.pageIndex === pageIndex) {
                                return event.annotation;
                            }
                            return null;
                        }
                        return prev;
                    });
                }
            });
        }

        // --- STRATEGY 2: Polling (Reliabilty fallback for missing events) ---
        // Poll every 200ms to allow detecting selection changes that didn't fire an event
        const pollInterval = setInterval(() => {
            try {
                if (provides.getSelectedAnnotation) {
                    const current = provides.getSelectedAnnotation();
                    const currentObj = current?.object;

                    setSelection((prev) => {
                        // Start logic
                        if (currentObj) {
                            // If selected object is on this page
                            if (currentObj.pageIndex === pageIndex) {
                                // If ID matches, keep existing object (avoid re-rendering if just reference changed but ID same)
                                if (prev && prev.id === currentObj.id) {
                                    return prev;
                                }
                                // New ID selected!
                                return currentObj;
                            } else {
                                // Selected object is on another page. We should clear ours.
                                return null;
                            }
                        } else {
                            // No valid selection anywhere. Clear ours.
                            return null;
                        }
                    });
                }
            } catch (e) {
                // console.warn(e);
            }
        }, 200);

        return () => {
            clearInterval(pollInterval);
            if (unsubscribe) unsubscribe();
        };
    }, [annotationPlugin, pageIndex]);

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent deselection
        const provides = annotationPlugin?.provides || (annotationPlugin as any);
        if (selection && provides) {
            // Use document-scoped API if available, otherwise fallback to global
            if (provides.forDocument) {
                const scopedApi = provides.forDocument(documentId);
                scopedApi.deleteAnnotation(pageIndex, selection.id);
            } else if (provides.deleteAnnotation) {
                provides.deleteAnnotation(pageIndex, selection.id);
            }
            setSelection(null);
        }
    };

    if (!selection || !selection.rect || !selection.rect.origin) return null;

    // Calculate position (Top-Left coordinate system assumed)
    const { x, y } = selection.rect.origin;
    const { width, height } = selection.rect.size || { width: 0, height: 0 };

    // Handle undefined scale (default to 1)
    const safeScale = scale || 1;

    // Determine position
    // Default: Below the annotation
    // If we have pageSize and it's too close to bottom, move above.

    // safeScale applies to x, y, width, height.
    // Toolbar itself is fixed size in pixels (not scaled).
    // So we convert PDF units to Pixels for comparison, or Pixels to PDF units.

    const TOOLBAR_RENDERING_HEIGHT = 32; // Actual approx height of compact toolbar
    const TOOLBAR_BUFFER_HEIGHT = 40; // Height to check for collision (includes margin)
    const PADDING_PIXELS = 4;
    const SAFETY_MARGIN = 10;

    const annotationBottomPixel = (y + height) * safeScale;
    const spaceBelowPixels = (pageSize ? pageSize.height * safeScale : 999999) - annotationBottomPixel;

    // Default Top Position (Below annotation)
    let top = annotationBottomPixel + PADDING_PIXELS;

    // Check collision
    if (pageSize) {
        if (spaceBelowPixels < (TOOLBAR_BUFFER_HEIGHT + SAFETY_MARGIN)) {
            // Flip to Top
            // Position above annotation
            // y * safeScale is the top pixel of annotation
            top = (y * safeScale) - (TOOLBAR_RENDERING_HEIGHT + PADDING_PIXELS);
        }
    }

    const left = (x + width / 2) * safeScale;

    return (
        <div
            style={{
                position: 'absolute',
                left: left,
                top: top,
                transform: 'translateX(-50%)',
                zIndex: 1000,
                backgroundColor: 'white',
                borderRadius: '6px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(0,0,0,0.1)',
            }}
            onMouseDown={(e: React.MouseEvent) => {
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
            }}
            onPointerDown={(e: React.PointerEvent) => {
                e.preventDefault();
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
            }}
            onMouseUp={(e: React.MouseEvent) => {
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
            }}
            onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
            }}
        >
            <button
                onClick={handleDelete}
                title="Delete"
                style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#e53935',
                    borderRadius: '4px',
                    transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#ffebee')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                </svg>
            </button>
        </div>
    );
};
