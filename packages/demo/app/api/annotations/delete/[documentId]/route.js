/**
 * Mock API Route: Delete Annotations
 * DELETE /api/annotations/delete/[documentId]
 * Deletes annotations from localStorage (mock backend)
 */

import { NextResponse } from 'next/server';

const STORAGE_PREFIX = 'pdf-annotations-';

export async function DELETE(request, { params }) {
    try {
        const { documentId } = params;

        if (!documentId) {
            return NextResponse.json(
                { error: 'Document ID is required' },
                { status: 400 }
            );
        }

        const storageKey = `${STORAGE_PREFIX}${documentId}`;

        // For server-side, simulate deletion
        // In production, this would delete from database
        if (typeof window !== 'undefined') {
            localStorage.removeItem(storageKey);
        }

        return NextResponse.json({
            success: true,
            documentId,
            message: 'Annotations deleted successfully',
        });
    } catch (error) {
        console.error('Error in delete annotations API:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}
