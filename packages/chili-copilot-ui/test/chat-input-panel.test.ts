// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { describe, expect, test } from "@rstest/core";
import { ChatInputPanel } from "../src/chat-input-panel";

describe("ChatInputPanel", () => {
    test("should be defined as custom element", () => {
        const el = document.createElement("copilot-chat-input");
        expect(el).toBeInstanceOf(ChatInputPanel);
    });

    test("should render input elements on connect", () => {
        const panel = new ChatInputPanel();
        document.body.appendChild(panel);

        expect(panel.querySelector("textarea")).toBeTruthy();
        expect(panel.querySelectorAll("button").length).toBe(2); // send + upload

        document.body.removeChild(panel);
    });

    test("should call onSubmit when send is clicked", () => {
        const panel = new ChatInputPanel();
        document.body.appendChild(panel);

        let submitted: string | undefined;
        panel.onSubmit((text) => {
            submitted = text;
        });

        panel.value = "Create a cube";
        const sendBtn = panel.querySelectorAll("button")[1]; // upload, then send in DOM order
        // Find the Send button
        const buttons = Array.from(panel.querySelectorAll("button"));
        const send = buttons.find((b) => b.textContent === "Send");
        send?.click();

        expect(submitted).toBe("Create a cube");
        document.body.removeChild(panel);
    });

    test("should clear input after submit", () => {
        const panel = new ChatInputPanel();
        document.body.appendChild(panel);

        panel.onSubmit(() => {});
        panel.value = "Test message";

        const buttons = Array.from(panel.querySelectorAll("button"));
        const send = buttons.find((b) => b.textContent === "Send");
        send?.click();

        expect(panel.value).toBe("");
        document.body.removeChild(panel);
    });

    test("should not submit empty text", () => {
        const panel = new ChatInputPanel();
        document.body.appendChild(panel);

        let submitted = false;
        panel.onSubmit(() => {
            submitted = true;
        });

        panel.value = "   ";
        const buttons = Array.from(panel.querySelectorAll("button"));
        const send = buttons.find((b) => b.textContent === "Send");
        send?.click();

        expect(submitted).toBe(false);
        document.body.removeChild(panel);
    });

    test("should disable when disabled=true", () => {
        const panel = new ChatInputPanel();
        document.body.appendChild(panel);

        panel.disabled = true;

        const textarea = panel.querySelector("textarea");
        expect(textarea?.disabled).toBe(true);
        expect(panel.disabled).toBe(true);
        document.body.removeChild(panel);
    });

    test("should not submit when disabled", () => {
        const panel = new ChatInputPanel();
        document.body.appendChild(panel);

        let submitted = false;
        panel.onSubmit(() => {
            submitted = true;
        });

        panel.value = "Test";
        panel.disabled = true;

        const buttons = Array.from(panel.querySelectorAll("button"));
        const send = buttons.find((b) => b.textContent === "Send");
        send?.click();

        expect(submitted).toBe(false);
        document.body.removeChild(panel);
    });
});
