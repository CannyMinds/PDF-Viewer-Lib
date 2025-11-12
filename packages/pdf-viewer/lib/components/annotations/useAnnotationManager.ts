import { useMemo } from 'react';
import { useAnnotationSelection } from './useAnnotationSelection';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { AnnotationSelectionMenu } from './AnnotationSelectionMenu';

export interface UseAnnotationManagerProps {
  pdfBuffer: Uint8Array | null;
  annotationAPI: any;
  userDetails?: {
    name?: string;
    email?: string;
    id?: string;
  };
}

export const useAnnotationManager = ({ 
  pdfBuffer, 
  annotationAPI, 
  userDetails 
}: UseAnnotationManagerProps) => {
  
  const { 
    hasSelectedAnnotation, 
    annotationDetails, 
    deleteSelectedAnnotation,
    getSelectedAnnotation
  } = useAnnotationSelection({ 
    pdfBuffer, 
    annotationAPI 
  });

  useKeyboardShortcuts({ 
    hasSelectedAnnotation, 
    onDeleteAnnotation: deleteSelectedAnnotation 
  });

  const annotationSelectionMenu = useMemo(() => {
    return (props: any) => {
      return AnnotationSelectionMenu({
        ...props,
        onDelete: deleteSelectedAnnotation,
        getSelectedAnnotation
      });
    };
  }, [deleteSelectedAnnotation, getSelectedAnnotation]);

  return {
    hasSelectedAnnotation,
    annotationDetails,
    deleteSelectedAnnotation,
    getSelectedAnnotation,
    annotationSelectionMenu
  };
};