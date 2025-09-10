interface ValidationResult {
    isValid: boolean;
    error?: string;
}

export function validatePDFBuffer(pdfBuffer: ArrayBuffer | null | undefined): ValidationResult {
    if (!pdfBuffer) {
        return {
            isValid: false,
            error: "PDF buffer is null or undefined"
        };
    }

    if (!(pdfBuffer instanceof ArrayBuffer)) {
        return {
            isValid: false,
            error: "Invalid PDF buffer: Buffer is not an ArrayBuffer"
        };
    }

    if (pdfBuffer.byteLength === 0) {
        return {
            isValid: false,
            error: "Invalid PDF buffer: Buffer is empty"
        };
    }

    // Check for PDF signature
    const uint8Array = new Uint8Array(pdfBuffer.slice(0, 4));
    const pdfSignature = String.fromCharCode(...uint8Array);
    
    if (!pdfSignature.startsWith('%PDF')) {
        return {
            isValid: false,
            error: "Invalid PDF file: Missing PDF signature"
        };
    }

    return {
        isValid: true
    };
}