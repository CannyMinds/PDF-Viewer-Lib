"use client";

import {
  Box,
  Button,
} from "@mui/material";
import {
  Download,
} from "@mui/icons-material";
import NavigationControls from "./NavigationControls";
import ZoomControls from "./ZoomControls";
import { useEffect } from "react";

export default function PDFControlsBar({
  documentInfo,
  pdfViewerRef,
  onDownload
}) {

  useEffect(() => {
    console.log('documentInfo', documentInfo);
    
  }, [])

  return (
    <Box
      sx={{
        display: "flex",
        gap: 1,
        mb: 1,
        justifyContent: "center",
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      {/* Current Page Info */}
      {documentInfo && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            px: 2,
            py: 1,
            backgroundColor: "primary.main",
            color: "white",
            borderRadius: 1,
            fontWeight: "bold",
          }}
        >
          Page {documentInfo.currentPage} of {documentInfo.totalPages}
        </Box>
      )}
      <NavigationControls pdfViewerRef={pdfViewerRef} />
      <ZoomControls pdfViewerRef={pdfViewerRef} />

      {/* Page Jump */}
      {documentInfo && (
        <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              const page = prompt(
                "Go to page:",
                documentInfo?.currentPage || 1
              );
              if (page && !isNaN(page)) {
                pdfViewerRef.current?.navigation.goToPage(parseInt(page));
              }
            }}
          >
            Go to Page
          </Button>
        </Box>
      )}

      {/* Download Buttons */}
      <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
        <Button
          variant="contained"
          color="success"
          size="small"
          startIcon={<Download />}
          onClick={onDownload}
        >
          Download with Annotations
        </Button>
        <Button
          variant="outlined"
          color="primary"
          size="small"
          onClick={async () => {
            if (!pdfViewerRef.current?.document?.download) return;
            try {
              await pdfViewerRef.current.document.download(
                undefined,
                false
              );
            } catch (error) {
              // Download failed silently
            }
          }}
        >
          Download Original
        </Button>
      </Box>
    </Box>
  );
}