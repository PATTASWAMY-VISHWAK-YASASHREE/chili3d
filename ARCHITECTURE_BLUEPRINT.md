# Chili3D — CAD Copilot Architecture Blueprint

> **Status**: Draft — Awaiting Review  
> **Branch**: `infra/architecture-blueprint`  
> **Author**: Architecture Agent  
> **Date**: 2026-02-07

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Existing Architecture Analysis](#2-existing-architecture-analysis)
3. [System 1 — The "Multi-Brain" Orchestrator](#3-system-1--the-multi-brain-orchestrator)
4. [System 2 — The "Planner-Executor" Workflow](#4-system-2--the-planner-executor-workflow)
5. [System 3 — RAG & Context Management](#5-system-3--rag--context-management)
6. [System 4 — Multimodal Inputs](#6-system-4--multimodal-inputs)
7. [Cross-Cutting Concerns](#7-cross-cutting-concerns)
8. [Phased Implementation Checklist](#8-phased-implementation-checklist)

---

## 1. Executive Summary

This blueprint defines the architecture for transforming Chili3D into a **CAD Copilot** — an agentic 3D modeling IDE where AI agents assist the user in creating, modifying, and reasoning about 3D geometry. The design integrates with the existing monorepo without disrupting the current rendering pipeline (`chili-three`), geometry engine (`chili-wasm` / OpenCascade), or state management (`chili-core` Observable + History).

**Core Principle**: The AI layer is a **new service** (`IService`) that plugs into the existing `IApplication` lifecycle. It issues standard `ICommand` objects, ensuring every AI-generated action flows through the existing undo/redo history and transaction system.

### New Packages Introduced

| Package | Purpose |
|---------|---------|
| `chili-copilot` | Core AI orchestration — provider abstraction, planner, executor |
| `chili-copilot-ui` | UI panels — reasoning trace, plan approval, resource HUD |
| `chili-copilot-rag` | RAG pipeline — embeddings, vector store, context assembly |

---

## 2. Existing Architecture Analysis

### 2.1 Geometry Engine

- **OpenCascade (OCCT)** compiled to WebAssembly via Emscripten (`cpp/` directory)
- Exposed through `IShapeFactory` (factory pattern) with operations: extrude, revolve, sweep, loft, boolean ops, fillet, chamfer, section, split
- Shape hierarchy: `IShape` → `ShapeType` enum (`COMPOUND`, `SOLID`, `SHELL`, `FACE`, `WIRE`, `EDGE`, `VERTEX`)
- Mesh generation via `IShapeMeshData` (`Float32Array` positions/normals, `Uint32Array` indices)

### 2.2 Rendering Pipeline

- **Abstract layer** (`chili-vis`): `IVisual`, `IView`, `ICameraController`, `IHighlighter`
- **Concrete layer** (`chili-three`): Three.js implementation with BVH-accelerated raycasting, `OutlinePass` highlighting, solid/wireframe/combined view modes
- Visual state management via bitfield enum (`VisualState`)

### 2.3 State Management

- `Observable` base class with `setProperty` / `getPrivateValue` pattern for reactive property changes
- `History` with configurable undo limits (default 50), supports grouped `Transaction` records
- `ObservableCollection` for reactive lists (materials, views, acts)
- `IDocument` owns `History`, `IVisual`, `ISelection`, and `ModelManager`

### 2.4 Command System

- `ICommand.execute(app)` pattern with decorator-based metadata (`@command`)
- `CancelableCommand` extends `Observable` with async controller for user cancellation
- Commands are the **sole mutation path** — all model changes go through commands → transactions → history

### 2.5 UI Framework

- Custom elements (`HTMLElement` subclasses) with CSS Modules
- Ribbon toolbar, property panel, project tree, viewport container, statusbar, toast notifications
- `IApplication.mainWindow` provides layout access

### 2.6 Integration Points for AI

The AI system will integrate through:

1. **`IService`** — register/start/stop lifecycle hooks on `IApplication`
2. **`ICommand`** — AI generates and executes standard commands (full undo/redo support)
3. **`Transaction`** — AI batches multi-step operations into atomic undo groups
4. **`IDocument.modelManager`** — AI reads the scene graph for context
5. **`IVisual` / `IView`** — AI can query viewport state and camera
6. **UI custom elements** — New panels plug into the existing editor layout

---

## 3. System 1 — The "Multi-Brain" Orchestrator

### 3.1 Model Agnostic Layer

#### 3.1.1 Provider Interface

```typescript
// packages/chili-copilot/src/provider.ts

/**
 * Unified interface for all LLM providers.
 * Each provider adapter implements this contract.
 */
interface ILLMProvider extends IDisposable {
    readonly id: string;              // "openai" | "anthropic" | "google"
    readonly displayName: string;     // "GPT-4o" | "Claude 3.5 Sonnet" | "Gemini 2.0"
    readonly capabilities: LLMCapabilities;

    chat(request: ChatRequest): AsyncIterable<ChatChunk>;
    embedText(texts: string[]): Promise<Float32Array[]>;
}

interface LLMCapabilities {
    supportsVision: boolean;
    supportsStreaming: boolean;
    supportsFunctionCalling: boolean;
    maxContextTokens: number;         // e.g. 128_000 for GPT-4o
    maxOutputTokens: number;
    embeddingDimensions: number;      // e.g. 1536 for text-embedding-3-small
}

interface ChatRequest {
    messages: ChatMessage[];
    tools?: ToolDefinition[];
    temperature?: number;
    maxTokens?: number;
    responseFormat?: "text" | "json";
    signal?: AbortSignal;             // For cancellation
}

interface ChatMessage {
    role: "system" | "user" | "assistant" | "tool";
    content: MessageContent[];        // Supports text + images
    toolCallId?: string;
    name?: string;
}

type MessageContent =
    | { type: "text"; text: string }
    | { type: "image"; data: ArrayBuffer; mimeType: string }
    | { type: "tool_use"; id: string; name: string; input: unknown }
    | { type: "tool_result"; toolUseId: string; content: string };

interface ChatChunk {
    delta: string;                    // Incremental text
    thinking?: string;               // Chain-of-thought content (Claude extended thinking, etc.)
    toolCalls?: ToolCall[];
    usage?: TokenUsage;
    finishReason?: "stop" | "tool_use" | "length" | "content_filter";
}

interface TokenUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cachedTokens?: number;
    costUsd?: number;                 // Computed from per-token pricing
}
```

#### 3.1.2 Provider Registry

```typescript
// packages/chili-copilot/src/provider-registry.ts

/**
 * Manages available LLM providers and allows runtime switching.
 * Implements the Strategy pattern — the active provider can be
 * changed at any time without restarting the application.
 */
interface IProviderRegistry extends IDisposable {
    readonly providers: ReadonlyMap<string, ILLMProvider>;
    activeProvider: ILLMProvider;

    register(provider: ILLMProvider): void;
    unregister(id: string): void;
    setActive(id: string): void;
}
```

#### 3.1.3 Concrete Provider Adapters

Each adapter normalizes vendor-specific APIs into the `ILLMProvider` contract:

| Adapter | SDK / Protocol | Streaming | Vision | Function Calling | Extended Thinking |
|---------|---------------|-----------|--------|-----------------|-------------------|
| `OpenAIProvider` | OpenAI REST API | SSE | ✓ | ✓ (native) | — |
| `AnthropicProvider` | Anthropic Messages API | SSE | ✓ | ✓ (native) | ✓ (`thinking` blocks) |
| `GoogleProvider` | Gemini REST API | SSE | ✓ | ✓ (native) | — |

**Key Adapter Responsibilities**:
- Translate `ChatRequest` → vendor payload
- Parse vendor SSE stream → `AsyncIterable<ChatChunk>`
- Map vendor tool-call format → unified `ToolCall` type
- Compute `costUsd` using per-model pricing tables
- Handle rate limiting with exponential backoff
- Pass `AbortSignal` to `fetch` for user cancellation

#### 3.1.4 Tool Definitions (Function Calling)

The AI uses **function calling** to interact with the CAD engine. Tools are defined declaratively:

```typescript
// packages/chili-copilot/src/tools.ts

interface ToolDefinition {
    name: string;
    description: string;
    parameters: JSONSchema;           // JSON Schema for input validation
}

/**
 * Built-in CAD tools exposed to the LLM.
 * Each tool maps to one or more ICommand executions.
 */
const CAD_TOOLS: ToolDefinition[] = [
    {
        name: "create_sketch",
        description: "Create a 2D sketch on a plane (XY, XZ, YZ, or custom).",
        parameters: {
            type: "object",
            properties: {
                plane: { type: "string", enum: ["XY", "XZ", "YZ", "custom"] },
                origin: { type: "array", items: { type: "number" }, minItems: 3, maxItems: 3 },
                shapes: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            type: { type: "string", enum: ["line", "arc", "circle", "rect", "spline"] },
                            params: { type: "object" }
                        }
                    }
                }
            },
            required: ["plane", "shapes"]
        }
    },
    {
        name: "extrude",
        description: "Extrude a face or wire along a direction vector.",
        parameters: {
            type: "object",
            properties: {
                targetNodeId: { type: "string" },
                direction: { type: "array", items: { type: "number" }, minItems: 3 },
                distance: { type: "number" }
            },
            required: ["targetNodeId", "direction", "distance"]
        }
    },
    {
        name: "boolean_operation",
        description: "Perform a boolean operation (union, difference, intersection) between two solids.",
        parameters: {
            type: "object",
            properties: {
                operation: { type: "string", enum: ["union", "difference", "intersection"] },
                bodyA: { type: "string" },
                bodyB: { type: "string" }
            },
            required: ["operation", "bodyA", "bodyB"]
        }
    },
    {
        name: "set_material",
        description: "Apply a material to a node by name or create a new material.",
        parameters: {
            type: "object",
            properties: {
                nodeId: { type: "string" },
                materialName: { type: "string" },
                color: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" }
            },
            required: ["nodeId"]
        }
    },
    {
        name: "query_scene",
        description: "Query the current scene graph for nodes, dimensions, and relationships.",
        parameters: {
            type: "object",
            properties: {
                query: { type: "string", enum: ["list_nodes", "get_bounds", "get_node_info"] },
                nodeId: { type: "string" }
            },
            required: ["query"]
        }
    }
];
```

### 3.2 Reasoning Trace — Chain-of-Thought UI Panel

#### 3.2.1 Data Model

```typescript
// packages/chili-copilot/src/reasoning.ts

interface ReasoningTrace extends Observable {
    readonly id: string;
    readonly timestamp: number;
    readonly entries: ObservableCollection<ReasoningEntry>;
    status: "thinking" | "planning" | "executing" | "complete" | "error";
}

type ReasoningEntry =
    | { type: "thinking"; content: string; latex?: string }
    | { type: "math"; expression: string; result: string }
    | { type: "tool_call"; toolName: string; input: unknown; output?: unknown; status: "pending" | "success" | "error" }
    | { type: "plan_step"; index: number; label: string; status: "pending" | "active" | "done" | "skipped" }
    | { type: "code"; language: string; code: string }
    | { type: "message"; role: "assistant"; content: string };
```

#### 3.2.2 UI Architecture

The reasoning panel is a **custom element** that plugs into the existing `Editor` layout as a collapsible sidebar panel:

```
┌──────────────────────────────────────────────────────┐
│  Ribbon Toolbar                                      │
├──────────┬───────────────────────────┬───────────────┤
│ Project  │                           │  Reasoning    │
│ Tree     │      3D Viewport          │  Trace Panel  │
│          │                           │               │
│          │                           │ ┌───────────┐ │
│          │                           │ │ 💭 Think  │ │
│          │                           │ │ Calculating│ │
│          │                           │ │ normal...  │ │
│          │                           │ ├───────────┤ │
│          │                           │ │ 📐 Math   │ │
│          │                           │ │ n̂ = v₁×v₂ │ │
│          │                           │ ├───────────┤ │
│          │                           │ │ 🔧 Tool   │ │
│          │                           │ │ extrude() │ │
│          │                           │ │ ✓ success │ │
│          │                           │ └───────────┘ │
├──────────┴───────────────────────────┴───────────────┤
│  Statusbar  │  Resource HUD: Tokens: 12k/128k  $0.03│
└──────────────────────────────────────────────────────┘
```

**Rendering Strategy**:
- `<thinking>` blocks render in a muted italic style with a pulsing indicator while streaming
- Mathematical expressions render with KaTeX (lightweight LaTeX renderer for the browser)
- Tool calls render as expandable cards showing input JSON → output JSON
- Code blocks render with syntax highlighting
- Plan steps render as a checklist with status icons
- The panel auto-scrolls during streaming but stops if the user scrolls up

#### 3.2.3 Streaming Integration

```typescript
// packages/chili-copilot/src/reasoning-stream.ts

/**
 * Processes the ChatChunk stream and routes content
 * to the appropriate ReasoningEntry in the trace.
 */
class ReasoningStreamProcessor {
    constructor(
        private readonly trace: ReasoningTrace,
        private readonly toolExecutor: ToolExecutor,
    ) {}

    async processStream(stream: AsyncIterable<ChatChunk>): Promise<void> {
        let currentThinking: ReasoningEntry | undefined;

        for await (const chunk of stream) {
            // Route thinking content to a "thinking" entry
            if (chunk.thinking) {
                if (!currentThinking) {
                    currentThinking = { type: "thinking", content: "" };
                    this.trace.entries.add(currentThinking);
                }
                currentThinking.content += chunk.thinking;
                // Parse inline LaTeX: $...$
                currentThinking.latex = extractLatex(currentThinking.content);
            }

            // Route main delta to the assistant message entry
            if (chunk.delta) {
                this.appendAssistantDelta(chunk.delta);
            }

            // Handle tool calls — execute and feed result back
            if (chunk.toolCalls) {
                for (const call of chunk.toolCalls) {
                    await this.executeToolCall(call);
                }
            }

            // Update resource HUD with token usage
            if (chunk.usage) {
                this.updateUsageMetrics(chunk.usage);
            }
        }
    }
}
```

---

## 4. System 2 — The "Planner-Executor" Workflow

### 4.1 Protocol Overview

The workflow follows a strict **5-stage pipeline** with human approval gates:

```
┌─────────┐    ┌──────────────┐    ┌──────────┐    ┌──────────┐    ┌───────────┐
│  Intent  │───▶│ Clarification│───▶│ The Plan │───▶│ Approval │───▶│ Execution │
│ Analysis │    │   (Agent)    │    │ (Agent)  │    │  (User)  │    │  (Agent)  │
└─────────┘    └──────────────┘    └──────────┘    └──────────┘    └───────────┘
     │               │                  │                │               │
  "Make a        "Sci-fi style?      Checklist:      [Approve] /     Execute each
   gun"          Dimensions?         ☐ Barrel         [Edit] /       step as ICommand
                 Low-poly?"          ☐ Grip           [Reject]       within Transaction
                                     ☐ Trigger
                                     ☐ Assembly
```

### 4.2 State Machine

```typescript
// packages/chili-copilot/src/planner.ts

type WorkflowState =
    | { phase: "idle" }
    | { phase: "analyzing"; userPrompt: string }
    | { phase: "clarifying"; questions: ClarificationQuestion[]; answers: Map<string, string> }
    | { phase: "planning"; plan: Plan }
    | { phase: "awaiting_approval"; plan: Plan }
    | { phase: "executing"; plan: Plan; currentStepIndex: number }
    | { phase: "completed"; plan: Plan; results: StepResult[] }
    | { phase: "error"; error: string; recoverable: boolean };

interface ClarificationQuestion {
    id: string;
    question: string;
    type: "text" | "choice" | "number" | "boolean";
    options?: string[];              // For "choice" type
    default?: string;
    required: boolean;
}

interface Plan {
    id: string;
    title: string;
    description: string;
    constraints: Record<string, string>;  // User-provided constraints
    steps: PlanStep[];
    estimatedTokens: number;
    estimatedCostUsd: number;
}

interface PlanStep {
    index: number;
    label: string;                   // "Create barrel cylinder"
    description: string;             // Detailed description for the LLM
    dependsOn: number[];             // Indices of prerequisite steps
    toolHints: string[];             // Suggested CAD tools
    status: "pending" | "active" | "done" | "failed" | "skipped";
}

type StepResult = {
    stepIndex: number;
    status: "success" | "failure";
    nodeIds?: string[];              // IDs of created/modified nodes
    error?: string;
};
```

### 4.3 Planner Agent

```typescript
// packages/chili-copilot/src/planner-agent.ts

/**
 * The Planner is a specialized LLM call with a system prompt
 * that constrains output to structured JSON plans.
 */
class PlannerAgent {
    constructor(
        private readonly provider: ILLMProvider,
        private readonly sceneContext: SceneContextProvider,
    ) {}

    /**
     * Stage 1: Analyze user intent and determine if clarification is needed.
     */
    async analyzeIntent(prompt: string): Promise<
        | { needsClarification: true; questions: ClarificationQuestion[] }
        | { needsClarification: false; plan: Plan }
    > {
        const systemPrompt = PLANNER_SYSTEM_PROMPT;
        const sceneSnapshot = await this.sceneContext.getSnapshot();

        const response = await this.provider.chat({
            messages: [
                { role: "system", content: [{ type: "text", text: systemPrompt }] },
                {
                    role: "user",
                    content: [
                        { type: "text", text: `Scene context:\n${sceneSnapshot}` },
                        { type: "text", text: `User request: ${prompt}` },
                    ],
                },
            ],
            responseFormat: "json",
            temperature: 0.2,        // Low temperature for structured output
        });

        // Parse and validate the structured response
        return this.parseIntentResponse(response);
    }

    /**
     * Stage 2: Generate a detailed plan given user constraints.
     */
    async generatePlan(
        prompt: string,
        constraints: Record<string, string>,
    ): Promise<Plan> {
        // ... builds a plan with ordered steps and dependency graph
    }
}
```

### 4.4 Executor Agent

```typescript
// packages/chili-copilot/src/executor-agent.ts

/**
 * The Executor takes an approved Plan and executes each step
 * by making tool calls through the LLM, which are then
 * translated into ICommand executions.
 *
 * All steps within a single plan are wrapped in a Transaction,
 * so the entire plan can be undone with a single Ctrl+Z.
 */
class ExecutorAgent {
    constructor(
        private readonly provider: ILLMProvider,
        private readonly toolExecutor: ToolExecutor,
        private readonly document: IDocument,
    ) {}

    async executePlan(
        plan: Plan,
        trace: ReasoningTrace,
        signal: AbortSignal,
    ): Promise<StepResult[]> {
        const results: StepResult[] = [];

        // Wrap the entire plan in a single Transaction for atomic undo
        const transaction = new Transaction(
            this.document,
            `AI Plan: ${plan.title}`,
        );

        try {
            for (const step of this.topologicalSort(plan.steps)) {
                if (signal.aborted) break;

                step.status = "active";
                trace.entries.add({
                    type: "plan_step",
                    index: step.index,
                    label: step.label,
                    status: "active",
                });

                const result = await this.executeStep(step, plan, results, trace);
                results.push(result);

                step.status = result.status === "success" ? "done" : "failed";

                if (result.status === "failure") {
                    // Attempt recovery: retry once with error context
                    const retryResult = await this.retryStep(step, result.error!, trace);
                    if (retryResult.status === "failure") {
                        // Skip dependent steps
                        this.skipDependents(step.index, plan.steps);
                        break;
                    }
                }
            }

            transaction.commit();
        } catch (error) {
            transaction.rollback();
            throw error;
        }

        return results;
    }

    /**
     * Topological sort ensures steps execute in dependency order.
     */
    private topologicalSort(steps: PlanStep[]): PlanStep[] {
        // Kahn's algorithm on the step dependency graph
        // ...
    }
}
```

### 4.5 Tool Executor — Bridge to the CAD Engine

```typescript
// packages/chili-copilot/src/tool-executor.ts

/**
 * Translates LLM tool calls into ICommand executions.
 * This is the critical bridge between AI output and the CAD engine.
 */
class ToolExecutor {
    constructor(
        private readonly app: IApplication,
        private readonly document: IDocument,
    ) {}

    async execute(toolCall: ToolCall): Promise<ToolResult> {
        const handler = this.handlers.get(toolCall.name);
        if (!handler) {
            return { success: false, error: `Unknown tool: ${toolCall.name}` };
        }

        // Validate input against JSON Schema
        const validation = validateSchema(toolCall.input, handler.schema);
        if (!validation.valid) {
            return { success: false, error: validation.errors.join(", ") };
        }

        try {
            const result = await handler.execute(toolCall.input);
            return { success: true, data: result };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    /**
     * Example handler: translates "extrude" tool call into
     * an ICommand that uses IShapeFactory.extrude()
     */
    private readonly handlers = new Map<string, ToolHandler>([
        ["extrude", {
            schema: CAD_TOOLS.find(t => t.name === "extrude")!.parameters,
            execute: async (input: { targetNodeId: string; direction: number[]; distance: number }) => {
                const node = this.document.modelManager.getNode(input.targetNodeId);
                const shape = this.app.shapeFactory.extrude(
                    node.shape,
                    { x: input.direction[0], y: input.direction[1], z: input.direction[2] },
                    input.distance,
                );
                // ... add result to document via standard command flow
                return { nodeId: shape.id };
            }
        }],
        // ... other handlers
    ]);
}
```

### 4.6 Approval UI

```typescript
// packages/chili-copilot-ui/src/plan-approval.ts

/**
 * Custom element that renders the plan for user review.
 * Provides Approve / Edit / Reject actions.
 */
class PlanApprovalPanel extends HTMLElement {
    // Renders:
    // ┌─────────────────────────────────────┐
    // │ 📋 Plan: Sci-fi Pistol             │
    // │                                     │
    // │ Constraints:                        │
    // │   Style: Sci-fi                     │
    // │   Poly:  Mid-poly (~5k tris)        │
    // │   Size:  30cm × 15cm × 5cm          │
    // │                                     │
    // │ Steps:                              │
    // │   1. ☐ Create barrel (cylinder)     │
    // │   2. ☐ Create grip (box + taper)    │
    // │   3. ☐ Create trigger (extruded     │
    // │        spline)                      │
    // │   4. ☐ Boolean union all parts      │
    // │   5. ☐ Apply sci-fi material        │
    // │                                     │
    // │ Est. tokens: ~8,200  Cost: ~$0.02   │
    // │                                     │
    // │ [✓ Approve]  [✏ Edit]  [✗ Reject]  │
    // └─────────────────────────────────────┘
    //
    // "Edit" opens an inline text editor where the user can
    // add/remove/reorder steps before approval.
}
```

---

## 5. System 3 — RAG & Context Management

### 5.1 Context Strategy

#### 5.1.1 Local Vector Database

The RAG system uses an **in-browser vector database** to avoid external dependencies. Embeddings are computed via the active LLM provider's `embedText()` method.

```typescript
// packages/chili-copilot-rag/src/vector-store.ts

/**
 * In-browser vector store using IndexedDB for persistence
 * and brute-force cosine similarity for search.
 *
 * For project-scale datasets (hundreds to low thousands of chunks),
 * brute-force search is faster than HNSW due to lower overhead.
 */
interface IVectorStore extends IDisposable {
    readonly name: string;
    readonly dimensions: number;
    readonly count: number;

    upsert(documents: VectorDocument[]): Promise<void>;
    remove(ids: string[]): Promise<void>;
    search(query: Float32Array, topK: number, filter?: MetadataFilter): Promise<SearchResult[]>;
    clear(): Promise<void>;
}

interface VectorDocument {
    id: string;
    embedding: Float32Array;
    content: string;                  // Original text chunk
    metadata: DocumentMetadata;
}

interface DocumentMetadata {
    source: "scene_node" | "user_doc" | "api_doc" | "conversation";
    nodeId?: string;                  // For scene_node sources
    filePath?: string;                // For uploaded documents
    chunkIndex?: number;
    timestamp: number;
}

interface SearchResult {
    document: VectorDocument;
    score: number;                    // Cosine similarity [0, 1]
}

type MetadataFilter = {
    source?: DocumentMetadata["source"];
    nodeId?: string;
};
```

#### 5.1.2 Storage Backend — IndexedDB

```typescript
// packages/chili-copilot-rag/src/indexeddb-store.ts

/**
 * IndexedDB-backed vector store.
 *
 * Schema:
 *   Object Store: "vectors"
 *     Key: id (string)
 *     Value: { embedding: ArrayBuffer, content: string, metadata: object }
 *     Indexes: source, nodeId, timestamp
 *
 * Embeddings are stored as raw ArrayBuffer for zero-copy access.
 * Cosine similarity is computed in a Web Worker to avoid blocking the UI.
 */
class IndexedDBVectorStore implements IVectorStore {
    private db: IDBDatabase;
    private worker: Worker;          // Similarity computation off main thread

    async search(query: Float32Array, topK: number): Promise<SearchResult[]> {
        // 1. Load all embeddings into the worker (cached after first load)
        // 2. Compute cosine similarity in parallel using SIMD if available
        // 3. Partial sort (selection algorithm) for top-K
        // 4. Return results with content and metadata
    }
}
```

#### 5.1.3 Indexing Pipeline

```typescript
// packages/chili-copilot-rag/src/indexing-pipeline.ts

/**
 * Indexes different content sources into the vector store.
 */
class IndexingPipeline {
    constructor(
        private readonly store: IVectorStore,
        private readonly provider: ILLMProvider,
    ) {}

    /**
     * Index the current scene graph.
     * Called on document open and after each command execution.
     */
    async indexScene(document: IDocument): Promise<void> {
        const nodes = this.flattenSceneGraph(document.modelManager.rootNode);
        const chunks = nodes.map(node => ({
            id: `scene:${node.id}`,
            content: this.serializeNode(node),
            metadata: { source: "scene_node" as const, nodeId: node.id, timestamp: Date.now() }
        }));

        const embeddings = await this.provider.embedText(chunks.map(c => c.content));
        const documents = chunks.map((chunk, i) => ({
            ...chunk,
            embedding: embeddings[i],
        }));

        await this.store.upsert(documents);
    }

    /**
     * Index an uploaded document (PDF, text, markdown).
     */
    async indexUserDocument(file: File): Promise<void> {
        const text = await this.extractText(file);
        const chunks = this.chunkText(text, { maxTokens: 512, overlap: 64 });
        // ... embed and store
    }

    /**
     * Chunk text using token-aware splitting.
     * Respects sentence and paragraph boundaries.
     */
    private chunkText(text: string, options: { maxTokens: number; overlap: number }): string[] {
        // Split on paragraph boundaries first, then sentence boundaries
        // Merge small chunks, split large chunks
        // Overlap for context continuity
    }
}
```

#### 5.1.4 Context Assembly

```typescript
// packages/chili-copilot-rag/src/context-assembler.ts

/**
 * Assembles the optimal context window for each LLM call.
 * Uses a priority-based strategy to maximize relevance
 * within the token budget.
 */
class ContextAssembler {
    constructor(
        private readonly vectorStore: IVectorStore,
        private readonly provider: ILLMProvider,
    ) {}

    /**
     * Build the context for a user query.
     * Priority order:
     *   1. System prompt (fixed, ~500 tokens)
     *   2. Active scene context (node tree, ~200-2000 tokens)
     *   3. RAG results (top-K relevant chunks, ~1000-4000 tokens)
     *   4. Conversation history (sliding window, remaining budget)
     */
    async buildContext(
        query: string,
        conversationHistory: ChatMessage[],
        sceneContext: string,
        tokenBudget: number,
    ): Promise<ChatMessage[]> {
        const messages: ChatMessage[] = [];
        let usedTokens = 0;

        // 1. System prompt
        const systemPrompt = this.buildSystemPrompt();
        usedTokens += estimateTokens(systemPrompt);
        messages.push({ role: "system", content: [{ type: "text", text: systemPrompt }] });

        // 2. Scene context (always included)
        usedTokens += estimateTokens(sceneContext);

        // 3. RAG retrieval
        const queryEmbedding = (await this.provider.embedText([query]))[0];
        const ragBudget = Math.min(4000, Math.floor((tokenBudget - usedTokens) * 0.4));
        const ragResults = await this.vectorStore.search(queryEmbedding, 10);
        const ragContext = this.selectChunks(ragResults, ragBudget);
        usedTokens += estimateTokens(ragContext);

        // 4. Conversation history (sliding window from most recent)
        const historyBudget = tokenBudget - usedTokens - estimateTokens(query) - 500; // 500 for response
        const history = this.truncateHistory(conversationHistory, historyBudget);

        messages.push(...history);
        messages.push({
            role: "user",
            content: [
                { type: "text", text: `Scene:\n${sceneContext}\n\nRelevant context:\n${ragContext}` },
                { type: "text", text: query },
            ],
        });

        return messages;
    }
}
```

### 5.2 Resource HUD — Token & Cost Tracking

#### 5.2.1 Data Structure

```typescript
// packages/chili-copilot/src/resource-hud.ts

/**
 * Real-time resource tracking for the HUD display.
 * Extends Observable so UI components can react to changes.
 */
class ResourceTracker extends Observable {
    // Session-level metrics
    sessionPromptTokens: number = 0;
    sessionCompletionTokens: number = 0;
    sessionCachedTokens: number = 0;
    sessionCostUsd: number = 0;
    sessionStartTime: number = Date.now();

    // Current request metrics
    currentRequestTokens: number = 0;

    // Provider info
    activeModelName: string = "";
    maxContextTokens: number = 0;

    // Computed properties
    get totalTokens(): number {
        return this.sessionPromptTokens + this.sessionCompletionTokens;
    }

    get contextUtilizationPercent(): number {
        return (this.currentRequestTokens / this.maxContextTokens) * 100;
    }

    get contextUtilizationLabel(): string {
        return `${this.formatTokens(this.currentRequestTokens)}/${this.formatTokens(this.maxContextTokens)}`;
    }

    /**
     * Called after each LLM response with token usage data.
     */
    recordUsage(usage: TokenUsage): void {
        this.setProperty("sessionPromptTokens", this.sessionPromptTokens + usage.promptTokens);
        this.setProperty("sessionCompletionTokens", this.sessionCompletionTokens + usage.completionTokens);
        if (usage.cachedTokens) {
            this.setProperty("sessionCachedTokens", this.sessionCachedTokens + usage.cachedTokens);
        }
        if (usage.costUsd) {
            this.setProperty("sessionCostUsd", this.sessionCostUsd + usage.costUsd);
        }
    }

    private formatTokens(n: number): string {
        if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
        if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
        return String(n);
    }
}
```

#### 5.2.2 HUD UI Component

```
┌──────────────────────────────────────────────────────┐
│ 🤖 GPT-4o  │  📊 Tokens: 12.4k/128k (9.7%)  │  💰 $0.03  │  ⏱ 2m 14s │
└──────────────────────────────────────────────────────┘

Breakdown (tooltip on hover):
  Prompt:     8,200 tokens
  Completion: 4,200 tokens
  Cached:     1,500 tokens (saved $0.004)
  Context:    ██░░░░░░░░ 9.7%
```

#### 5.2.3 Pricing Tables

```typescript
// packages/chili-copilot/src/pricing.ts

/**
 * Per-token pricing for cost estimation.
 * Prices in USD per 1M tokens.
 */
const MODEL_PRICING: Record<string, { input: number; output: number; cachedInput?: number }> = {
    "gpt-4o":                   { input: 2.50,  output: 10.00, cachedInput: 1.25 },
    "gpt-4o-mini":              { input: 0.15,  output: 0.60,  cachedInput: 0.075 },
    "claude-3.5-sonnet":        { input: 3.00,  output: 15.00, cachedInput: 0.30 },
    "claude-3.5-haiku":         { input: 0.80,  output: 4.00,  cachedInput: 0.08 },
    "gemini-2.0-flash":         { input: 0.10,  output: 0.40 },
    "gemini-2.0-pro":           { input: 1.25,  output: 5.00 },
};
```

---

## 6. System 4 — Multimodal Inputs

### 6.1 Pipeline Overview

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐     ┌──────────────┐
│  User Upload │────▶│  Preprocessor│────▶│  LLM Vision   │────▶│  Constraint  │
│  (Image/PDF) │     │  (normalize) │     │  Analysis      │     │  Extractor   │
└─────────────┘     └──────────────┘     └───────────────┘     └──────────────┘
                                                                       │
                                                                       ▼
                                                              ┌──────────────┐
                                                              │  Planner     │
                                                              │  (with       │
                                                              │  constraints)│
                                                              └──────────────┘
```

### 6.2 Preprocessor

```typescript
// packages/chili-copilot/src/multimodal/preprocessor.ts

/**
 * Normalizes uploaded files into a format suitable for LLM vision APIs.
 */
class MultimodalPreprocessor {
    /**
     * Supported input types:
     *   - Images: PNG, JPEG, WebP, SVG
     *   - Documents: PDF (rendered to images per page)
     *   - CAD Formats: STEP, IGES (rendered to viewport screenshot)
     */
    async preprocess(file: File): Promise<PreprocessedInput> {
        const mimeType = file.type;

        if (this.isImage(mimeType)) {
            return this.preprocessImage(file);
        }
        if (mimeType === "application/pdf") {
            return this.preprocessPDF(file);
        }
        if (this.isCADFormat(file.name)) {
            return this.preprocessCAD(file);
        }

        throw new Error(`Unsupported file type: ${mimeType}`);
    }

    /**
     * Images: Resize to max 2048px on longest side (LLM API limits),
     * convert to PNG, extract EXIF data if available.
     */
    private async preprocessImage(file: File): Promise<PreprocessedInput> {
        const bitmap = await createImageBitmap(file);
        const canvas = new OffscreenCanvas(
            Math.min(bitmap.width, 2048),
            Math.min(bitmap.height, 2048),
        );
        // ... resize and convert to PNG ArrayBuffer
        return {
            type: "image",
            images: [{ data: pngBuffer, mimeType: "image/png", width, height }],
            originalFileName: file.name,
        };
    }

    /**
     * PDFs: Render each page to an image using pdf.js.
     * Each page becomes a separate image for multi-turn analysis.
     */
    private async preprocessPDF(file: File): Promise<PreprocessedInput> {
        // Use pdf.js to render pages to canvas
        // Convert each canvas to PNG
        // Return array of page images
    }
}

interface PreprocessedInput {
    type: "image" | "pdf" | "cad";
    images: ImageData[];
    originalFileName: string;
    pageCount?: number;
}

interface ImageData {
    data: ArrayBuffer;
    mimeType: string;
    width: number;
    height: number;
    pageNumber?: number;
}
```

### 6.3 Vision Analysis — Geometric Constraint Extraction

```typescript
// packages/chili-copilot/src/multimodal/constraint-extractor.ts

/**
 * Uses the LLM's vision capabilities to extract geometric
 * constraints from images/blueprints.
 */
class ConstraintExtractor {
    constructor(private readonly provider: ILLMProvider) {}

    /**
     * Analyze an image and extract geometric constraints.
     *
     * The system prompt instructs the LLM to identify:
     *   - Overall shape classification (prismatic, cylindrical, organic, etc.)
     *   - Dimensional constraints (lengths, radii, angles)
     *   - Spatial relationships (parallel, perpendicular, concentric, tangent)
     *   - View interpretation (front, side, top, isometric)
     *   - Annotations and dimensions from technical drawings
     */
    async extractConstraints(input: PreprocessedInput): Promise<GeometricConstraints> {
        const messages: ChatMessage[] = [
            {
                role: "system",
                content: [{
                    type: "text",
                    text: VISION_ANALYSIS_SYSTEM_PROMPT,
                }],
            },
            {
                role: "user",
                content: [
                    ...input.images.map(img => ({
                        type: "image" as const,
                        data: img.data,
                        mimeType: img.mimeType,
                    })),
                    {
                        type: "text",
                        text: "Analyze this image/blueprint and extract all geometric constraints. "
                            + "Output structured JSON with dimensions, relationships, and view type.",
                    },
                ],
            },
        ];

        const response = await collectStream(this.provider.chat({
            messages,
            responseFormat: "json",
            temperature: 0.1,
        }));

        return this.parseConstraints(response);
    }
}

/**
 * Structured output from vision analysis.
 */
interface GeometricConstraints {
    viewType: "front" | "side" | "top" | "isometric" | "perspective" | "unknown";
    overallShape: string;            // "rectangular prism with cylindrical bore"
    dimensions: Dimension[];
    relationships: SpatialRelationship[];
    annotations: Annotation[];
    confidence: number;              // 0-1, how confident the LLM is
}

interface Dimension {
    feature: string;                 // "barrel length"
    value: number;
    unit: "mm" | "cm" | "m" | "in";
    confidence: number;
}

interface SpatialRelationship {
    featureA: string;
    featureB: string;
    type: "parallel" | "perpendicular" | "concentric" | "tangent" | "offset";
    value?: number;                  // e.g., offset distance
}

interface Annotation {
    text: string;
    position: { x: number; y: number };  // Normalized [0,1] in image space
    type: "dimension" | "note" | "label" | "tolerance";
}
```

### 6.4 Blueprint-to-Plan Pipeline

When the user uploads a blueprint, the pipeline connects to the Planner-Executor workflow:

```
1. User uploads blueprint.png
2. Preprocessor normalizes the image
3. ConstraintExtractor analyzes the image → GeometricConstraints
4. Constraints are injected into the PlannerAgent as additional context:
   "Create a 3D model matching this blueprint.
    Extracted constraints: { barrel_length: 150mm, ... }"
5. PlannerAgent generates a Plan with steps derived from the constraints
6. Normal Planner-Executor workflow continues (approval → execution)
```

---

## 7. Cross-Cutting Concerns

### 7.1 Security

- **API Keys**: Stored in browser `localStorage` with `crypto.subtle` encryption (AES-GCM), keyed by a user-provided passphrase. Never transmitted to the Chili3D server — all LLM calls go directly from the browser to the provider APIs (CORS-enabled endpoints).
- **Input Sanitization**: All LLM outputs are validated against JSON Schema before execution. Tool call inputs are validated before reaching the CAD engine.
- **Content Filtering**: Provider-side content filters are respected. The `finishReason: "content_filter"` is surfaced to the user.

### 7.2 Error Recovery

- **LLM Errors**: Exponential backoff with jitter for rate limits (429). Network errors trigger retry with provider fallback if multiple providers are configured.
- **Tool Execution Errors**: Surfaced in the reasoning trace. The executor retries once with error context appended. If retry fails, dependent steps are skipped and the user is notified.
- **Transaction Rollback**: If execution fails mid-plan, the Transaction rolls back all changes made by completed steps, preserving document integrity.

### 7.3 Performance

- **Streaming**: All LLM calls use streaming to show incremental output in the reasoning panel. No blocking waits for full responses.
- **Web Workers**: Embedding similarity search runs in a Web Worker to avoid UI jank.
- **Debounced Indexing**: Scene graph re-indexing is debounced (500ms) after command execution to avoid excessive embedding API calls.
- **Embedding Cache**: Embeddings for unchanged nodes are cached in IndexedDB and reused.

### 7.4 Integration with Existing Systems

| Existing System | Integration Strategy |
|----------------|---------------------|
| `IService` lifecycle | `CopilotService` implements `IService` — registers on app startup |
| `ICommand` pattern | All AI actions execute standard commands — full undo/redo support |
| `Transaction` | Each plan execution is wrapped in a single transaction |
| `Observable` | `ResourceTracker` and `ReasoningTrace` extend `Observable` for reactive UI |
| `ISelection` | AI can query current selection to understand user intent |
| `IDocument` serialization | AI context (conversation history) serialized alongside document |
| Ribbon UI | New "Copilot" ribbon tab with AI controls |
| CSS Modules | New UI components follow existing CSS Module patterns |
| `I18nKeys` | All AI UI strings go through the i18n system |

---

## 8. Phased Implementation Checklist

### Phase 1: Foundation — Model Connection

> **Goal**: Establish the LLM provider layer and basic chat capability.

- [ ] Create `chili-copilot` package with build configuration
- [ ] Define `ILLMProvider` interface and types (`ChatRequest`, `ChatChunk`, `TokenUsage`)
- [ ] Implement `OpenAIProvider` adapter (streaming, function calling, vision)
- [ ] Implement `AnthropicProvider` adapter (streaming, extended thinking, vision)
- [ ] Implement `GoogleProvider` adapter (streaming, function calling, vision)
- [ ] Implement `IProviderRegistry` with runtime provider switching
- [ ] Implement `CopilotService` (`IService`) for application lifecycle integration
- [ ] Define `CAD_TOOLS` tool definitions (JSON Schema for each CAD operation)
- [ ] Implement `ToolExecutor` bridge to `IShapeFactory` / `ICommand`
- [ ] Add API key management with `crypto.subtle` encryption
- [ ] Add model pricing tables and `TokenUsage` cost computation
- [ ] Unit tests for provider adapters (mock HTTP), tool executor, and schema validation

### Phase 2: RAG & Context

> **Goal**: Enable the AI to understand the user's project and documentation.

- [ ] Create `chili-copilot-rag` package
- [ ] Implement `IVectorStore` interface
- [ ] Implement `IndexedDBVectorStore` with Web Worker similarity search
- [ ] Implement `IndexingPipeline` for scene graph serialization and chunking
- [ ] Implement `IndexingPipeline` for user document ingestion (text, markdown)
- [ ] Implement `ContextAssembler` with priority-based token budgeting
- [ ] Add debounced scene re-indexing on command execution
- [ ] Add embedding cache with IndexedDB persistence
- [ ] Implement `SceneContextProvider` (serializes active scene for LLM context)
- [ ] Unit tests for vector store (cosine similarity), chunking, and context assembly

### Phase 3: UI & Reasoning Display

> **Goal**: Build the user-facing AI interface panels.

- [ ] Create `chili-copilot-ui` package
- [ ] Implement `ReasoningTracePanel` custom element
  - [ ] Render `<thinking>` blocks with streaming animation
  - [ ] Render mathematical expressions with KaTeX
  - [ ] Render tool call cards (expandable, input/output)
  - [ ] Render plan step checklist with status icons
  - [ ] Auto-scroll with user-override detection
- [ ] Implement `ResourceHUD` component in statusbar
  - [ ] Token usage bar with context utilization percentage
  - [ ] Cost display with session total
  - [ ] Active model indicator with provider switch dropdown
- [ ] Implement `PlanApprovalPanel` custom element
  - [ ] Render plan steps as editable checklist
  - [ ] Approve / Edit / Reject actions
  - [ ] Token and cost estimates
- [ ] Implement `ClarificationDialog` for constraint gathering
- [ ] Add "Copilot" ribbon tab with AI controls
- [ ] Implement chat input panel with multimodal upload button
- [ ] CSS Modules for all new components (following existing patterns)
- [ ] Add i18n keys for all AI UI strings
- [ ] Integration tests for panel rendering and user interactions

### Phase 4: Agentic Tools

> **Goal**: Enable the full Planner-Executor workflow with multimodal inputs.

- [ ] Implement `PlannerAgent` — intent analysis and plan generation
- [ ] Implement `ExecutorAgent` — step-by-step plan execution with transaction wrapping
- [ ] Implement `ReasoningStreamProcessor` — routes streamed chunks to trace entries
- [ ] Implement workflow state machine (`WorkflowState` transitions)
- [ ] Implement retry/recovery logic (single retry with error context)
- [ ] Implement dependency-aware step execution (topological sort)
- [ ] Implement `MultimodalPreprocessor` (image normalization, PDF rendering)
- [ ] Implement `ConstraintExtractor` (vision-based geometric constraint extraction)
- [ ] Implement blueprint-to-plan pipeline integration
- [ ] End-to-end tests for complete workflows (mock LLM, real CAD engine)
- [ ] Performance benchmarks for RAG search and streaming latency
- [ ] Documentation: developer guide for adding new CAD tools
