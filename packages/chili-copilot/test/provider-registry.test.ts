// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { describe, expect, test } from "@rstest/core";
import type { ILLMProvider } from "../src/provider";
import { ProviderRegistry } from "../src/provider-registry";

function createMockProvider(id: string, displayName?: string): ILLMProvider {
    return {
        id,
        displayName: displayName ?? id,
        capabilities: {
            supportsVision: true,
            supportsStreaming: true,
            supportsFunctionCalling: true,
            maxContextTokens: 128_000,
            maxOutputTokens: 16_384,
            embeddingDimensions: 1536,
        },
        chat: async function* () {},
        embedText: async () => [],
        dispose: () => {},
    };
}

describe("ProviderRegistry", () => {
    test("should register a provider and set it as active", () => {
        const registry = new ProviderRegistry();
        const provider = createMockProvider("openai", "GPT-4o");

        registry.register(provider);

        expect(registry.providers.size).toBe(1);
        expect(registry.activeProvider).toBe(provider);
    });

    test("should not overwrite active provider on subsequent registrations", () => {
        const registry = new ProviderRegistry();
        const first = createMockProvider("openai");
        const second = createMockProvider("anthropic");

        registry.register(first);
        registry.register(second);

        expect(registry.providers.size).toBe(2);
        expect(registry.activeProvider).toBe(first);
    });

    test("should throw when registering a duplicate provider id", () => {
        const registry = new ProviderRegistry();
        const provider = createMockProvider("openai");

        registry.register(provider);
        expect(() => registry.register(createMockProvider("openai"))).toThrow(
            "Provider already registered: openai",
        );
    });

    test("should switch active provider", () => {
        const registry = new ProviderRegistry();
        const openai = createMockProvider("openai");
        const anthropic = createMockProvider("anthropic");

        registry.register(openai);
        registry.register(anthropic);

        registry.setActive("anthropic");
        expect(registry.activeProvider).toBe(anthropic);
    });

    test("should throw when setting active to unknown provider", () => {
        const registry = new ProviderRegistry();
        expect(() => registry.setActive("nonexistent")).toThrow("Provider not found: nonexistent");
    });

    test("should unregister a provider", () => {
        const registry = new ProviderRegistry();
        const openai = createMockProvider("openai");
        const anthropic = createMockProvider("anthropic");

        registry.register(openai);
        registry.register(anthropic);
        registry.unregister("openai");

        expect(registry.providers.size).toBe(1);
        expect(registry.providers.has("openai")).toBe(false);
    });

    test("should fall back to next provider when active is unregistered", () => {
        const registry = new ProviderRegistry();
        const openai = createMockProvider("openai");
        const anthropic = createMockProvider("anthropic");

        registry.register(openai);
        registry.register(anthropic);
        registry.unregister("openai");

        expect(registry.activeProvider).toBe(anthropic);
    });

    test("should set activeProvider to undefined when last provider is unregistered", () => {
        const registry = new ProviderRegistry();
        const openai = createMockProvider("openai");

        registry.register(openai);
        registry.unregister("openai");

        expect(registry.activeProvider).toBeUndefined();
    });

    test("should not throw when unregistering non-existent provider", () => {
        const registry = new ProviderRegistry();
        expect(() => registry.unregister("nonexistent")).not.toThrow();
    });

    test("should dispose all providers on dispose", () => {
        const registry = new ProviderRegistry();
        let disposed1 = false;
        let disposed2 = false;

        const provider1 = {
            ...createMockProvider("openai"),
            dispose: () => {
                disposed1 = true;
            },
        };
        const provider2 = {
            ...createMockProvider("anthropic"),
            dispose: () => {
                disposed2 = true;
            },
        };

        registry.register(provider1);
        registry.register(provider2);
        registry.dispose();

        expect(disposed1).toBe(true);
        expect(disposed2).toBe(true);
        expect(registry.providers.size).toBe(0);
        expect(registry.activeProvider).toBeUndefined();
    });
});
