export enum PDFErrorType {
    ENGINE = 'ENGINE',
    VALIDATION = 'VALIDATION',
    LOADING = 'LOADING'
}

export interface PDFError {
    type: PDFErrorType;
    message: string;
    originalError?: unknown;
}

export function createPDFError(type: PDFErrorType, message: string, originalError?: unknown): PDFError {
    return {
        type,
        message,
        originalError
    };
}