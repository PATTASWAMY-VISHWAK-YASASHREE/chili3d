// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { ILLMProvider } from "../provider";
import type { ClarificationQuestion, Plan } from "./types";

const PLANNER_SYSTEM_PROMPT = `You are a CAD planning agent. Given a user request and scene context, you must:
1. Determine if you need clarification (ambiguous request, missing dimensions, etc.)
2. If clarification is needed, return a JSON object with needsClarification: true and questions array
3. If no clarification is needed, return a JSON object with needsClarification: false and a plan object

A plan has: id, title, description, constraints, steps (ordered), estimatedTokens, estimatedCostUsd.
Each step has: index, label, description, dependsOn (indices), toolHints (tool names), status: "pending".

Available tools: create_sketch, extrude, boolean_operation, set_material, query_scene.

Always respond with valid JSON.`;

/**
 * The Planner Agent analyzes user intent and generates structured plans.
 * Uses a specialized LLM call with constrained output.
 */
export class PlannerAgent {
    constructor(private readonly provider: ILLMProvider) {}

    /**
     * Analyze user intent and determine if clarification is needed.
     */
    async analyzeIntent(
        prompt: string,
        sceneContext: string,
    ): Promise<
        | { needsClarification: true; questions: ClarificationQuestion[] }
        | { needsClarification: false; plan: Plan }
    > {
        const response = await this.collectStreamResponse(
            this.provider.chat({
                messages: [
                    {
                        role: "system",
                        content: [{ type: "text", text: PLANNER_SYSTEM_PROMPT }],
                    },
                    {
                        role: "user",
                        content: [
                            { type: "text", text: `Scene context:\n${sceneContext}` },
                            { type: "text", text: `User request: ${prompt}` },
                        ],
                    },
                ],
                responseFormat: "json",
                temperature: 0.2,
            }),
        );

        return this.parseIntentResponse(response);
    }

    /**
     * Generate a detailed plan given user constraints.
     */
    async generatePlan(
        prompt: string,
        constraints: Record<string, string>,
        sceneContext: string,
    ): Promise<Plan> {
        const constraintText = Object.entries(constraints)
            .map(([k, v]) => `${k}: ${v}`)
            .join("\n");

        const response = await this.collectStreamResponse(
            this.provider.chat({
                messages: [
                    {
                        role: "system",
                        content: [{ type: "text", text: PLANNER_SYSTEM_PROMPT }],
                    },
                    {
                        role: "user",
                        content: [
                            { type: "text", text: `Scene context:\n${sceneContext}` },
                            {
                                type: "text",
                                text: `User request: ${prompt}\nConstraints:\n${constraintText}\n\nGenerate a detailed plan. Respond with JSON containing the plan object directly.`,
                            },
                        ],
                    },
                ],
                responseFormat: "json",
                temperature: 0.2,
            }),
        );

        return JSON.parse(response) as Plan;
    }

    private parseIntentResponse(
        response: string,
    ):
        | { needsClarification: true; questions: ClarificationQuestion[] }
        | { needsClarification: false; plan: Plan } {
        const parsed = JSON.parse(response);
        if (parsed.needsClarification) {
            return { needsClarification: true, questions: parsed.questions ?? [] };
        }
        return { needsClarification: false, plan: parsed.plan ?? parsed };
    }

    private async collectStreamResponse(stream: AsyncIterable<{ delta: string }>): Promise<string> {
        let result = "";
        for await (const chunk of stream) {
            result += chunk.delta;
        }
        return result;
    }
}
