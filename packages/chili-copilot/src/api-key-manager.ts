// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

/**
 * Manages API keys with crypto.subtle encryption (AES-GCM).
 * Keys are stored encrypted in localStorage, keyed by a user-provided passphrase.
 * Never transmitted to the Chili3D server — all LLM calls go directly
 * from the browser to the provider APIs.
 */
export class ApiKeyManager {
    private static readonly STORAGE_PREFIX = "chili3d-copilot-key-";
    private static readonly ALGO = "AES-GCM";

    /**
     * Derive an AES-GCM key from a user passphrase using PBKDF2.
     */
    private static async deriveKey(passphrase: string, salt: ArrayBuffer): Promise<CryptoKey> {
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            "raw",
            encoder.encode(passphrase),
            { name: "PBKDF2" },
            false,
            ["deriveKey"],
        );
        return crypto.subtle.deriveKey(
            { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations: 100_000, hash: "SHA-256" },
            keyMaterial,
            { name: ApiKeyManager.ALGO, length: 256 },
            false,
            ["encrypt", "decrypt"],
        );
    }

    /**
     * Encrypt and store an API key for a given provider.
     */
    static async storeKey(providerId: string, apiKey: string, passphrase: string): Promise<void> {
        const encoder = new TextEncoder();
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await ApiKeyManager.deriveKey(passphrase, salt.buffer);

        const encrypted = await crypto.subtle.encrypt(
            { name: ApiKeyManager.ALGO, iv },
            key,
            encoder.encode(apiKey),
        );

        const stored = {
            salt: Array.from(salt),
            iv: Array.from(iv),
            data: Array.from(new Uint8Array(encrypted)),
        };

        localStorage.setItem(ApiKeyManager.STORAGE_PREFIX + providerId, JSON.stringify(stored));
    }

    /**
     * Retrieve and decrypt an API key for a given provider.
     * Returns null if no key is stored or decryption fails.
     */
    static async retrieveKey(providerId: string, passphrase: string): Promise<string | null> {
        const raw = localStorage.getItem(ApiKeyManager.STORAGE_PREFIX + providerId);
        if (!raw) {
            return null;
        }

        try {
            const stored = JSON.parse(raw) as { salt: number[]; iv: number[]; data: number[] };
            const salt = new Uint8Array(stored.salt);
            const iv = new Uint8Array(stored.iv);
            const data = new Uint8Array(stored.data);
            const key = await ApiKeyManager.deriveKey(passphrase, salt.buffer);

            const decrypted = await crypto.subtle.decrypt({ name: ApiKeyManager.ALGO, iv }, key, data);

            return new TextDecoder().decode(decrypted);
        } catch {
            return null;
        }
    }

    /**
     * Remove a stored API key for a given provider.
     */
    static removeKey(providerId: string): void {
        localStorage.removeItem(ApiKeyManager.STORAGE_PREFIX + providerId);
    }

    /**
     * Check if an API key is stored for a given provider.
     */
    static hasKey(providerId: string): boolean {
        return localStorage.getItem(ApiKeyManager.STORAGE_PREFIX + providerId) !== null;
    }
}
