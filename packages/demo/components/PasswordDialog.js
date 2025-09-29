"use client";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
} from "@mui/material";

export default function PasswordDialog({
  open,
  passwordInput,
  onPasswordChange,
  onSubmit,
  onCancel
}) {
  return (
    <Dialog open={open} onClose={onCancel}>
      <DialogTitle>Password Required</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2 }}>
          This PDF is password protected. Please enter the password to view it.
        </Typography>
        <TextField
          autoFocus
          margin="dense"
          label="PDF Password"
          type="password"
          fullWidth
          variant="outlined"
          value={passwordInput}
          onChange={onPasswordChange}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onSubmit();
            }
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button onClick={onSubmit} variant="contained">
          Open PDF
        </Button>
      </DialogActions>
    </Dialog>
  );
}