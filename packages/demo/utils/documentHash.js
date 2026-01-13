/**
 * Document Hash Utility
 * Generates SHA-256 hash of PDF buffer for unique document identification
 */

/**
 * Calculate SHA-256 hash of a PDF buffer
 * @param {ArrayBuffer} arrayBuffer - PDF file as ArrayBuffer
 * @returns {Promise<string>} - Hex string of the hash
 */
export async function calculateDocumentHash(arrayBuffer) {
    try {
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
        return hashHex;
    } catch (error) {
        console.error('Error calculating document hash:', error);
        // Fallback to timestamp-based ID if crypto fails
        return `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}

/**
 * Calculate hash from Uint8Array
 * @param {Uint8Array} uint8Array - PDF file as Uint8Array
 * @returns {Promise<string>} - Hex string of the hash
 */
export async function calculateHashFromUint8Array(uint8Array) {
    return calculateDocumentHash(uint8Array.buffer);
}
