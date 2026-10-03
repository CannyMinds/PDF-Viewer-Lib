import type { Kernel } from "@embedpdf/react";
import { SelectionToken } from "@embedpdf/plugin-selection";
import type { PDFViewerRef } from "../types/public";

export const createSelectionApi = (kernel: Kernel, documentId: string): PDFViewerRef["selection"] => {
  const selection = () => kernel.capability(SelectionToken, documentId);

  return {
    clearSelection: () => selection().clear(),
    getSelectedText: async () => (selection().hasSelection() ? selection().readText() : ""),
    copy: () => {
      void selection()
        .readText()
        .then((text) => (text ? navigator.clipboard.writeText(text) : undefined))
        .catch((error) => console.error("Failed to copy text:", error));
    },
  };
};
