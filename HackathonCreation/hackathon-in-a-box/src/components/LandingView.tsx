"use client";

import { Box, ArrowRight, Zap, Sparkles } from "lucide-react";
import { Button } from "./ui/Button";

interface Props {
  onStart: () => void;
  onSample: () => void;
}

export default function LandingView({ onStart, onSample }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center animate-in fade-in zoom-in duration-500">
      <div className="bg-indigo-100 p-4 rounded-3xl mb-8 shadow-sm">
        <Box className="w-16 h-16 text-indigo-600" strokeWidth={1.5} />
      </div>
      
      <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 mb-6 max-w-4xl">
        Generate the Perfect Hackathon <br className="hidden md:block" />
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-violet-500">
          in Minutes, not Months.
        </span>
      </h1>
      
      <p className="text-lg md:text-xl text-slate-600 mb-10 max-w-2xl font-medium">
        Enter your constraints and let our intelligent engine build a professional, balanced, and ready-to-run hackathon brief.
      </p>
      
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <Button size="lg" variant="premium" className="w-full sm:w-auto group" onClick={onStart}>
          <Sparkles className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
          Create New Hackathon
        </Button>
        <Button size="lg" variant="secondary" className="w-full sm:w-auto group" onClick={onSample}>
          <Zap className="w-5 h-5 mr-2 text-amber-500 group-hover:scale-110 transition-transform" />
          Load Sample
          <ArrowRight className="w-4 h-4 ml-2 opacity-50 group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>
    </div>
  );
}
