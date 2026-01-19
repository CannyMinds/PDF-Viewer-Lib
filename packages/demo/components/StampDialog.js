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
  Tabs,
  Tab,
} from "@mui/material";
import { CloudUpload } from "@mui/icons-material";

const STAMP_TEMPLATES = [
  { id: "approved", label: "APPROVED", color: "#4caf50" },
  { id: "rejected", label: "REJECTED", color: "#f44336" },
  { id: "pending", label: "PENDING", color: "#ff9800" },
  { id: "reviewed", label: "REVIEWED", color: "#2196f3" },
  { id: "confidential", label: "CONFIDENTIAL", color: "#9c27b0" },
  { id: "draft", label: "DRAFT", color: "#607d8b" },
];

export default function StampDialog({ open, onClose, onSave, username = "User" }) {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState("approved");
  const [customText, setCustomText] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);

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

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedImage(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (activeTab === 0) {
      const stampDataUrl = generateStampSVG();
      onSave(stampDataUrl, true);
    } else {
      if (uploadedImage) {
        onSave(uploadedImage, false);
      }
    }
    handleClose();
  };

  const handleClose = () => {
    setUseCustom(false);
    setCustomText("");
    setSelectedTemplate("approved");
    setUploadedImage(null);
    setActiveTab(0);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Stamp</DialogTitle>
      <DialogContent>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Templates" />
          <Tab label="Upload Image" />
        </Tabs>

        {activeTab === 0 ? (
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
        ) : (
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Button
              component="label"
              variant="outlined"
              startIcon={<CloudUpload />}
              sx={{ mb: 2 }}
            >
              Upload Image
              <input
                type="file"
                hidden
                accept="image/*"
                onChange={handleImageUpload}
              />
            </Button>
            <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 2 }}>
              Supported formats: PNG, JPG, SVG
            </Typography>
            
            {uploadedImage ? (
              <Box
                sx={{
                  mt: 2,
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
                <img
                  src={uploadedImage}
                  alt="Uploaded Stamp"
                  style={{ maxWidth: "100%", maxHeight: "200px", objectFit: "contain" }}
                />
              </Box>
            ) : (
              <Box
                sx={{
                  mt: 2,
                  p: 4,
                  border: "1px dashed #ccc",
                  borderRadius: 1,
                  backgroundColor: "#fafafa",
                  color: "text.secondary"
                }}
              >
                <Typography variant="body2">
                  No image selected
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button 
          onClick={handleSave} 
          variant="contained"
          disabled={activeTab === 1 && !uploadedImage}
        >
          Add Stamp
        </Button>
      </DialogActions>
    </Dialog>
  );
}
