import { useEffect } from 'react';

export interface UseKeyboardShortcutsProps {
  hasSelectedAnnotation: boolean;
  onDeleteAnnotation: () => void;
}

export const useKeyboardShortcuts = ({ 
  hasSelectedAnnotation, 
  onDeleteAnnotation 
}: UseKeyboardShortcutsProps) => {
  
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.key === 'Delete' || event.key === 'Backspace') && hasSelectedAnnotation) {
        event.preventDefault();
        onDeleteAnnotation();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasSelectedAnnotation, onDeleteAnnotation]);
};