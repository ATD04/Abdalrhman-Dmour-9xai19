export type SkillLevel = "Beginner" | "Intermediate" | "Advanced" | "Mixed";

export interface HackathonInputs {
  participants: number;
  skillLevels: SkillLevel;
  duration: number; // in hours
  domain: string;
  teamSize: number;
  learningGoals: string;
}

export interface Track {
  id: string;
  name: string;
  description: string;
  difficulty: SkillLevel;
}

export interface Idea {
  id: string;
  title: string;
  description: string;
  trackId: string;
}

export interface HackathonPlan {
  name: string;
  theme: string;
  generationId: string;
  // 1. Purpose of This Hackathon
  purpose: string;
  // 2. What Is the Name in This Challenge
  nameMeaning: string;
  // 3. Core Challenge
  coreChallenge: string;
  tracks: Track[];
  ideaPrompts: Idea[];
  rulesGuidelines: string[];
  // 4. Technology Principles Suggested
  techPrinciples: { category: string; recommendations: string }[];
  // 5. Team Format
  teamFormat: {
    totalTeams: number;
    distribution: string;
    logic: string;
    tags: string[];
  };
  // 6. Why This Hackathon Will Leapfrog Your Team Skills
  skillLeapfrog: string;
  // 7. Total Duration
  durationExplanation: string;
  // 8. Pulse Check Timing
  pulseChecks: { time: string; event: string }[];
  timeline: { time: string; event: string }[]; // Keep detailed timeline too
  // 9. Final Submission
  finalSubmission: string[];
  // 10. Evaluation Criteria
  judgingCriteria: { name: string; weight: number; description: string }[];
  // 11. Awards May Include
  awards: string[];
  // 12. Final Standard
  finalStandard: string;
}

export interface OptimizerSubScore {
  metric: string;
  score: number; // out of 100
  feedback: string;
}

export interface SectionReview {
  sectionName: string;
  status: "Strong" | "Acceptable" | "Needs Improvement";
  reason: string;
}

export interface OptimizerDetectedIssue {
  id: string;
  severity: "high" | "medium" | "low";
  whatIsWrong: string;
  whyItMatters: string;
  whatShouldChange: string;
  betterVersion: string;
}

export interface OptimizerResult {
  overallScore: number;
  analystSummary: string;
  sectionReviews: SectionReview[];
  issues: OptimizerDetectedIssue[];
  autoFixPayload: Partial<HackathonPlan>;
  fixSummary: {
    category: string;
    description: string;
    value: string;
  }[];
}
