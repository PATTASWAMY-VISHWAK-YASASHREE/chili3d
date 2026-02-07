// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { describe, expect, test } from "@rstest/core";
import type { SceneNode } from "../src/scene-context-provider";
import { SceneContextProvider } from "../src/scene-context-provider";

describe("SceneContextProvider", () => {
    const provider = new SceneContextProvider();

    test("should return empty scene message", () => {
        const result = provider.getSnapshot([]);
        expect(result).toContain("empty");
    });

    test("should format scene with nodes", () => {
        const nodes: SceneNode[] = [
            { id: "1", name: "Cube", type: "SOLID", depth: 0, dimensions: "10x10x10mm" },
            { id: "2", name: "Cylinder", type: "SOLID", depth: 0 },
        ];
        const result = provider.getSnapshot(nodes);
        expect(result).toContain("Cube");
        expect(result).toContain("SOLID");
        expect(result).toContain("10x10x10mm");
        expect(result).toContain("Cylinder");
    });

    test("should handle nested nodes with depth", () => {
        const nodes: SceneNode[] = [
            { id: "1", name: "Assembly", type: "COMPOUND", depth: 0 },
            { id: "2", name: "Part A", type: "SOLID", depth: 1 },
            { id: "3", name: "Part B", type: "SOLID", depth: 2 },
        ];
        const result = provider.getSnapshot(nodes);
        // Part B should be more indented than Part A
        expect(result).toContain("Assembly");
        expect(result).toContain("Part A");
        expect(result).toContain("Part B");
    });

    test("should serialize a single node", () => {
        const node: SceneNode = {
            id: "1",
            name: "Cube",
            type: "SOLID",
            dimensions: "10x10x10mm",
            material: "Steel",
            children: ["face1", "face2"],
        };
        const result = provider.serializeNode(node);
        expect(result).toContain("Name: Cube");
        expect(result).toContain("Type: SOLID");
        expect(result).toContain("Dimensions: 10x10x10mm");
        expect(result).toContain("Material: Steel");
        expect(result).toContain("Children: face1, face2");
    });

    test("should serialize a minimal node", () => {
        const node: SceneNode = { id: "1", name: "Point", type: "VERTEX" };
        const result = provider.serializeNode(node);
        expect(result).toContain("Name: Point");
        expect(result).toContain("Type: VERTEX");
        expect(result).not.toContain("Dimensions");
        expect(result).not.toContain("Material");
    });
});
