/**
 * Annotation Serialization Utilities
 * Helper functions to serialize/deserialize annotations for API storage
 */

/**
 * Serialize annotations for API storage
 * Converts annotation objects to a clean JSON-serializable format
 * @param {Array} annotations - Array of annotation objects from embedpdf
 * @returns {Array} - Serialized annotations
 */
export function serializeAnnotations(annotations) {
    return annotations.map((ann) => ({
        id: ann.id,
        type: ann.type,
        pageIndex: ann.pageIndex,
        rect: ann.rect,
        subject: ann.subject || null,
        author: ann.author || null,
        created: ann.created || new Date().toISOString(),
        modified: ann.modified || new Date().toISOString(),
        content: ann.content || null,
        color: ann.color || null,
        flags: ann.flags || null,
        icon: ann.icon || null,
        // Store stamp annotation image data
        imageSrc: ann.imageSrc || null,
        imageSize: ann.imageSize || null,
        // Store ink/signature paths
        inkList: ann.inkList || null,
        // Store appearance for proper rendering
        appearance: ann.appearance || null,
        // Store any additional custom data
        customData: ann.customData || null,
        // Store raw annotation for complete restoration
        _raw: ann,
    }));
}

/**
 * Deserialize annotations from API
 * @param {Array} serializedAnnotations - Serialized annotations from API
 * @returns {Array} - Deserialized annotations
 */
export function deserializeAnnotations(serializedAnnotations) {
    if (!Array.isArray(serializedAnnotations)) {
        return [];
    }

    return serializedAnnotations.map((ann) => {
        // If we have the raw annotation, use it
        if (ann._raw) {
            return ann._raw;
        }

        // Otherwise reconstruct from serialized data
        return {
            id: ann.id,
            type: ann.type,
            pageIndex: ann.pageIndex,
            rect: ann.rect,
            subject: ann.subject,
            author: ann.author,
            created: ann.created,
            modified: ann.modified,
            content: ann.content,
            color: ann.color,
            flags: ann.flags,
            icon: ann.icon,
            customData: ann.customData,
            // Include stamp annotation image data
            imageSrc: ann.imageSrc,
            imageSize: ann.imageSize,
            // Include ink/signature paths
            inkList: ann.inkList,
            // Include appearance for proper rendering
            appearance: ann.appearance,
        };
    });
}

/**
 * Normalize annotation for Redux state
 * Ensures consistent structure for state management
 * @param {Object} annotation - Annotation object
 * @returns {Object} - Normalized annotation
 */
export function normalizeAnnotation(annotation) {
    return {
        id: annotation.id,
        type: annotation.type,
        pageIndex: annotation.pageIndex,
        rect: annotation.rect,
        subject: annotation.subject || null,
        author: annotation.author || null,
        created: annotation.created || new Date().toISOString(),
        modified: annotation.modified || new Date().toISOString(),
        content: annotation.content || null,
        color: annotation.color || null,
        flags: annotation.flags || null,
        icon: annotation.icon || null,
        customData: annotation.customData || null,
        // CRITICAL: Preserve stamp annotation image data
        imageSrc: annotation.imageSrc || null,
        imageSize: annotation.imageSize || null,
        // Preserve ink/signature paths
        inkList: annotation.inkList || null,
        // Preserve appearance stream for proper rendering
        appearance: annotation.appearance || null,
    };
}
