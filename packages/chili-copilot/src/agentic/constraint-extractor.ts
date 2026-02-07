// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { ILLMProvider } from "../provider";
import type { GeometricConstraints, PreprocessedInput } from "./types";

const VISION_ANALYSIS_SYSTEM_PROMPT = `You are a geometric constraint extraction agent. Given an image or blueprint, identify:
1. Overall shape classification (prismatic, cylindrical, organic, etc.)
2. Dimensional constraints (lengths, radii, angles) with units
3. Spatial relationships (parallel, perpendicular, concentric, tangent)
4. View interpretation (front, side, top, isometric)

Respond with valid JSON matching this schema:
{
  "viewType": "front" | "side" | "top" | "isometric" | "perspective" | "unknown",
  "overallShape": string,
  "dimensions": [{ "feature": string, "value": number, "unit": "mm"|"cm"|"m"|"in", "confidence": number }],
  "relationships": [{ "featureA": string, "featureB": string, "type": "parallel"|"perpendicular"|"concentric"|"tangent"|"offset", "value"?: number }],
  "confidence": number
}`;

/**
 * Uses the LLM's vision capabilities to extract geometric
 * constraints from images/blueprints.
 */
export class ConstraintExtractor {
    constructor(private readonly provider: ILLMProvider) {}

    /**
     * Analyze preprocessed image input and extract geometric constraints.
     */
    async extractConstraints(input: PreprocessedInput): Promise<GeometricConstraints> {
        const imageContents = input.images.map((img) => ({
            type: "image" as const,
            data: img.data,
            mimeType: img.mimeType,
        }));

        const stream = this.provider.chat({
            messages: [
                {
                    role: "system",
                    content: [{ type: "text", text: VISION_ANALYSIS_SYSTEM_PROMPT }],
                },
                {
                    role: "user",
                    content: [
                        ...imageContents,
                        {
                            type: "text",
                            text: "Analyze this image/blueprint and extract all geometric constraints. Output structured JSON.",
                        },
                    ],
                },
            ],
            responseFormat: "json",
            temperature: 0.1,
        });

        let response = "";
        for await (const chunk of stream) {
            response += chunk.delta;
        }

        return this.parseConstraints(response);
    }

    private parseConstraints(response: string): GeometricConstraints {
        const parsed = JSON.parse(response);
        return {
            viewType: parsed.viewType ?? "unknown",
            overallShape: parsed.overallShape ?? "unknown",
            dimensions: parsed.dimensions ?? [],
            relationships: parsed.relationships ?? [],
            confidence: parsed.confidence ?? 0,
        };
    }
}
