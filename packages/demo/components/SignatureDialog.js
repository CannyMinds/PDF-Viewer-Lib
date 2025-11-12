"use client";

import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Checkbox,
  FormControlLabel,
  Typography,
  IconButton,
} from "@mui/material";
import { Clear } from "@mui/icons-material";

export default function SignatureDialog({ open, onClose, onSave, username = "User" }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [includeUsername, setIncludeUsername] = useState(false);
  const [includeDateTime, setIncludeDateTime] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 16; // Increased to 6 for maximum visibility
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [open]);

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");

    setIsDrawing(true);
    ctx.beginPath();
    ctx.moveTo(
      e.clientX - rect.left,
      e.clientY - rect.top
    );
  };

  const draw = (e) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");

    ctx.lineTo(
      e.clientX - rect.left,
      e.clientY - rect.top
    );
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // Create a temporary canvas with extra height for text if needed
    let extraHeight = 0;
    const baseFontSize = Math.max(24, Math.floor(canvas.height * 0.16));
    const smallFontSize = Math.max(20, Math.floor(canvas.height * 0.14));
    const lineHeight = baseFontSize + 8;
    
    if (includeUsername || includeDateTime) {
      // Calculate extra height needed for text
      const textLines = (includeUsername ? 1 : 0) + (includeDateTime ? 1 : 0);
      extraHeight = (textLines * lineHeight) + 25; // 25px for padding and separator
    }

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height + extraHeight;
    const tempCtx = tempCanvas.getContext("2d");

    // NO background - keep transparent for PDF overlay
    // This allows signature to blend naturally with PDF content

    // Draw the signature at the top
    tempCtx.drawImage(canvas, 0, 0);

    // Add username and/or date/time if selected - BELOW the signature
    if (includeUsername || includeDateTime) {
      tempCtx.fillStyle = "#000000";
      tempCtx.textBaseline = "top";
      
      // Start text below signature with some padding
      const topPadding = canvas.height + 15;
      let textY = topPadding;

      // Add a subtle separator line above text
      tempCtx.strokeStyle = "#666666";
      tempCtx.lineWidth = 1;
      tempCtx.beginPath();
      tempCtx.moveTo(10, canvas.height + 8);
      tempCtx.lineTo(canvas.width - 10, canvas.height + 8);
      tempCtx.stroke();

      // Draw username first (top)
      if (includeUsername) {
        tempCtx.font = `bold ${baseFontSize}px Arial, sans-serif`;
        tempCtx.fillText(username, 10, textY);
        textY += lineHeight;
      }

      // Draw date/time below username
      if (includeDateTime) {
        const now = new Date();
        const dateTime = now.toLocaleString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true
        });
        
        tempCtx.font = `bold ${smallFontSize}px Arial, sans-serif`;
        tempCtx.fillText(dateTime, 10, textY);
      }
    }

    // Convert to data URL with transparent background
    const signatureDataUrl = tempCanvas.toDataURL("image/png");

    onSave(signatureDataUrl);
    handleClose();
  };

  const handleClose = () => {
    clearCanvas();
    setIncludeUsername(false);
    setIncludeDateTime(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Draw Your Signature
        <IconButton
          onClick={clearCanvas}
          sx={{ position: "absolute", right: 60, top: 8 }}
          title="Clear"
        >
          <Clear />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box
          sx={{
            border: "2px solid #ccc",
            borderRadius: 1,
            mb: 2,
            backgroundColor: "#fff",
          }}
        >
          <canvas
            ref={canvasRef}
            width={700}
            height={200}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            style={{
              display: "block",
              cursor: "crosshair",
            }}
          />
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: "block" }}>
          Draw your signature above using your mouse or touch
        </Typography>
        <Box>
          <FormControlLabel
            control={
              <Checkbox
                checked={includeUsername}
                onChange={(e) => setIncludeUsername(e.target.checked)}
              />
            }
            label="Include Username"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={includeDateTime}
                onChange={(e) => setIncludeDateTime(e.target.checked)}
              />
            }
            label="Include Date & Time"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">
          Add Signature
        </Button>
      </DialogActions>
    </Dialog>
  );
}
