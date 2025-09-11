export enum PDFErrorType {
    ENGINE = 'ENGINE',
    VALIDATION = 'VALIDATION',
    LOADING = 'LOADING'
}

export interface PDFError {
    type: PDFErrorType;
    message: string;
    originalError?: any;
}

export function createPDFError(type: PDFErrorType, message: string, originalError?: any): PDFError {
    return {
        type,
        message,
        originalError
    };
}