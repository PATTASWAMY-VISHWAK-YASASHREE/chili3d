// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import style from "./chat-input-panel.module.css";

/**
 * Chat input panel with text input and optional file upload.
 * Emits events when the user submits a message or uploads a file.
 */
export class ChatInputPanel extends HTMLElement {
    private _textarea: HTMLTextAreaElement;
    private _sendBtn: HTMLButtonElement;
    private _uploadBtn: HTMLButtonElement;
    private _fileInput: HTMLInputElement;
    private _onSubmit: ((text: string) => void) | undefined;
    private _onUpload: ((file: File) => void) | undefined;
    private _disabled = false;

    constructor() {
        super();
        this.className = style.chatInput;

        this._textarea = document.createElement("textarea");
        this._textarea.className = style.inputField;
        this._textarea.placeholder = "Ask the CAD Copilot...";
        this._textarea.rows = 1;
        this._textarea.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                this.submit();
            }
        });
        this._textarea.addEventListener("input", () => {
            this._textarea.style.height = "auto";
            this._textarea.style.height = `${Math.min(this._textarea.scrollHeight, 120)}px`;
        });

        this._uploadBtn = document.createElement("button");
        this._uploadBtn.className = style.uploadBtn;
        this._uploadBtn.textContent = "📎";
        this._uploadBtn.title = "Upload image or document";
        this._uploadBtn.addEventListener("click", () => this._fileInput.click());

        this._fileInput = document.createElement("input");
        this._fileInput.type = "file";
        this._fileInput.accept = "image/*,.pdf,.step,.iges,.stp,.igs";
        this._fileInput.style.display = "none";
        this._fileInput.addEventListener("change", () => {
            const file = this._fileInput.files?.[0];
            if (file) {
                this._onUpload?.(file);
                this._fileInput.value = "";
            }
        });

        this._sendBtn = document.createElement("button");
        this._sendBtn.className = style.sendBtn;
        this._sendBtn.textContent = "Send";
        this._sendBtn.addEventListener("click", () => this.submit());
    }

    connectedCallback(): void {
        this.appendChild(this._uploadBtn);
        this.appendChild(this._textarea);
        this.appendChild(this._sendBtn);
        this.appendChild(this._fileInput);
    }

    get disabled(): boolean {
        return this._disabled;
    }

    set disabled(value: boolean) {
        this._disabled = value;
        this._textarea.disabled = value;
        this._sendBtn.disabled = value;
        this._uploadBtn.disabled = value;
    }

    get value(): string {
        return this._textarea.value;
    }

    set value(text: string) {
        this._textarea.value = text;
    }

    /**
     * Set handler for when user submits a message.
     */
    onSubmit(callback: (text: string) => void): void {
        this._onSubmit = callback;
    }

    /**
     * Set handler for when user uploads a file.
     */
    onUpload(callback: (file: File) => void): void {
        this._onUpload = callback;
    }

    /**
     * Focus the input field.
     */
    focusInput(): void {
        this._textarea.focus();
    }

    private submit(): void {
        const text = this._textarea.value.trim();
        if (!text || this._disabled) return;
        this._onSubmit?.(text);
        this._textarea.value = "";
        this._textarea.style.height = "auto";
    }
}

customElements.define("copilot-chat-input", ChatInputPanel);
