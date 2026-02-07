// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

/**
 * Tool definitions for LLM function calling and execution results.
 */

export interface ToolDefinition {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
}

export interface ToolCall {
    id: string;
    name: string;
    input: Record<string, unknown>;
}

export interface ToolResult {
    success: boolean;
    data?: unknown;
    error?: string;
}

/**
 * Built-in CAD tools exposed to the LLM.
 * Each tool maps to one or more ICommand executions.
 */
export const CAD_TOOLS: ToolDefinition[] = [
    {
        name: "create_sketch",
        description: "Create a 2D sketch on a plane (XY, XZ, YZ, or custom).",
        parameters: {
            type: "object",
            properties: {
                plane: { type: "string", enum: ["XY", "XZ", "YZ", "custom"] },
                origin: {
                    type: "array",
                    items: { type: "number" },
                    minItems: 3,
                    maxItems: 3,
                },
                shapes: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            type: {
                                type: "string",
                                enum: ["line", "arc", "circle", "rect", "spline"],
                            },
                            params: { type: "object" },
                        },
                    },
                },
            },
            required: ["plane", "shapes"],
        },
    },
    {
        name: "extrude",
        description: "Extrude a face or wire along a direction vector.",
        parameters: {
            type: "object",
            properties: {
                targetNodeId: { type: "string" },
                direction: {
                    type: "array",
                    items: { type: "number" },
                    minItems: 3,
                    maxItems: 3,
                },
                distance: { type: "number" },
            },
            required: ["targetNodeId", "direction", "distance"],
        },
    },
    {
        name: "boolean_operation",
        description: "Perform a boolean operation (union, difference, intersection) between two solids.",
        parameters: {
            type: "object",
            properties: {
                operation: {
                    type: "string",
                    enum: ["union", "difference", "intersection"],
                },
                bodyA: { type: "string" },
                bodyB: { type: "string" },
            },
            required: ["operation", "bodyA", "bodyB"],
        },
    },
    {
        name: "set_material",
        description: "Apply a material to a node by name or create a new material.",
        parameters: {
            type: "object",
            properties: {
                nodeId: { type: "string" },
                materialName: { type: "string" },
                color: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
            },
            required: ["nodeId"],
        },
    },
    {
        name: "query_scene",
        description: "Query the current scene graph for nodes, dimensions, and relationships.",
        parameters: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    enum: ["list_nodes", "get_bounds", "get_node_info"],
                },
                nodeId: { type: "string" },
            },
            required: ["query"],
        },
    },
];
