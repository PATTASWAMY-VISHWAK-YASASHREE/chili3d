// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { describe, expect, test } from "@rstest/core";
import { MultimodalPreprocessor } from "../src/agentic/multimodal-preprocessor";

describe("MultimodalPreprocessor", () => {
    const preprocessor = new MultimodalPreprocessor();

    test("should recognize PNG as image", () => {
        expect(preprocessor.isImage("image/png")).toBe(true);
    });

    test("should recognize JPEG as image", () => {
        expect(preprocessor.isImage("image/jpeg")).toBe(true);
    });

    test("should recognize WebP as image", () => {
        expect(preprocessor.isImage("image/webp")).toBe(true);
    });

    test("should recognize SVG as image", () => {
        expect(preprocessor.isImage("image/svg+xml")).toBe(true);
    });

    test("should not recognize PDF as image", () => {
        expect(preprocessor.isImage("application/pdf")).toBe(false);
    });

    test("should not recognize text as image", () => {
        expect(preprocessor.isImage("text/plain")).toBe(false);
    });

    test("should recognize .step as CAD format", () => {
        expect(preprocessor.isCADFormat("model.step")).toBe(true);
    });

    test("should recognize .stp as CAD format", () => {
        expect(preprocessor.isCADFormat("model.stp")).toBe(true);
    });

    test("should recognize .iges as CAD format", () => {
        expect(preprocessor.isCADFormat("model.iges")).toBe(true);
    });

    test("should recognize .igs as CAD format", () => {
        expect(preprocessor.isCADFormat("model.igs")).toBe(true);
    });

    test("should recognize uppercase extensions", () => {
        expect(preprocessor.isCADFormat("model.STEP")).toBe(true);
    });

    test("should not recognize .obj as CAD format", () => {
        expect(preprocessor.isCADFormat("model.obj")).toBe(false);
    });

    test("should preprocess image file", async () => {
        const blob = new Blob(["fake image data"], { type: "image/png" });
        const file = new File([blob], "test.png", { type: "image/png" });

        const result = await preprocessor.preprocess(file);
        expect(result.type).toBe("image");
        expect(result.originalFileName).toBe("test.png");
        expect(result.images).toHaveLength(1);
        expect(result.images[0].mimeType).toBe("image/png");
    });

    test("should preprocess PDF file", async () => {
        const blob = new Blob(["fake pdf data"], { type: "application/pdf" });
        const file = new File([blob], "test.pdf", { type: "application/pdf" });

        const result = await preprocessor.preprocess(file);
        expect(result.type).toBe("pdf");
        expect(result.originalFileName).toBe("test.pdf");
        expect(result.pageCount).toBe(1);
    });

    test("should preprocess CAD file", async () => {
        const blob = new Blob(["fake step data"], { type: "application/octet-stream" });
        const file = new File([blob], "model.step", { type: "application/octet-stream" });

        const result = await preprocessor.preprocess(file);
        expect(result.type).toBe("cad");
        expect(result.originalFileName).toBe("model.step");
    });

    test("should throw for unsupported file type", async () => {
        const blob = new Blob(["data"], { type: "text/plain" });
        const file = new File([blob], "readme.txt", { type: "text/plain" });

        await expect(preprocessor.preprocess(file)).rejects.toThrow("Unsupported file type");
    });
});
