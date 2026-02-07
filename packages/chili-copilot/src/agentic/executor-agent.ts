// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { ILLMProvider } from "../provider";
import type { ToolExecutor } from "../tool-executor";
import type { Plan, PlanStep, StepResult } from "./types";

/**
 * The Executor Agent takes an approved Plan and executes each step
 * by making tool calls through the LLM, which are then
 * translated into ICommand executions via the ToolExecutor.
 */
export class ExecutorAgent {
    constructor(
        private readonly provider: ILLMProvider,
        private readonly toolExecutor: ToolExecutor,
    ) {}

    /**
     * Execute all steps in a plan in dependency order.
     */
    async executePlan(plan: Plan, signal?: AbortSignal): Promise<StepResult[]> {
        const results: StepResult[] = [];
        const sortedSteps = this.topologicalSort(plan.steps);

        for (const step of sortedSteps) {
            if (signal?.aborted) break;

            step.status = "active";

            const result = await this.executeStep(step, plan, results);
            results.push(result);

            step.status = result.status === "success" ? "done" : "failed";

            if (result.status === "failure") {
                const retryResult = await this.retryStep(step, result.error ?? "Unknown error");
                if (retryResult.status === "failure") {
                    this.skipDependents(step.index, plan.steps);
                    break;
                }
                results[results.length - 1] = retryResult;
                step.status = "done";
            }
        }

        return results;
    }

    private async executeStep(
        step: PlanStep,
        plan: Plan,
        previousResults: StepResult[],
    ): Promise<StepResult> {
        try {
            const contextParts = [
                `Plan: ${plan.title}`,
                `Current step ${step.index + 1}: ${step.label}`,
                `Description: ${step.description}`,
                `Available tools: ${step.toolHints.join(", ")}`,
            ];

            if (previousResults.length > 0) {
                contextParts.push(
                    `Previous results: ${JSON.stringify(previousResults.map((r) => ({ step: r.stepIndex, status: r.status })))}`,
                );
            }

            const stream = this.provider.chat({
                messages: [
                    {
                        role: "system",
                        content: [
                            {
                                type: "text",
                                text: "You are a CAD execution agent. Execute the given step using the available tools.",
                            },
                        ],
                    },
                    {
                        role: "user",
                        content: [{ type: "text", text: contextParts.join("\n") }],
                    },
                ],
                tools: this.toolExecutor.getToolDefinitions(),
                temperature: 0.1,
            });

            const nodeIds: string[] = [];
            for await (const chunk of stream) {
                if (chunk.toolCalls) {
                    for (const call of chunk.toolCalls) {
                        const toolResult = await this.toolExecutor.execute(call);
                        if (toolResult.success && toolResult.data) {
                            const data = toolResult.data as Record<string, unknown>;
                            const nodeId = data["nodeId"] as string | undefined;
                            if (nodeId) {
                                nodeIds.push(nodeId);
                            }
                        } else if (!toolResult.success) {
                            return {
                                stepIndex: step.index,
                                status: "failure",
                                error: toolResult.error,
                            };
                        }
                    }
                }
            }

            return { stepIndex: step.index, status: "success", nodeIds };
        } catch (error) {
            return {
                stepIndex: step.index,
                status: "failure",
                error: String(error),
            };
        }
    }

    private async retryStep(step: PlanStep, errorMessage: string): Promise<StepResult> {
        try {
            const stream = this.provider.chat({
                messages: [
                    {
                        role: "system",
                        content: [
                            {
                                type: "text",
                                text: "You are a CAD execution agent. The previous attempt failed. Try again.",
                            },
                        ],
                    },
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: `Step: ${step.label}\nPrevious error: ${errorMessage}\nPlease retry.`,
                            },
                        ],
                    },
                ],
                tools: this.toolExecutor.getToolDefinitions(),
                temperature: 0.3,
            });

            for await (const chunk of stream) {
                if (chunk.toolCalls) {
                    for (const call of chunk.toolCalls) {
                        const result = await this.toolExecutor.execute(call);
                        if (!result.success) {
                            return {
                                stepIndex: step.index,
                                status: "failure",
                                error: result.error,
                            };
                        }
                    }
                }
            }

            return { stepIndex: step.index, status: "success" };
        } catch (error) {
            return {
                stepIndex: step.index,
                status: "failure",
                error: String(error),
            };
        }
    }

    /**
     * Topological sort ensures steps execute in dependency order.
     * Uses Kahn's algorithm.
     */
    topologicalSort(steps: PlanStep[]): PlanStep[] {
        const inDegree = new Map<number, number>();
        const adjacency = new Map<number, number[]>();

        for (const step of steps) {
            inDegree.set(step.index, step.dependsOn.length);
            if (!adjacency.has(step.index)) {
                adjacency.set(step.index, []);
            }
            for (const dep of step.dependsOn) {
                const existing = adjacency.get(dep) ?? [];
                existing.push(step.index);
                adjacency.set(dep, existing);
            }
        }

        const queue: number[] = [];
        for (const [index, degree] of inDegree) {
            if (degree === 0) {
                queue.push(index);
            }
        }

        const sorted: PlanStep[] = [];
        const stepMap = new Map(steps.map((s) => [s.index, s]));

        while (queue.length > 0) {
            const current = queue.shift()!;
            const step = stepMap.get(current);
            if (step) sorted.push(step);

            for (const neighbor of adjacency.get(current) ?? []) {
                const deg = (inDegree.get(neighbor) ?? 1) - 1;
                inDegree.set(neighbor, deg);
                if (deg === 0) {
                    queue.push(neighbor);
                }
            }
        }

        return sorted;
    }

    private skipDependents(failedIndex: number, steps: PlanStep[]): void {
        for (const step of steps) {
            if (step.dependsOn.includes(failedIndex) && step.status === "pending") {
                step.status = "skipped";
                this.skipDependents(step.index, steps);
            }
        }
    }
}
