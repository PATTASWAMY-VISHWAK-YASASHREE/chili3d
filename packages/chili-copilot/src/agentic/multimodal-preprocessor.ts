// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { ImageDataEntry, PreprocessedInput } from "./types";

/**
 * Normalizes uploaded files into a format suitable for LLM vision APIs.
 * Supports images (PNG, JPEG, WebP) and basic format detection.
 */
export class MultimodalPreprocessor {
    private static readonly SUPPORTED_IMAGE_TYPES = [
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/svg+xml",
    ];
    private static readonly CAD_EXTENSIONS = [".step", ".stp", ".iges", ".igs"];

    /**
     * Preprocess a file for LLM consumption.
     */
    async preprocess(file: File): Promise<PreprocessedInput> {
        if (this.isImage(file.type)) {
            return this.preprocessImage(file);
        }
        if (file.type === "application/pdf") {
            return this.preprocessPDF(file);
        }
        if (this.isCADFormat(file.name)) {
            return this.preprocessCAD(file);
        }

        throw new Error(`Unsupported file type: ${file.type || file.name}`);
    }

    /**
     * Check if a MIME type is a supported image format.
     */
    isImage(mimeType: string): boolean {
        return MultimodalPreprocessor.SUPPORTED_IMAGE_TYPES.includes(mimeType);
    }

    /**
     * Check if a filename has a CAD extension.
     */
    isCADFormat(filename: string): boolean {
        const lower = filename.toLowerCase();
        return MultimodalPreprocessor.CAD_EXTENSIONS.some((ext) => lower.endsWith(ext));
    }

    /**
     * Preprocess an image file.
     */
    private async preprocessImage(file: File): Promise<PreprocessedInput> {
        const buffer = await file.arrayBuffer();
        const imageData: ImageDataEntry = {
            data: buffer,
            mimeType: file.type,
            width: 0,
            height: 0,
        };

        return {
            type: "image",
            images: [imageData],
            originalFileName: file.name,
        };
    }

    /**
     * Preprocess a PDF file.
     */
    private async preprocessPDF(file: File): Promise<PreprocessedInput> {
        const buffer = await file.arrayBuffer();
        return {
            type: "pdf",
            images: [
                {
                    data: buffer,
                    mimeType: "application/pdf",
                    width: 0,
                    height: 0,
                    pageNumber: 1,
                },
            ],
            originalFileName: file.name,
            pageCount: 1,
        };
    }

    /**
     * Preprocess a CAD file.
     */
    private async preprocessCAD(file: File): Promise<PreprocessedInput> {
        const buffer = await file.arrayBuffer();
        return {
            type: "cad",
            images: [
                {
                    data: buffer,
                    mimeType: "application/octet-stream",
                    width: 0,
                    height: 0,
                },
            ],
            originalFileName: file.name,
        };
    }
}
