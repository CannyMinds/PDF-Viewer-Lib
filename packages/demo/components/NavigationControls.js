"use client";

import {
  Box,
  IconButton,
} from "@mui/material";
import {
  NavigateBefore,
  NavigateNext,
  FirstPage,
  LastPage,
} from "@mui/icons-material";

export default function NavigationControls({ pdfViewerRef }) {
  return (
    <Box sx={{ display: "flex", gap: 0.5 }}>
      <IconButton
        size="small"
        onClick={() =>
          pdfViewerRef.current?.navigation.goToFirstPage()
        }
        title="First Page"
        sx={{ border: 1, borderColor: "divider" }}
      >
        <FirstPage />
      </IconButton>
      <IconButton
        size="small"
        onClick={() =>
          pdfViewerRef.current?.navigation.previousPage()
        }
        title="Previous Page"
        sx={{ border: 1, borderColor: "divider" }}
      >
        <NavigateBefore />
      </IconButton>
      <IconButton
        size="small"
        onClick={() => pdfViewerRef.current?.navigation.nextPage()}
        title="Next Page"
        sx={{ border: 1, borderColor: "divider" }}
      >
        <NavigateNext />
      </IconButton>
      <IconButton
        size="small"
        onClick={() =>
          pdfViewerRef.current?.navigation.goToLastPage()
        }
        title="Last Page"
        sx={{ border: 1, borderColor: "divider" }}
      >
        <LastPage />
      </IconButton>
    </Box>
  );
}