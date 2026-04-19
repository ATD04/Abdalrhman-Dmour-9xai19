"use client";

import { useState } from "react";
import { AppProvider, useAppContext } from "@/lib/HackathonContext";
import LandingView from "@/components/LandingView";
import InputForm from "@/components/InputForm";
import DashboardView from "@/components/DashboardView";

function MainApp() {
  const { state, loadSample } = useAppContext();
  const [view, setView] = useState<"landing" | "form" | "dashboard">("landing");

  // If a plan is generated, forces dashboard view
  if (state.plan && !state.isGenerating) {
    return <DashboardView />;
  }

  if (view === "form") {
    return (
      <main className="min-h-screen p-4 md:p-8">
        <InputForm onBack={() => setView("landing")} />
      </main>
    );
  }

  // default Landing
  return (
    <main className="min-h-screen p-4 md:p-8 flex flex-col pt-12 md:pt-24">
      <LandingView 
        onStart={() => setView("form")} 
        onSample={() => loadSample()} 
      />
    </main>
  );
}

export default function Page() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
