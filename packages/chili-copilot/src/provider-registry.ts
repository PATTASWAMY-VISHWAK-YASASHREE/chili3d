// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { IDisposable } from "chili-core";
import type { ILLMProvider } from "./provider";

/**
 * Manages available LLM providers and allows runtime switching.
 * Implements the Strategy pattern — the active provider can be
 * changed at any time without restarting the application.
 */
export interface IProviderRegistry extends IDisposable {
    readonly providers: ReadonlyMap<string, ILLMProvider>;
    activeProvider: ILLMProvider | undefined;

    register(provider: ILLMProvider): void;
    unregister(id: string): void;
    setActive(id: string): void;
}

export class ProviderRegistry implements IProviderRegistry {
    private readonly _providers = new Map<string, ILLMProvider>();
    private _activeProvider: ILLMProvider | undefined;

    get providers(): ReadonlyMap<string, ILLMProvider> {
        return this._providers;
    }

    get activeProvider(): ILLMProvider | undefined {
        return this._activeProvider;
    }

    set activeProvider(provider: ILLMProvider | undefined) {
        this._activeProvider = provider;
    }

    register(provider: ILLMProvider): void {
        if (this._providers.has(provider.id)) {
            throw new Error(`Provider already registered: ${provider.id}`);
        }
        this._providers.set(provider.id, provider);
        if (!this._activeProvider) {
            this._activeProvider = provider;
        }
    }

    unregister(id: string): void {
        const provider = this._providers.get(id);
        if (!provider) {
            return;
        }
        this._providers.delete(id);
        if (this._activeProvider?.id === id) {
            this._activeProvider =
                this._providers.size > 0 ? this._providers.values().next().value : undefined;
        }
    }

    setActive(id: string): void {
        const provider = this._providers.get(id);
        if (!provider) {
            throw new Error(`Provider not found: ${id}`);
        }
        this._activeProvider = provider;
    }

    dispose(): void {
        for (const provider of this._providers.values()) {
            provider.dispose();
        }
        this._providers.clear();
        this._activeProvider = undefined;
    }
}
