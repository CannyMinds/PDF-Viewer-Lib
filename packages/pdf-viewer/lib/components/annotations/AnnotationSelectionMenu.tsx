import React from 'react';
import type { AnnotationObject } from '../../types/embedpdf';

export interface AnnotationSelectionMenuProps {
  menuWrapperProps?: {
    style?: React.CSSProperties;
    ref?: React.RefObject<HTMLDivElement>;
    className?: string;
    [key: string]: unknown;
  };
  selected: boolean;
  rect?: {
    size?: { width: number; height: number };
    height?: number;
    width?: number;
    origin?: { x: number; y: number };
  };
  onDelete: () => void;
  getSelectedAnnotation: () => AnnotationObject | null;
}

export const AnnotationSelectionMenu: React.FC<AnnotationSelectionMenuProps> = ({
  menuWrapperProps = {},
  selected,
  rect,
  onDelete,
  getSelectedAnnotation
}) => {
  if (!selected) {
    return null;
  }

  const { style: wrapperStyle = {}, ref: menuRef, className, ...restProps } = menuWrapperProps;
  
  const originalTop = wrapperStyle?.top;
  const originalLeft = wrapperStyle?.left;
  
  const selectedAnnotation = getSelectedAnnotation();
  const annotationRect = selectedAnnotation?.object?.rect || rect;
  const annotationHeight = annotationRect?.size?.height || annotationRect?.height || 30;
  const annotationWidth = annotationRect?.size?.width || annotationRect?.width || 100;
  
  const menuTop = typeof originalTop === 'number' ? originalTop + annotationHeight + 5 : originalTop;
  const menuLeft = typeof originalLeft === 'number' ? originalLeft + (annotationWidth / 2) : originalLeft;

  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onDelete();
  };

  return (
    <div
      ref={menuRef}
      className={className}
      {...restProps}
      style={{
        ...wrapperStyle,
        top: menuTop,
        left: menuLeft,
        transform: 'translate(-50%, 0)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
        borderRadius: '6px',
        boxShadow: '0 1px 4px rgba(0, 0, 0, 0.15)',
        padding: '0px',
        pointerEvents: 'auto',
        zIndex: 99,
        border: '1px solid rgba(0, 0, 0, 0.06)',
        width: '28px',
        height: '28px',
      }}
    >
      <button
        onClick={handleClick}
        title="Delete annotation (Del)"
        style={{
          color: '#d32f2f',
          padding: '0px',
          width: '28px',
          height: '28px',
          minWidth: '28px',
          minHeight: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s ease',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          borderRadius: '6px',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(211, 47, 47, 0.1)';
          e.currentTarget.style.color = '#c62828';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.color = '#d32f2f';
        }}
        onMouseDown={(e) => {
          e.currentTarget.style.transform = 'scale(0.9)';
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
        </svg>
      </button>
    </div>
  );
};