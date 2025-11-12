import { useEffect, useState, useRef, useCallback } from 'react';

export interface UseAnnotationSelectionProps {
  pdfBuffer: Uint8Array | null;
  annotationAPI: any;
}

export const useAnnotationSelection = ({ 
  pdfBuffer, 
  annotationAPI 
}: UseAnnotationSelectionProps) => {
  const [hasSelectedAnnotation, setHasSelectedAnnotation] = useState(false);
  const [annotationDetails, setAnnotationDetails] = useState<any>(null);
  const lastSelectedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pdfBuffer) return;

    const checkInterval = setInterval(() => {
      if (annotationAPI) {
        const selected = annotationAPI.getSelectedAnnotation();
        setHasSelectedAnnotation(!!selected);

        if (selected) {
          const detail = selected.object || selected;
          if (detail.id !== lastSelectedIdRef.current) {
            lastSelectedIdRef.current = detail.id;
          }
          setAnnotationDetails(detail);
        } else {
          if (lastSelectedIdRef.current !== null) {
            lastSelectedIdRef.current = null;
          }
          setAnnotationDetails(null);
        }
      }
    }, 200);

    return () => clearInterval(checkInterval);
  }, [pdfBuffer, annotationAPI]);

  const deleteSelectedAnnotation = useCallback(() => {
    if (!annotationAPI) {
      console.warn('Annotation API not available yet — delete ignored');
      return false;
    }

    try {
      const deleted = annotationAPI.deleteSelectedAnnotation();
      if (deleted) {
        setHasSelectedAnnotation(false);
        setAnnotationDetails(null);
      }
      return deleted;
    } catch (err) {
      console.error('Error deleting annotation:', err);
      return false;
    }
  }, [annotationAPI]);

  return {
    hasSelectedAnnotation,
    annotationDetails,
    deleteSelectedAnnotation,
    getSelectedAnnotation: () => annotationAPI?.getSelectedAnnotation() || null
  };
};