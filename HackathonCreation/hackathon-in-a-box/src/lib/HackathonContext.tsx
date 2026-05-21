"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { HackathonInputs, HackathonPlan, OptimizerResult } from "./types";
import { analyzePlan } from "./optimizer";

interface AppState {
  inputs: HackathonInputs | null;
  plan: HackathonPlan | null;
  optimizerResult: OptimizerResult | null;
  isGenerating: boolean;
  isOptimizing: boolean;
  isFixing: boolean;
  showOptimizer: boolean;
  fixDiff: Partial<HackathonPlan> | null;
  generationError: string | null;
}

interface AppContextType {
  state: AppState;
  generatePlan: (inputs: HackathonInputs) => Promise<void>;
  analyzeCurrentPlan: () => Promise<void>;
  applyAutoFix: () => Promise<void>;
  reset: () => void;
  loadSample: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
    inputs: null,
    plan: null,
    optimizerResult: null,
    isGenerating: false,
    isOptimizing: false,
    isFixing: false,
    showOptimizer: false,
    fixDiff: null,
    generationError: null,
  });

  const generatePlan = async (inputs: HackathonInputs) => {
    setState((prev) => ({
      ...prev,
      isGenerating: true,
      optimizerResult: null,
      fixDiff: null,
      showOptimizer: false,
      generationError: null,
    }));

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inputs),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload.attempts?.length
            ? `${payload.error} (${payload.attempts[0]})`
            : payload.error || "Could not generate hackathon plan."
        );
      }

      setState((prev) => ({
        ...prev,
        inputs,
        plan: payload.plan,
        isGenerating: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isGenerating: false,
        generationError: error instanceof Error ? error.message : "Could not generate hackathon plan.",
      }));
    }
  };

  const analyzeCurrentPlan = async () => {
    if (!state.plan || !state.inputs) return;
    setState((prev) => ({ ...prev, isOptimizing: true, showOptimizer: true }));

    await new Promise((res) => setTimeout(res, 1500));

    const result = analyzePlan(state.plan, state.inputs);
    setState((prev) => ({
      ...prev,
      optimizerResult: result,
      isOptimizing: false,
    }));
  };

  const applyAutoFix = async () => {
    if (!state.plan || !state.optimizerResult) return;
    setState((prev) => ({ ...prev, isFixing: true }));

    await new Promise((res) => setTimeout(res, 1000));

    const fixDiff = state.optimizerResult.autoFixPayload;

    setState((prev) => {
      if (!prev.plan) return prev;
      const newPlan = { ...prev.plan, ...fixDiff };
      // Also re-run optimizer to show new score? Or just hide optimizer issues
      const newOptimizerResult = prev.inputs ? analyzePlan(newPlan, prev.inputs) : prev.optimizerResult;

      return {
        ...prev,
        plan: newPlan,
        fixDiff: fixDiff,
        optimizerResult: newOptimizerResult,
        isFixing: false,
      };
    });
  };

  const reset = () => {
    setState({
      inputs: null,
      plan: null,
      optimizerResult: null,
      isGenerating: false,
      isOptimizing: false,
      isFixing: false,
      showOptimizer: false,
      fixDiff: null,
      generationError: null,
    });
  };

  const loadSample = () => {
    generatePlan({
      participants: 50,
      skillLevels: "Mixed",
      duration: 24,
      domain: "Sustainable Future & Green Tech",
      teamSize: 4,
      learningGoals: "Intro to AI, building full-stack MVPs, teamwork",
    });
  };

  return (
    <AppContext.Provider value={{ state, generatePlan, analyzeCurrentPlan, applyAutoFix, reset, loadSample }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
}
