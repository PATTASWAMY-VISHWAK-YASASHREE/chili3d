// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

/**
 * Provides serialized scene context for LLM consumption.
 * Reads the document's model manager and produces a text summary.
 */
export class SceneContextProvider {
    /**
     * Generate a text snapshot of the scene for LLM context.
     * This is a simplified implementation that can be extended
     * to traverse the actual IDocument scene graph.
     */
    getSnapshot(sceneData: SceneNode[]): string {
        if (sceneData.length === 0) {
            return "Scene is empty. No objects have been created yet.";
        }

        const lines: string[] = ["Current scene graph:"];
        for (const node of sceneData) {
            const indent = "  ".repeat(node.depth ?? 0);
            let line = `${indent}- ${node.name} (${node.type})`;
            if (node.dimensions) {
                line += ` [${node.dimensions}]`;
            }
            lines.push(line);
        }

        return lines.join("\n");
    }

    /**
     * Serialize a single scene node to text for embedding.
     */
    serializeNode(node: SceneNode): string {
        const parts = [`Name: ${node.name}`, `Type: ${node.type}`];
        if (node.dimensions) {
            parts.push(`Dimensions: ${node.dimensions}`);
        }
        if (node.material) {
            parts.push(`Material: ${node.material}`);
        }
        if (node.children && node.children.length > 0) {
            parts.push(`Children: ${node.children.join(", ")}`);
        }
        return parts.join("; ");
    }
}

/**
 * Simplified scene node representation for serialization.
 */
export interface SceneNode {
    id: string;
    name: string;
    type: string;
    depth?: number;
    dimensions?: string;
    material?: string;
    children?: string[];
}
