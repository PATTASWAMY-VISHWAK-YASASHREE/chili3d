// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { IApplication, IService } from "chili-core";
import type { IProviderRegistry } from "./provider-registry";
import { ProviderRegistry } from "./provider-registry";
import type { ToolExecutor } from "./tool-executor";

/**
 * CopilotService implements IService for application lifecycle integration.
 * It manages the LLM provider registry and serves as the main entry point
 * for AI copilot functionality within the Chili3D application.
 */
export class CopilotService implements IService {
    private _app: IApplication | undefined;
    private _registry: IProviderRegistry;
    private _toolExecutor: ToolExecutor | undefined;
    private _started = false;

    constructor(registry?: IProviderRegistry) {
        this._registry = registry ?? new ProviderRegistry();
    }

    get registry(): IProviderRegistry {
        return this._registry;
    }

    get app(): IApplication | undefined {
        return this._app;
    }

    get toolExecutor(): ToolExecutor | undefined {
        return this._toolExecutor;
    }

    get started(): boolean {
        return this._started;
    }

    register(app: IApplication): void {
        this._app = app;
    }

    start(): void {
        if (!this._app) {
            throw new Error("CopilotService must be registered with an application before starting");
        }
        this._started = true;
    }

    stop(): void {
        this._started = false;
        this._registry.dispose();
        this._registry = new ProviderRegistry();
        this._toolExecutor = undefined;
    }
}
