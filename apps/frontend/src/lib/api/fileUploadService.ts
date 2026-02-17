import { httpClient } from './http-client';

export interface UploadedFile {
    id: string;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    url: string;
    type: string;
    uploadedAt: string;
}

/**
 * File Upload Service for Ticket Attachments
 */
export const fileUploadService = {
    /**
     * Upload a file (image or document)
     */
    async uploadFile(file: File): Promise<UploadedFile> {
        const formData = new FormData();
        formData.append('file', file);

        return await httpClient.postWrapped<UploadedFile>('/tickets/attachments/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
    },

    /**
     * Get file by ID
     */
    async getFile(id: string): Promise<UploadedFile> {
        return await httpClient.getWrapped<UploadedFile>(`/tickets/attachments/${id}`);
    },
};
