import { HackathonInputs, HackathonPlan, OptimizerDetectedIssue, OptimizerResult, SectionReview } from "./types";

export function analyzePlan(plan: HackathonPlan, inputs: HackathonInputs): OptimizerResult {
  const issues: OptimizerDetectedIssue[] = [];
  const autoFixPayload: Partial<HackathonPlan> = {};
  const fixSummary: { category: string; description: string; value: string }[] = [];
  
  // Initialize reviews for the 8 core dimensions requested.
  const reviewMap: Record<string, SectionReview> = {
    "Problem Definition Quality": { sectionName: "Problem Definition Quality", status: "Strong", reason: "Highly targeted, functional constraints." },
    "Timeline Logic": { sectionName: "Timeline Logic", status: "Strong", reason: "Viable execution pathway." },
    "Technical Direction": { sectionName: "Technical Direction", status: "Strong", reason: "Stack is proportional to the duration allocated." },
    "Judging Logic": { sectionName: "Judging Logic", status: "Strong", reason: "Scoring reflects stated priorities efficiently." },
    "Submission Design": { sectionName: "Submission Design", status: "Strong", reason: "Deliverables are structurally valid." },
    "Team Structure": { sectionName: "Team Structure", status: "Strong", reason: "Demographic allocation is clear." },
    "Learning Goal Alignment": { sectionName: "Learning Goal Alignment", status: "Strong", reason: "Objectives are integrated effectively." },
    "Final Standard / MVP Realism": { sectionName: "Final Standard / MVP Realism", status: "Strong", reason: "Requirements are credible." }
  };
  
  let totalDeductions = 0;

  // Helper
  const addIssue = (
    deduction: number,
    section: string,
    whatIsWrong: string,
    whyItMatters: string,
    whatShouldChange: string,
    betterVersion: string
  ) => {
    totalDeductions += deduction;
    issues.push({
      id: Math.random().toString(36).substr(2, 9),
      severity: deduction > 10 ? "medium" : "low", // Never 'high' unless catastrophic
      whatIsWrong,
      whyItMatters,
      whatShouldChange,
      betterVersion
    });
    
    if (reviewMap[section]) {
      reviewMap[section].status = "Needs Improvement";
      reviewMap[section].reason = "Optimization gap detected in current configuration.";
    }
  };

  // 1. Problem Depth Check (Problem Definition Quality)
  const isVagueProblem = plan.coreChallenge.toLowerCase().includes("innovation") || plan.coreChallenge.toLowerCase().includes("bottlenecks") || plan.coreChallenge.includes("agile");
  if (isVagueProblem) {
    addIssue(
      8,
      "Problem Definition Quality",
      "The Core Challenge relies on conceptual language rather than a specific constraint target.",
      "Without specific friction points defined, participant output will be scattered, reducing the impact of the final MVPs.",
      "Refine the Core Challenge to target a measurable operational improvement without altering the overarching theme.",
      "Target Challenge: Target highly explicit friction points in the localized user journey, demanding a functional prototype that quantifies reduction in friction."
    );
    autoFixPayload.coreChallenge = plan.coreChallenge + " Focus explicitly on reducing user friction and producing a functional MVP that directly disrupts a measurable inefficiency.";
    fixSummary.push({
      category: "Problem Definition Alignment",
      description: "Added explicit measurable constraint expectations to the challenge brief.",
      value: "Enhances execution quality and gives judges a concrete baseline."
    });
  }

  // 2. Timeline Scalability (Timeline Logic / Team Structure)
  let totalTeams = plan.teamFormat.totalTeams;
  if (!totalTeams && inputs.teamSize > 0) totalTeams = Math.floor(inputs.participants / inputs.teamSize);
  
  const demoEventIndex = plan.timeline.findIndex(e => e.event.toLowerCase().includes("demo") || e.event.toLowerCase().includes("judging") || e.event.toLowerCase().includes("presentation"));
  const endsEventIndex = plan.timeline.findIndex(e => e.event.toLowerCase().includes("deadline") || e.event.toLowerCase().includes("close"));
  
  if (demoEventIndex > -1) {
    // If high team volume, sequentially judging causes a bottleneck
    if (totalTeams > 10) {
      addIssue(
        12,
        "Timeline Logic",
        "A standard sequential presentation timeline poses an execution bottleneck for a high volume of projected teams.",
        "Attempting to serialize this many demos will cause significant timeline overruns and judging fatigue.",
        "Replace sequential presentations with a concurrent 'Science-Fair' or 'Expo' judging format.",
        "Concurrent Prototype Expo & Distributed Judging Round."
      );
      // Autofix
      const newTimeline = [...plan.timeline];
      newTimeline[demoEventIndex].event = "Concurrent Prototype Expo & Distributed Judging Round";
      autoFixPayload.timeline = newTimeline;
      fixSummary.push({
        category: "Timeline Logic Resync",
        description: "Replaced sequential presentations with a concurrent expo format.",
        value: "Prevents severe presentation bottlenecks and ensures fair judicial evaluation."
      });
    }
    
    // Check missing buffer
    if (endsEventIndex > -1 && demoEventIndex === endsEventIndex + 1) {
      addIssue(
        5,
        "Timeline Logic",
        "The schedule moves directly from code freeze to presentations without an operational buffer.",
        "A lack of A/V validation and deployment testing inevitably forces timeline delays.",
        "Insert a brief tech-check / deployment buffer block before demos commence.",
        "Required A/V Triage & Deployment Freeze."
      );
      if (!autoFixPayload.timeline) {
        const fixed = [...plan.timeline];
        fixed.splice(endsEventIndex + 1, 0, { time: "Post-Deadline Buffer", event: "A/V Triage & Mentor Dry-Runs" });
        autoFixPayload.timeline = fixed;
      }
    }
  }

  // 3. Technical Mismatch (Technical Direction)
  const heavyBackend = plan.techPrinciples.some(tp => tp.recommendations.toLowerCase().includes("postgresql") || tp.recommendations.toLowerCase().includes("django"));
  if (heavyBackend && inputs.duration <= 12) {
    addIssue(
      8,
      "Technical Direction",
      "Stack-to-duration mismatch: High-overhead relational backend requirements suggested within a highly compressed sprint.",
      "Configuring robust databases consumes valuable hours during short events, stalling frontend prototype development.",
      "Simplify the technical recommendations toward rapid, lightweight backend-as-a-service (BaaS) tools.",
      "Rapid Prototyping Stacks: Supabase, Firebase, or strict LocalStorage / Mocks."
    );
    // Autofix
    const newTech = plan.techPrinciples.map(tp => {
      if (tp.category.toLowerCase().includes("back") || tp.category.toLowerCase().includes("data")) {
        return { ...tp, recommendations: "Supabase, Firebase, or extensive local JSON mocking (Optimize for UI/UX velocity)." };
      }
      return tp;
    });
    autoFixPayload.techPrinciples = newTech;
    fixSummary.push({
      category: "Technical Calibration",
      description: "Simplified backend recommendations toward lightweight MVP tools.",
      value: "Safeguards team velocity and aligns stack expectations with overall schedule."
    });
  }

  // 4. Learning Goal Synchronization (Learning Goal Alignment / Judging Logic)
  const checkingLearningGoals = inputs.learningGoals.toLowerCase();
  const judgingWeightsSummary = plan.judgingCriteria.map(j => j.name.toLowerCase()).join(" ");
  if (checkingLearningGoals.length > 5 && !judgingWeightsSummary.includes("growth") && !judgingWeightsSummary.includes("stretch")) {
    addIssue(
      5,
      "Judging Logic",
      "Scoring misalignment: The overarching learning goals are not mathematically represented in the judging rubric.",
      "Teams prioritize what is weighted. Ignoring skill acquisition in the rubric undercuts the primary educational incentive.",
      "Rebalance scoring weights modestly to introduce a learning/growth/stretch criterion.",
      "Technical Stretch & Prototype Growth (+15% Weight)"
    );
    // Autofix
    autoFixPayload.judgingCriteria = [
      ...plan.judgingCriteria.map(jc => ({ ...jc, weight: Math.floor(jc.weight * 0.85) })),
      { name: "Technical Stretch & Comprehension", weight: 15, description: "Evaluates explicit growth aligned with event core learning objectives." }
    ];
    fixSummary.push({
      category: "Rubric Calibration",
      description: "Injected a proportional 'Technical Stretch' scoring field.",
      value: "Mathematically enforces target learning outcomes without derailing core product evaluation."
    });
  }

  // Final Health calculation
  let overallScore = 100 - totalDeductions;
  
  // Hard floor to prevent dramatic drops for non-catastrophic combinations
  if (overallScore < 60 && totalDeductions <= 40) {
    overallScore = 65; 
  }

  // Adjust analyst summary according to exact bands requested
  let analystSummary = "";
  if (overallScore >= 90) {
    analystSummary = "Excellent architecture. This plan is highly coherent, implementation-ready, and exhibits optimal flow. Only minor refinement is suggested.";
  } else if (overallScore >= 80) {
    analystSummary = "Strong operational blueprint. The framework is realistic and well-structured, presenting some moderate improvement opportunities for competitive polish.";
  } else if (overallScore >= 70) {
    analystSummary = "Good foundational plan. It is viable and credible but contains notable structural weaknesses that should be resolved to guarantee smooth execution.";
  } else if (overallScore >= 60) {
    analystSummary = "Weak but workable structure. Several execution bottlenecks reduce overall quality, requiring surgical refinement before publication.";
  } else if (overallScore >= 50) {
    analystSummary = "Substantially flawed architecture. The current parameters present meaningful misalignment across multiple dimensions that require direct redesign.";
  } else {
    analystSummary = "Severe structural break detected. The configuration relies on fundamentally contradictory logic and cannot be executed without critical adjustments.";
  }

  const sectionReviews = Object.values(reviewMap);

  return {
    overallScore,
    analystSummary,
    sectionReviews,
    issues,
    autoFixPayload,
    fixSummary
  };
}
