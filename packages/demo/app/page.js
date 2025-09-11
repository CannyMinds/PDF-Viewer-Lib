'use client';

import { PDFViewer, usePDFViewer } from '../../pdf-viewer/lib';
import { Container, Typography, Box, AppBar, Toolbar, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material';
import { PictureAsPdf, CloudUpload, Clear } from '@mui/icons-material';
import { useState, useEffect } from 'react';

export default function Page() {
	const [selectedFile, setSelectedFile] = useState(null);
	const [pdfBuffer, setPdfBuffer] = useState(null);
	const [showPasswordDialog, setShowPasswordDialog] = useState(false);
	const [passwordInput, setPasswordInput] = useState('');
	const [passwordResolver, setPasswordResolver] = useState(null);

	const handleFileChange = async (event) => {
		const file = event.target.files[0];
		if (file && file.type === 'application/pdf') {
			setSelectedFile(file);
			const buffer = await file.arrayBuffer();
			setPdfBuffer(buffer);
		}
	};

	const handleClear = () => {
		setSelectedFile(null);
		setPdfBuffer(null);
		setPasswordInput('');
	};

	const handlePasswordRequest = () => {
		return new Promise((resolve) => {
			setPasswordResolver(() => resolve);
			setShowPasswordDialog(true);
		});
	};

	const handlePasswordSubmit = () => {
		if (passwordResolver) {
			passwordResolver(passwordInput);
		}
		setShowPasswordDialog(false);
		setPasswordResolver(null);
		setPasswordInput('');
	};

	const handlePasswordCancel = () => {
		if (passwordResolver) {
			passwordResolver(null);
		}
		setShowPasswordDialog(false);
		setPasswordResolver(null);
		setPasswordInput('');
	};

	// const { error, isReady, isLoading, instance } = usePDFViewer({});

    // useEffect(() => {
    //     console.log('[PDF Error]: ', error);
    // }, [error]);

	return (
		<>
			<AppBar position="static" sx={{ minHeight: '48px' }}>
				<Toolbar variant="dense" sx={{ minHeight: '48px !important', py: 0.5 }}>
					<PictureAsPdf sx={{ mr: 1, fontSize: '1.2rem' }} />
					<Typography variant="subtitle1" sx={{ flexGrow: 1, fontSize: '1rem' }}>
						CM PDF Viewer
					</Typography>
					<input
						id="pdf-file-input"
						type="file"
						accept=".pdf,application/pdf"
						onChange={handleFileChange}
						style={{ 
							display: 'block',
							width: '180px',
							fontSize: '12px',
							padding: '4px 6px',
							border: '1px solid rgba(255,255,255,0.3)',
							borderRadius: '4px',
							backgroundColor: 'rgba(255,255,255,0.1)',
							color: 'white',
							marginRight: '8px'
						}}
					/>
					{selectedFile && (
						<IconButton 
							size="small" 
							onClick={handleClear}
							sx={{ 
								color: 'inherit',
								backgroundColor: 'rgba(244, 67, 54, 0.8)',
								'&:hover': {
									backgroundColor: 'rgba(244, 67, 54, 1)'
								}
							}}
							title="Clear PDF"
						>
							<Clear fontSize="small" />
						</IconButton>
					)}
				</Toolbar>
			</AppBar>
			<Container maxWidth="lg" sx={{ mt: 2, mb: 2 }}>
				<Box
					sx={{
						display: 'flex',
						flexDirection: 'column',
						minHeight: '85vh',
					}}
				>
					<Box
						sx={{
							width: '100%',
							height: '80vh',
							border: 1,
							borderColor: 'divider',
							borderRadius: 1,
						}}
					>
						<PDFViewer 
							pdfBuffer={pdfBuffer}
							onPasswordRequest={handlePasswordRequest}
						/>
					</Box>
				</Box>
			</Container>
			
			<Dialog open={showPasswordDialog} onClose={handlePasswordCancel}>
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
						onChange={(e) => setPasswordInput(e.target.value)}
						onKeyPress={(e) => {
							if (e.key === 'Enter') {
								handlePasswordSubmit();
							}
						}}
					/>
				</DialogContent>
				<DialogActions>
					<Button onClick={handlePasswordCancel}>Cancel</Button>
					<Button onClick={handlePasswordSubmit} variant="contained">
						Open PDF
					</Button>
				</DialogActions>
			</Dialog>
		</>
	);
}
