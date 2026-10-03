import { AnnotationMenu, useAnnotation } from "@embedpdf/react";
import type { AnnotationHub } from "../annotations/hub";

// The small toolbar that floats over a selected annotation, with a delete button.
export const AnnotationDeleteMenu = ({ hub }: { hub: AnnotationHub }) => {
  const annotation = useAnnotation();
  return (
    <AnnotationMenu placement="bottom" gap={6}>
      <div
        style={{
          backgroundColor: "white",
          borderRadius: 6,
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          padding: 4,
          display: "flex",
          alignItems: "center",
          border: "1px solid rgba(0,0,0,0.1)",
        }}
      >
        <button
          type="button"
          title="Delete"
          onClick={() => {
            const selected = annotation.getSelected()[0];
            if (selected) void hub.remove(selected.ref).catch((error) => console.error("Failed to delete annotation", error));
          }}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 2,
            display: "flex",
            color: "#e53935",
            borderRadius: 4,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
          </svg>
        </button>
      </div>
    </AnnotationMenu>
  );
};
