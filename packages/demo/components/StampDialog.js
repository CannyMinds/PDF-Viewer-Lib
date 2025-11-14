"use client";

import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";

const STAMP_TEMPLATES = [
  { id: "approved", label: "APPROVED", color: "#4caf50" },
  { id: "rejected", label: "REJECTED", color: "#f44336" },
  { id: "pending", label: "PENDING", color: "#ff9800" },
  { id: "reviewed", label: "REVIEWED", color: "#2196f3" },
  { id: "confidential", label: "CONFIDENTIAL", color: "#9c27b0" },
  { id: "draft", label: "DRAFT", color: "#607d8b" },
];

export default function StampDialog({ open, onClose, onSave, username = "User" }) {
  const [selectedTemplate, setSelectedTemplate] = useState("approved");
  const [customText, setCustomText] = useState("");
  const [useCustom, setUseCustom] = useState(false);

  const generateStampSVG = () => {
    const template = STAMP_TEMPLATES.find((t) => t.id === selectedTemplate);
    const text = useCustom ? customText.toUpperCase() : template?.label || "STAMP";
    const color = template?.color || "#4caf50";

    const svg = `
      <svg width="200" height="100" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="1" stdDeviation="1" flood-opacity="0.3"/>
          </filter>
        </defs>
        <rect x="5" y="5" width="190" height="90"
          fill="none"
          stroke="${color}"
          stroke-width="3"
          rx="5"
          filter="url(#shadow)"/>
        <rect x="10" y="10" width="180" height="80"
          fill="none"
          stroke="${color}"
          stroke-width="2"
          rx="3"/>
        <text x="100" y="55"
          font-family="Arial, sans-serif"
          font-size="28"
          font-weight="bold"
          fill="${color}"
          text-anchor="middle"
          dominant-baseline="middle">
          ${text}
        </text>
      </svg>
    `;

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  };

  const handleSave = () => {
    const stampDataUrl = generateStampSVG();
    onSave(stampDataUrl, true);
    handleClose();
  };

  const handleClose = () => {
    setUseCustom(false);
    setCustomText("");
    setSelectedTemplate("approved");
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Stamp</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 1 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Select Stamp Template
          </Typography>
          <ToggleButtonGroup
            value={selectedTemplate}
            exclusive
            onChange={(e, val) => {
              if (val !== null) {
                setSelectedTemplate(val);
                setUseCustom(false);
              }
            }}
            sx={{ mb: 2, flexWrap: "wrap" }}
          >
            {STAMP_TEMPLATES.map((template) => (
              <ToggleButton
                key={template.id}
                value={template.id}
                sx={{
                  color: template.color,
                  borderColor: template.color,
                  "&.Mui-selected": {
                    backgroundColor: `${template.color}22`,
                    borderColor: template.color,
                    "&:hover": {
                      backgroundColor: `${template.color}33`,
                    },
                  },
                }}
              >
                {template.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          <Typography variant="subtitle2" sx={{ mb: 1, mt: 2 }}>
            Or Use Custom Text
          </Typography>
          <TextField
            fullWidth
            placeholder="Enter custom stamp text"
            value={customText}
            onChange={(e) => {
              setCustomText(e.target.value);
              setUseCustom(e.target.value.trim() !== "");
            }}
            size="small"
            inputProps={{ maxLength: 20 }}
            helperText={`${customText.length}/20 characters`}
          />

          <Box
            sx={{
              mt: 3,
              p: 2,
              border: "1px solid #ddd",
              borderRadius: 1,
              backgroundColor: "#f5f5f5",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              minHeight: 120,
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
              Preview:
            </Typography>
            <img
              src={generateStampSVG()}
              alt="Stamp Preview"
              style={{ maxWidth: "100%", height: "auto" }}
            />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">
          Add Stamp
        </Button>
      </DialogActions>
    </Dialog>
  );
}
