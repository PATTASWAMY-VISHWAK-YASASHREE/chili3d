// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { describe, expect, test } from "@rstest/core";
import type { ToolHandler } from "../src/tool-executor";
import { ToolExecutor, validateToolInput } from "../src/tool-executor";

describe("validateToolInput", () => {
    const schema = {
        type: "object",
        properties: {
            name: { type: "string" },
            count: { type: "number" },
            tags: { type: "array" },
        },
        required: ["name", "count"],
    };

    test("should pass for valid input", () => {
        const result = validateToolInput({ name: "test", count: 5 }, schema);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    test("should fail for missing required fields", () => {
        const result = validateToolInput({ name: "test" }, schema);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain("Missing required field: count");
    });

    test("should fail for wrong type (string expected, number given)", () => {
        const result = validateToolInput({ name: 123, count: 5 }, schema);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain("Field 'name' must be a string");
    });

    test("should fail for wrong type (number expected, string given)", () => {
        const result = validateToolInput({ name: "test", count: "five" }, schema);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain("Field 'count' must be a number");
    });

    test("should fail for wrong type (array expected, object given)", () => {
        const result = validateToolInput({ name: "test", count: 5, tags: "not-array" }, schema);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain("Field 'tags' must be an array");
    });

    test("should pass for extra fields not in schema", () => {
        const result = validateToolInput({ name: "test", count: 5, extra: "ok" }, schema);
        expect(result.valid).toBe(true);
    });

    test("should pass for schema without required field", () => {
        const relaxedSchema = {
            type: "object",
            properties: { name: { type: "string" } },
        };
        const result = validateToolInput({}, relaxedSchema);
        expect(result.valid).toBe(true);
    });
});

describe("ToolExecutor", () => {
    test("should return error for unknown tool", async () => {
        const executor = new ToolExecutor();
        const result = await executor.execute({
            id: "call_1",
            name: "nonexistent",
            input: {},
        });
        expect(result.success).toBe(false);
        expect(result.error).toBe("Unknown tool: nonexistent");
    });

    test("should execute a registered handler", async () => {
        const executor = new ToolExecutor();
        const handler: ToolHandler = {
            schema: {
                type: "object",
                properties: { value: { type: "number" } },
                required: ["value"],
            },
            execute: async (input) => ({ doubled: (input["value"] as number) * 2 }),
        };

        executor.registerHandler("double", handler);

        const result = await executor.execute({
            id: "call_1",
            name: "double",
            input: { value: 21 },
        });

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ doubled: 42 });
    });

    test("should return validation error for invalid input", async () => {
        const executor = new ToolExecutor();
        const handler: ToolHandler = {
            schema: {
                type: "object",
                properties: { value: { type: "number" } },
                required: ["value"],
            },
            execute: async () => ({}),
        };

        executor.registerHandler("test", handler);

        const result = await executor.execute({
            id: "call_1",
            name: "test",
            input: {},
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain("Missing required field: value");
    });

    test("should catch and return handler execution errors", async () => {
        const executor = new ToolExecutor();
        const handler: ToolHandler = {
            schema: { type: "object", properties: {} },
            execute: async () => {
                throw new Error("CAD engine error");
            },
        };

        executor.registerHandler("failing", handler);

        const result = await executor.execute({
            id: "call_1",
            name: "failing",
            input: {},
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain("CAD engine error");
    });

    test("should return CAD tool definitions", () => {
        const executor = new ToolExecutor();
        const tools = executor.getToolDefinitions();
        expect(tools.length).toBeGreaterThan(0);
        expect(tools.find((t) => t.name === "extrude")).toBeDefined();
        expect(tools.find((t) => t.name === "create_sketch")).toBeDefined();
        expect(tools.find((t) => t.name === "boolean_operation")).toBeDefined();
        expect(tools.find((t) => t.name === "set_material")).toBeDefined();
        expect(tools.find((t) => t.name === "query_scene")).toBeDefined();
    });
});
