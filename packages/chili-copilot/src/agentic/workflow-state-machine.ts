// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { ClarificationQuestion, Plan, StepResult, WorkflowState } from "./types";

/**
 * Manages the workflow state transitions for the planner-executor pipeline.
 * Follows a strict 5-stage pipeline with human approval gates.
 */
export class WorkflowStateMachine {
    private _state: WorkflowState = { phase: "idle" };
    private _listeners: Array<(state: WorkflowState) => void> = [];

    get state(): WorkflowState {
        return this._state;
    }

    get phase(): string {
        return this._state.phase;
    }

    /**
     * Subscribe to state changes.
     */
    onStateChange(listener: (state: WorkflowState) => void): () => void {
        this._listeners.push(listener);
        return () => {
            this._listeners = this._listeners.filter((l) => l !== listener);
        };
    }

    /**
     * Transition to analyzing state when user submits a prompt.
     */
    startAnalysis(userPrompt: string): void {
        this.assertPhase("idle");
        this.transition({ phase: "analyzing", userPrompt });
    }

    /**
     * Transition to clarifying state when the planner needs more info.
     */
    requestClarification(questions: ClarificationQuestion[]): void {
        this.assertPhase("analyzing");
        this.transition({
            phase: "clarifying",
            questions,
            answers: new Map(),
        });
    }

    /**
     * Provide an answer to a clarification question.
     */
    answerQuestion(questionId: string, answer: string): void {
        this.assertPhase("clarifying");
        const state = this._state as Extract<WorkflowState, { phase: "clarifying" }>;
        state.answers.set(questionId, answer);
    }

    /**
     * Transition to planning state after clarification is complete.
     */
    startPlanning(plan: Plan): void {
        this.transition({ phase: "planning", plan });
    }

    /**
     * Transition to awaiting approval state.
     */
    awaitApproval(plan: Plan): void {
        this.transition({ phase: "awaiting_approval", plan });
    }

    /**
     * Transition to executing state after user approves.
     */
    startExecution(plan: Plan): void {
        this.assertPhase("awaiting_approval");
        this.transition({ phase: "executing", plan, currentStepIndex: 0 });
    }

    /**
     * Update the current step index during execution.
     */
    advanceStep(stepIndex: number): void {
        this.assertPhase("executing");
        const state = this._state as Extract<WorkflowState, { phase: "executing" }>;
        this.transition({ ...state, currentStepIndex: stepIndex });
    }

    /**
     * Transition to completed state.
     */
    complete(plan: Plan, results: StepResult[]): void {
        this.transition({ phase: "completed", plan, results });
    }

    /**
     * Transition to error state.
     */
    setError(error: string, recoverable: boolean): void {
        this.transition({ phase: "error", error, recoverable });
    }

    /**
     * Reset to idle state.
     */
    reset(): void {
        this.transition({ phase: "idle" });
    }

    private assertPhase(expected: string): void {
        if (this._state.phase !== expected) {
            throw new Error(`Invalid state transition: expected '${expected}', got '${this._state.phase}'`);
        }
    }

    private transition(newState: WorkflowState): void {
        this._state = newState;
        for (const listener of this._listeners) {
            listener(newState);
        }
    }
}
