// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { ToolCall, ToolDefinition, ToolResult } from "./tools";
import { CAD_TOOLS } from "./tools";

/**
 * Handler for a specific tool — validates input and executes the action.
 */
export interface ToolHandler {
    schema: Record<string, unknown>;
    execute(input: Record<string, unknown>): Promise<unknown>;
}

/**
 * Validates an input object against a JSON Schema (simplified validation).
 * Checks required fields and basic type constraints.
 */
export function validateToolInput(
    input: Record<string, unknown>,
    schema: Record<string, unknown>,
): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const required = (schema["required"] as string[] | undefined) ?? [];
    const properties = (schema["properties"] as Record<string, Record<string, unknown>> | undefined) ?? {};

    for (const field of required) {
        if (!(field in input)) {
            errors.push(`Missing required field: ${field}`);
        }
    }

    for (const [key, value] of Object.entries(input)) {
        const propSchema = properties[key];
        if (!propSchema) {
            continue;
        }
        const expectedType = propSchema["type"] as string | undefined;
        if (expectedType === "string" && typeof value !== "string") {
            errors.push(`Field '${key}' must be a string`);
        } else if (expectedType === "number" && typeof value !== "number") {
            errors.push(`Field '${key}' must be a number`);
        } else if (expectedType === "array" && !Array.isArray(value)) {
            errors.push(`Field '${key}' must be an array`);
        } else if (expectedType === "object" && (typeof value !== "object" || value === null)) {
            errors.push(`Field '${key}' must be an object`);
        }
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Translates LLM tool calls into handler executions.
 * This is the critical bridge between AI output and the CAD engine.
 */
export class ToolExecutor {
    private readonly handlers = new Map<string, ToolHandler>();

    /**
     * Register a handler for a named tool.
     */
    registerHandler(name: string, handler: ToolHandler): void {
        this.handlers.set(name, handler);
    }

    /**
     * Get available tool definitions for sending to the LLM.
     */
    getToolDefinitions(): ToolDefinition[] {
        return CAD_TOOLS;
    }

    /**
     * Execute a tool call from the LLM.
     * Validates input against schema, then delegates to the handler.
     */
    async execute(toolCall: ToolCall): Promise<ToolResult> {
        const handler = this.handlers.get(toolCall.name);
        if (!handler) {
            return { success: false, error: `Unknown tool: ${toolCall.name}` };
        }

        const validation = validateToolInput(toolCall.input, handler.schema);
        if (!validation.valid) {
            return { success: false, error: validation.errors.join(", ") };
        }

        try {
            const result = await handler.execute(toolCall.input);
            return { success: true, data: result };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }
}
