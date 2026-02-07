// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

/**
 * Per-token pricing for cost estimation.
 * Prices in USD per 1M tokens.
 */
export const MODEL_PRICING: Record<string, { input: number; output: number; cachedInput?: number }> = {
    "gpt-4o": { input: 2.5, output: 10.0, cachedInput: 1.25 },
    "gpt-4o-mini": { input: 0.15, output: 0.6, cachedInput: 0.075 },
    "claude-3.5-sonnet": { input: 3.0, output: 15.0, cachedInput: 0.3 },
    "claude-3.5-haiku": { input: 0.8, output: 4.0, cachedInput: 0.08 },
    "gemini-2.0-flash": { input: 0.1, output: 0.4 },
    "gemini-2.0-pro": { input: 1.25, output: 5.0 },
};

/**
 * Compute the cost of a request given token counts and model name.
 * Returns USD amount.
 */
export function computeCost(
    modelName: string,
    promptTokens: number,
    completionTokens: number,
    cachedTokens = 0,
): number {
    const pricing = MODEL_PRICING[modelName];
    if (!pricing) {
        return 0;
    }

    const inputCost = ((promptTokens - cachedTokens) / 1_000_000) * pricing.input;
    const cachedCost = pricing.cachedInput ? (cachedTokens / 1_000_000) * pricing.cachedInput : 0;
    const outputCost = (completionTokens / 1_000_000) * pricing.output;

    return inputCost + cachedCost + outputCost;
}
