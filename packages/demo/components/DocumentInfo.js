"use client";

import {
  Box,
} from "@mui/material";

export default function DocumentInfo({ documentInfo }) {
  console.log('document info', documentInfo);
  
  if (!documentInfo) return null;

  return (
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
  );
}