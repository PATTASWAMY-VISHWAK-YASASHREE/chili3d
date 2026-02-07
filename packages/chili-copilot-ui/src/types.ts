// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

/**
 * Data types for the reasoning trace and plan approval UI.
 */

export interface ReasoningTrace {
    readonly id: string;
    readonly timestamp: number;
    readonly entries: ReasoningEntry[];
    status: "thinking" | "planning" | "executing" | "complete" | "error";
}

export type ReasoningEntry =
    | { type: "thinking"; content: string }
    | {
          type: "tool_call";
          toolName: string;
          input: unknown;
          output?: unknown;
          status: "pending" | "success" | "error";
      }
    | { type: "plan_step"; index: number; label: string; status: "pending" | "active" | "done" | "skipped" }
    | { type: "code"; language: string; code: string }
    | { type: "message"; role: "assistant"; content: string };

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
