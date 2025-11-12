export default function isPasswordProtected(pdfBuffer: ArrayBuffer | Uint8Array): boolean {
    const uint8Array = pdfBuffer instanceof Uint8Array ? pdfBuffer : new Uint8Array(pdfBuffer);
    const searchPattern = '/Encrypt';
    const searchBytes = new TextEncoder().encode(searchPattern);

    for (let i = 0; i <= uint8Array.length - searchBytes.length; i++) {
        let match = true;

        for (let j = 0; j < searchBytes.length; j++) {
            if (uint8Array[i + j] !== searchBytes[j]) {
                match = false;
                break;
            }
        }

        if (match) {
            return true;
        }
    }

    return false;
}