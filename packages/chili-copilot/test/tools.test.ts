// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { describe, expect, test } from "@rstest/core";
import { CAD_TOOLS } from "../src/tools";

describe("CAD_TOOLS", () => {
    test("should define create_sketch tool", () => {
        const tool = CAD_TOOLS.find((t) => t.name === "create_sketch");
        expect(tool).toBeDefined();
        expect(tool!.description).toContain("2D sketch");
        expect(tool!.parameters).toBeDefined();
        const required = tool!.parameters.required as string[];
        expect(required).toContain("plane");
        expect(required).toContain("shapes");
    });

    test("should define extrude tool", () => {
        const tool = CAD_TOOLS.find((t) => t.name === "extrude");
        expect(tool).toBeDefined();
        expect(tool!.description).toContain("Extrude");
        const required = tool!.parameters.required as string[];
        expect(required).toContain("targetNodeId");
        expect(required).toContain("direction");
        expect(required).toContain("distance");
    });

    test("should define boolean_operation tool", () => {
        const tool = CAD_TOOLS.find((t) => t.name === "boolean_operation");
        expect(tool).toBeDefined();
        const required = tool!.parameters.required as string[];
        expect(required).toContain("operation");
        expect(required).toContain("bodyA");
        expect(required).toContain("bodyB");
    });

    test("should define set_material tool", () => {
        const tool = CAD_TOOLS.find((t) => t.name === "set_material");
        expect(tool).toBeDefined();
        const required = tool!.parameters.required as string[];
        expect(required).toContain("nodeId");
    });

    test("should define query_scene tool", () => {
        const tool = CAD_TOOLS.find((t) => t.name === "query_scene");
        expect(tool).toBeDefined();
        const required = tool!.parameters.required as string[];
        expect(required).toContain("query");
    });

    test("should have valid JSON Schema structure for all tools", () => {
        for (const tool of CAD_TOOLS) {
            expect(tool.name).toBeDefined();
            expect(typeof tool.name).toBe("string");
            expect(tool.description).toBeDefined();
            expect(typeof tool.description).toBe("string");
            expect(tool.parameters).toBeDefined();
            expect(tool.parameters.type).toBe("object");
            expect(tool.parameters.properties).toBeDefined();
        }
    });
});
