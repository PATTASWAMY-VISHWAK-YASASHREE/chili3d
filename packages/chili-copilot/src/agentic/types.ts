// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

/**
 * Types for the agentic workflow system.
 */

export type WorkflowState =
    | { phase: "idle" }
    | { phase: "analyzing"; userPrompt: string }
    | { phase: "clarifying"; questions: ClarificationQuestion[]; answers: Map<string, string> }
    | { phase: "planning"; plan: Plan }
    | { phase: "awaiting_approval"; plan: Plan }
    | { phase: "executing"; plan: Plan; currentStepIndex: number }
    | { phase: "completed"; plan: Plan; results: StepResult[] }
    | { phase: "error"; error: string; recoverable: boolean };

export interface ClarificationQuestion {
    id: string;
    question: string;
    type: "text" | "choice" | "number" | "boolean";
    options?: string[];
    default?: string;
    required: boolean;
}

export interface Plan {
    id: string;
    title: string;
    description: string;
    constraints: Record<string, string>;
    steps: PlanStep[];
    estimatedTokens: number;
    estimatedCostUsd: number;
}

export interface PlanStep {
    index: number;
    label: string;
    description: string;
    dependsOn: number[];
    toolHints: string[];
    status: "pending" | "active" | "done" | "failed" | "skipped";
}

export type StepResult = {
    stepIndex: number;
    status: "success" | "failure";
    nodeIds?: string[];
    error?: string;
};

export interface PreprocessedInput {
    type: "image" | "pdf" | "cad";
    images: ImageDataEntry[];
    originalFileName: string;
    pageCount?: number;
}

export interface ImageDataEntry {
    data: ArrayBuffer;
    mimeType: string;
    width: number;
    height: number;
    pageNumber?: number;
}

export interface GeometricConstraints {
    viewType: "front" | "side" | "top" | "isometric" | "perspective" | "unknown";
    overallShape: string;
    dimensions: Dimension[];
    relationships: SpatialRelationship[];
    confidence: number;
}

export interface Dimension {
    feature: string;
    value: number;
    unit: "mm" | "cm" | "m" | "in";
    confidence: number;
}

export interface SpatialRelationship {
    featureA: string;
    featureB: string;
    type: "parallel" | "perpendicular" | "concentric" | "tangent" | "offset";
    value?: number;
}
