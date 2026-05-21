import { HackathonInputs, HackathonPlan, Idea, SkillLevel, Track } from "./types";

interface ProblemContext {
  topic: string;
  nameBases: string[];
  challengeAngles: string[];
  targetUsers: string[];
  impactStatements: string[];
  trackSeeds: string[];
  ideaSeeds: string[];
  techStacks: { category: string; recommendations: string }[][];
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function titleCase(value: string) {
  return value
    .replace(/[:/]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => capitalize(word.toLowerCase()))
    .join(" ");
}

function cleanTopic(domain: string) {
  const topic = domain.split(":")[0]?.trim() || domain.trim();
  return titleCase(topic || "Innovation");
}

function pick<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function sample<T>(items: T[], count: number) {
  return shuffle(items).slice(0, count);
}

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function getProblemContext(domain: string): ProblemContext {
  const d = domain.toLowerCase();

  if (d.includes("health") || d.includes("med")) {
    return {
      topic: "HealthTech",
      nameBases: ["Care Flow", "Clinic Compass", "Patient Pulse", "Triage Lab"],
      challengeAngles: [
        "Reducing Patient No-shows and Optimizing Outpatient Triage",
        "Building Safer Follow-up Loops for Chronic Care Patients",
        "Designing Fast Digital Intake for Overloaded Clinics",
        "Improving Medication Adherence With Human-Centered Reminders",
      ],
      targetUsers: [
        "clinical staff coordinating high-volume appointments",
        "patients who need simple post-visit support",
        "care coordinators handling repeated manual follow-ups",
      ],
      impactStatements: [
        "Missed appointments delay intervention and waste scarce clinical capacity.",
        "Patients often leave care settings without a clear, trusted next step.",
        "Manual triage creates long waits for people who need early support.",
      ],
      trackSeeds: ["Access & Scheduling", "Patient Guidance", "Clinic Operations", "Care Analytics"],
      ideaSeeds: [
        "No-show prediction dashboard with rescheduling nudges",
        "Voice-first symptom intake and urgency router",
        "Medication routine coach with family check-ins",
        "Post-visit recovery tracker for care teams",
        "Queue visibility tool for walk-in clinics",
      ],
      techStacks: [
        [
          { category: "Frontend Stack", recommendations: "React Native or Flutter for accessible patient-facing mobile flows." },
          { category: "Backend Logic", recommendations: "Node.js or Python FastAPI with strictly simulated clinical data." },
          { category: "Data & Integration", recommendations: "FHIR-style JSON payloads and mocked EMR webhooks." },
          { category: "AI / Modeling", recommendations: "Lightweight classification for risk scoring and routing suggestions." },
        ],
        [
          { category: "Frontend Stack", recommendations: "Next.js with responsive kiosk, staff, and patient views." },
          { category: "Backend Logic", recommendations: "Supabase or Firebase for rapid appointment and message workflows." },
          { category: "Data & Integration", recommendations: "CSV imports and fake clinic calendars for demo realism." },
          { category: "Safety", recommendations: "Clear disclaimers, escalation paths, and no real medical diagnosis." },
        ],
      ],
    };
  }

  if (d.includes("fin") || d.includes("bank") || d.includes("money")) {
    return {
      topic: "FinTech",
      nameBases: ["Money Motion", "Ledger Lift", "Yield Lab", "Budget Bridge"],
      challengeAngles: [
        "Helping Students Build Safer Budgeting Habits",
        "Making Cashflow Visible for Small Businesses",
        "Improving Fraud Awareness Through Interactive Tools",
        "Designing Micro-Savings Systems for Irregular Income",
      ],
      targetUsers: [
        "students managing unpredictable monthly expenses",
        "small business owners tracking cashflow gaps",
        "first-time digital banking users learning safer habits",
      ],
      impactStatements: [
        "Small financial decisions compound quickly when people lack timely feedback.",
        "Manual cashflow tracking hides risks until they become expensive emergencies.",
        "Fraud prevention works best when users understand the pattern before the loss.",
      ],
      trackSeeds: ["Budget Coaching", "Fraud Defense", "Small Business Tools", "Financial Literacy"],
      ideaSeeds: [
        "Subscription leak detector for students",
        "Cashflow warning board for micro-businesses",
        "Fraud scenario game with safe decision scoring",
        "Micro-savings planner for irregular income",
        "Receipt-to-budget assistant with spending insights",
      ],
      techStacks: [
        [
          { category: "Frontend Stack", recommendations: "Next.js App Router with charts for spending and risk visibility." },
          { category: "Backend Logic", recommendations: "Serverless functions with mocked banking transactions." },
          { category: "Data & Integration", recommendations: "Plaid-style sandbox payloads and CSV import for demos." },
          { category: "Security", recommendations: "Simulated OAuth flows, encrypted mock tokens, and privacy-first copy." },
        ],
      ],
    };
  }

  if (d.includes("edu") || d.includes("learn") || d.includes("school")) {
    return {
      topic: "EdTech",
      nameBases: ["Scholar Sprint", "Mentor Map", "Learning Loop", "Campus Catalyst"],
      challengeAngles: [
        "Supporting At-Risk Students Before They Disengage",
        "Making Study Planning Feel Personal and Actionable",
        "Connecting Peer Mentors With Learners Who Need Help",
        "Turning Lectures Into Practical Study Paths",
      ],
      targetUsers: [
        "students trying to organize coursework under pressure",
        "academic advisors looking for early support signals",
        "peer mentors coordinating help across large cohorts",
      ],
      impactStatements: [
        "Students often ask for help only after a problem has grown too large.",
        "Course material becomes more useful when learners can turn it into next actions.",
        "Mentorship systems fail when matching and follow-up are handled manually.",
      ],
      trackSeeds: ["Learning Analytics", "Peer Support", "Study Tools", "Advisor Workflows"],
      ideaSeeds: [
        "Study plan generator based on deadline stress",
        "Peer mentor matching board with follow-up prompts",
        "Lecture summary to quiz workflow",
        "At-risk student check-in dashboard",
        "Group project accountability tracker",
      ],
      techStacks: [
        [
          { category: "Frontend Stack", recommendations: "React with accessible dashboards and student-first mobile screens." },
          { category: "Backend Logic", recommendations: "Firebase or Supabase for fast cohort and task modeling." },
          { category: "Data Management", recommendations: "Mock LMS exports with assignment, attendance, and progress fields." },
          { category: "AI / Search", recommendations: "Embeddings or simple semantic search over course notes." },
        ],
      ],
    };
  }

  if (d.includes("climate") || d.includes("green") || d.includes("eco") || d.includes("sustain")) {
    return {
      topic: "ClimateTech",
      nameBases: ["Grid Balance", "Carbon Loop", "Eco Signal", "Waste Wise"],
      challengeAngles: [
        "Reducing Household Energy Waste With Better Feedback",
        "Helping Cities Coordinate Smarter Waste Sorting",
        "Making Sustainable Mobility Easier to Choose",
        "Tracking Water Usage Before It Becomes Waste",
      ],
      targetUsers: [
        "residents trying to reduce environmental impact",
        "municipal teams coordinating local sustainability programs",
        "campus facility managers monitoring resource usage",
      ],
      impactStatements: [
        "Climate action becomes easier when people see the next practical behavior.",
        "Resource waste often hides in daily routines and fragmented reporting.",
        "Local programs need visible evidence to turn intent into participation.",
      ],
      trackSeeds: ["Energy Awareness", "Waste Sorting", "Water Monitoring", "Mobility Choices"],
      ideaSeeds: [
        "Household energy challenge app with neighborhood goals",
        "Smart waste sorting assistant using image labels",
        "Water leak reporting dashboard for campuses",
        "Carpool coordination board for event attendees",
        "Carbon habit tracker with weekly nudges",
      ],
      techStacks: [
        [
          { category: "Frontend Stack", recommendations: "React with maps, charts, and mobile-friendly reporting flows." },
          { category: "Backend Logic", recommendations: "Serverless APIs for reports, scores, and notifications." },
          { category: "Data Management", recommendations: "Time-series mock data and CSV uploads for resource usage." },
          { category: "Hardware / IoT", recommendations: "MQTT-style simulated sensor events for demo scenarios." },
        ],
      ],
    };
  }

  if (d.includes("city") || d.includes("traffic") || d.includes("parking")) {
    return {
      topic: "Smart Cities",
      nameBases: ["Civic Flow", "Metro Mind", "Street Signal", "Urban Loop"],
      challengeAngles: [
        "Improving Citizen Issue Reporting and Resolution",
        "Reducing Parking Search Friction Near Busy Areas",
        "Helping Local Teams Understand Traffic Hotspots",
        "Making Public Spaces Easier to Navigate",
      ],
      targetUsers: ["city residents", "municipal operations teams", "commuters and visitors"],
      impactStatements: [
        "Cities improve fastest when daily friction is visible, prioritized, and closed.",
        "A small delay repeated across thousands of commuters becomes a major civic cost.",
        "Public services need clearer feedback loops between residents and operators.",
      ],
      trackSeeds: ["Mobility", "Citizen Services", "Public Space Access", "Operations Dashboard"],
      ideaSeeds: [
        "Citizen issue triage map with priority scoring",
        "Parking availability predictor for event zones",
        "Accessible route planner for public buildings",
        "Traffic hotspot explainer for city staff",
        "Public facility wait-time board",
      ],
      techStacks: [
        [
          { category: "Frontend Stack", recommendations: "Next.js with map views and quick reporting forms." },
          { category: "Backend Logic", recommendations: "API routes or Supabase for civic reports and status updates." },
          { category: "Data Management", recommendations: "GeoJSON, mock GPS events, and public-service sample datasets." },
          { category: "Analytics", recommendations: "Simple clustering and priority scoring for hotspots." },
        ],
      ],
    };
  }

  const topic = cleanTopic(domain);
  return {
    topic,
    nameBases: [`${topic} Forge`, `${topic} Lab`, `${topic} Sprint`, `${topic} Catalyst`],
    challengeAngles: [
      `Modernizing Manual Workflows in ${topic}`,
      `Creating Faster Decision Support for ${topic} Teams`,
      `Building Human-Centered Tools for ${topic} Services`,
      `Reducing Friction in the ${topic} User Journey`,
    ],
    targetUsers: [
      `${topic} teams handling repeated manual tasks`,
      `end users navigating ${topic.toLowerCase()} services`,
      `operators and decision-makers in the ${topic.toLowerCase()} space`,
    ],
    impactStatements: [
      `Manual workflows in ${topic.toLowerCase()} slow teams down and create avoidable user frustration.`,
      `${topic} services become stronger when users can move from need to outcome with fewer steps.`,
      `The sector needs practical prototypes that turn scattered information into confident action.`,
    ],
    trackSeeds: ["Workflow Automation", "User Experience", "Decision Support", "Data Visibility"],
    ideaSeeds: [
      `${topic} request tracker with priority routing`,
      `${topic} self-service assistant for common tasks`,
      `${topic} dashboard that exposes hidden bottlenecks`,
      `${topic} onboarding flow for first-time users`,
      `${topic} alert system for important exceptions`,
    ],
    techStacks: [
      [
        { category: "Frontend App", recommendations: "Next.js or React with Tailwind CSS for fast, polished prototyping." },
        { category: "API & Logic", recommendations: "Express.js, Next API routes, or Python FastAPI for lightweight flows." },
        { category: "Data Persistence", recommendations: "Supabase, Firebase, or local JSON mocks depending on event duration." },
        { category: "Deployment", recommendations: "Vercel or Netlify for immediate public demos." },
      ],
    ],
  };
}

function buildTracks(context: ProblemContext, skillLevels: SkillLevel): Track[] {
  const difficulties: SkillLevel[] =
    skillLevels === "Mixed"
      ? ["Beginner", "Intermediate", "Advanced"]
      : [skillLevels, skillLevels, skillLevels];

  return sample(context.trackSeeds, 3).map((name, index) => ({
    id: makeId("track"),
    name,
    difficulty: difficulties[index] ?? "Mixed",
    description: `Teams in this track build a prototype focused on ${name.toLowerCase()} for ${pick(context.targetUsers)}.`,
  }));
}

function buildIdeas(context: ProblemContext, tracks: Track[]): Idea[] {
  return sample(context.ideaSeeds, Math.min(4, context.ideaSeeds.length)).map((idea, index) => ({
    id: makeId("idea"),
    title: idea,
    description: `Starter prompt: create a demoable MVP that proves the core workflow, shows the main user value, and includes one measurable success signal.`,
    trackId: tracks[index % tracks.length].id,
  }));
}

function buildTeamFormat(inputs: HackathonInputs, isBeginner: boolean) {
  const totalTeams = Math.ceil(inputs.participants / inputs.teamSize);
  const baseSize = Math.floor(inputs.participants / totalTeams);
  const largerTeams = inputs.participants % totalTeams;
  const smallerTeams = totalTeams - largerTeams;
  const distribution =
    largerTeams === 0
      ? `${totalTeams} teams of ${baseSize}`
      : `${largerTeams} teams of ${baseSize + 1} + ${smallerTeams} teams of ${baseSize}`;

  return {
    totalTeams,
    distribution,
    logic: `The generator balances ${inputs.participants} participants across ${totalTeams} teams instead of leaving leftovers. This creates ${distribution}, keeping team sizes within one person of each other for fairer collaboration and judging.`,
    tags: [
      isBeginner ? "Mentor-Friendly Teams" : "Execution-Focused Teams",
      largerTeams > 0 ? "Balanced Remainder Handling" : "Even Team Distribution",
      "Cross-Functional Expected",
    ],
  };
}

function buildTimeline(inputs: HackathonInputs, totalTeams: number) {
  const judgingMode = totalTeams > 10 ? "Concurrent Prototype Expo & Distributed Judging" : "Final Presentations & Judging";
  const workshop = pick(["Mentor Clinics", "Technical Workshops", "Customer Discovery Lab", "Pitch Narrative Studio"]);

  if (inputs.duration <= 12) {
    return {
      durationExplanation: `This is a focused ${inputs.duration}-hour sprint. The plan favors fast problem framing, a narrow MVP, and visible checkpoints so teams can finish something demonstrable inside a single day.`,
      timeline: [
        { time: "00:00", event: "Kickoff, Challenge Reveal & Team Formation" },
        { time: "00:45", event: "Problem Framing and Scope Lock" },
        { time: "01:30", event: "Prototype Sprint Begins" },
        { time: "Midpoint", event: workshop },
        { time: "Final Hour", event: "Code Freeze, Demo Setup & Submission" },
        { time: "Close", event: judgingMode },
      ],
      pulseChecks: [
        { time: "25%", event: "Idea Feasibility Check" },
        { time: "60%", event: "MVP Core Loop Review" },
      ],
    };
  }

  if (inputs.duration <= 36) {
    return {
      durationExplanation: `This ${inputs.duration}-hour format gives teams enough space to validate a concept, build a functional core loop, and polish a short demo without turning the event into a multi-day sprint.`,
      timeline: [
        { time: "Hour 0", event: "Arrival, Kickoff & Challenge Briefing" },
        { time: "Hour 1", event: "Team Formation and Track Selection" },
        { time: "Hour 3", event: "Build Sprint 1: Core Workflow" },
        { time: "Hour 8", event: workshop },
        { time: "Hour 14", event: "Build Sprint 2: Integration and UX" },
        { time: "Final 3 Hours", event: "Submission Freeze, A/V Check and Pitch Prep" },
        { time: "Close", event: judgingMode },
      ],
      pulseChecks: [
        { time: "Hour 4", event: "Mentor Feasibility Review" },
        { time: "Hour 12", event: "Technical Architecture Review" },
        { time: "Final 4 Hours", event: "Demo Readiness Check" },
      ],
    };
  }

  return {
    durationExplanation: `This ${inputs.duration}-hour multi-day format supports deeper discovery, stronger technical execution, and a more convincing final demonstration. Teams should show both product thinking and working software.`,
    timeline: [
      { time: "Day 1 Evening", event: "Welcome, Track Reveal and Team Matching" },
      { time: "Day 1 Late", event: "Problem Interviews and Scope Lock" },
      { time: "Day 2 Morning", event: "Build Sprint 1 and Mentor Rounds" },
      { time: "Day 2 Afternoon", event: workshop },
      { time: "Day 2 Evening", event: "Build Sprint 2 and Integration" },
      { time: "Final Day Morning", event: "Demo Polish, Submission Freeze and A/V Check" },
      { time: "Final Day Afternoon", event: judgingMode },
    ],
    pulseChecks: [
      { time: "Day 1 Close", event: "Idea Lockdown" },
      { time: "Day 2 Midday", event: "Architecture and Risk Review" },
      { time: "Final Day Morning", event: "Pitch and Demo Dry Run" },
    ],
  };
}

function buildRulesGuidelines() {
  return sample(
    [
      "Every team must submit a working demo link or recorded walkthrough.",
      "Mock data is allowed, but teams must clearly label mocked integrations.",
      "Judges can ask to inspect the happy-path flow live during evaluation.",
      "Teams must explain one major tradeoff they made under time pressure.",
      "External libraries are allowed if the team can explain how they are used.",
      "No slide-only submissions qualify for the main awards.",
      "Accessibility and responsible data handling are part of the final review.",
    ],
    5
  );
}

export function generateHackathonPlan(inputs: HackathonInputs): HackathonPlan {
  const context = getProblemContext(inputs.domain);
  const variant = pick(["Launch", "Sprint", "Forge", "Challenge", "Lab", "Quest"]);
  const nameBase = pick(context.nameBases);
  const name = `${nameBase} ${variant}`;
  const theme = pick(context.challengeAngles);
  const targetUser = pick(context.targetUsers);
  const impact = pick(context.impactStatements);
  const tracks = buildTracks(context, inputs.skillLevels);
  const ideaPrompts = buildIdeas(context, tracks);
  const isBeginner = inputs.skillLevels === "Beginner" || inputs.skillLevels === "Mixed";
  const teamFormat = buildTeamFormat(inputs, isBeginner);
  const schedule = buildTimeline(inputs, teamFormat.totalTeams);
  const providedGoal = inputs.learningGoals.trim() || "executing functional MVPs under intense pressure";

  return {
    generationId: makeId("plan"),
    name,
    theme,
    purpose: `The objective of this hackathon is to help teams solve a practical ${context.topic} problem for ${targetUser}. This version focuses on ${theme.toLowerCase()} and asks participants to turn the idea into a usable prototype, not just a concept.`,
    nameMeaning: `The title ${name} signals this event's personality: focused, build-oriented, and experimental. It frames the hackathon as a place where teams turn ${context.topic.toLowerCase()} friction into working product decisions.`,
    coreChallenge: `Target Challenge: ${impact} Teams must build a working MVP that reduces this friction for ${targetUser} and proves value through a clear user flow or measurable signal.`,
    tracks,
    ideaPrompts,
    rulesGuidelines: buildRulesGuidelines(),
    techPrinciples: pick(context.techStacks),
    teamFormat,
    skillLeapfrog: `This setup pushes participants beyond tutorials by forcing them to make product and architecture decisions under real constraints. It directly supports the learning goals: ${providedGoal}.`,
    durationExplanation: schedule.durationExplanation,
    pulseChecks: schedule.pulseChecks,
    timeline: schedule.timeline,
    finalSubmission: [
      "A functional MVP accessible through a browser, mobile device, or recorded local demo.",
      "A public repository or code bundle with setup instructions and clear ownership notes.",
      "A 3-minute pitch explaining the user problem, prototype flow, technical approach, and next step.",
      "A short honesty note identifying what is working, mocked, incomplete, and risky.",
    ],
    judgingCriteria: shuffle([
      { name: "Prototype Functionality", weight: 30, description: "Does the product work clearly enough to demonstrate the main user flow?" },
      { name: "Problem Fit", weight: 25, description: `How directly does the solution help ${targetUser}?` },
      { name: "Experience Design", weight: 20, description: "Is the interface understandable, accessible, and smooth under demo conditions?" },
      { name: "Technical Execution", weight: 15, description: "Is the architecture reasonable for the event duration and team skill level?" },
      { name: "Learning Stretch", weight: 10, description: "Did the team clearly grow in relation to the stated learning goals?" },
    ]),
    awards: sample(
      [
        "Grand Prize: Most Complete MVP",
        "Best Technical Execution",
        "Best User Experience",
        "Most Creative Use of Data",
        "Best Social Impact",
        "Sharpest Pitch",
        "Best Beginner Team",
      ],
      4
    ),
    finalStandard: `A strong submission must demonstrate a coherent MVP, explain why it matters in ${context.topic}, and survive a live happy-path walkthrough. Judges should be able to understand the user, the pain point, the solution, and the next iteration without guessing.`,
  };
}
