// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { describe, expect, test } from "@rstest/core";
import type { IApplication } from "chili-core";
import { CopilotService } from "../src/copilot-service";

function createMockApp(): IApplication {
    return {} as IApplication;
}

describe("CopilotService", () => {
    test("should start with a registry and not started", () => {
        const service = new CopilotService();
        expect(service.registry).toBeDefined();
        expect(service.started).toBe(false);
        expect(service.app).toBeUndefined();
    });

    test("should register with an application", () => {
        const service = new CopilotService();
        const app = createMockApp();

        service.register(app);

        expect(service.app).toBe(app);
    });

    test("should start after registration", () => {
        const service = new CopilotService();
        const app = createMockApp();

        service.register(app);
        service.start();

        expect(service.started).toBe(true);
    });

    test("should throw when starting without registration", () => {
        const service = new CopilotService();

        expect(() => service.start()).toThrow(
            "CopilotService must be registered with an application before starting",
        );
    });

    test("should stop and reset state", () => {
        const service = new CopilotService();
        const app = createMockApp();

        service.register(app);
        service.start();
        service.stop();

        expect(service.started).toBe(false);
    });

    test("should use custom registry if provided", () => {
        const { ProviderRegistry } = require("../src/provider-registry");
        const customRegistry = new ProviderRegistry();
        const service = new CopilotService(customRegistry);

        expect(service.registry).toBe(customRegistry);
    });
});
