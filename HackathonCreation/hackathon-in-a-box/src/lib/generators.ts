import { HackathonInputs, HackathonPlan } from "./types";

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getProblemContext(domain: string) {
  const d = domain.toLowerCase();
  
  if (d.includes("health") || d.includes("med")) {
    return { 
      nameBase: "Care Flow", 
      problemStatement: "Reducing Patient No-shows and Optimizing Outpatient Triage", 
      targetUser: "Overburdened clinical staff and chronic care outpatients.",
      impact: "Missed appointments cost health systems billions and delay critical interventions. We need a system that intelligently predicts no-shows, offers seamless rescheduling, and triages immediate patient concerns before they enter the clinic.",
      techStack: [
        { category: "Frontend Stack", recommendations: "React Native or Flutter for accessible mobile patient portals." },
        { category: "Backend Logic", recommendations: "Node.js (NestJS) or Python FastAPI strictly utilizing HIPAA-compliant mock data." },
        { category: "Data & Integration", recommendations: "FHIR standard JSON payloads and simulated EMR webhooks." },
        { category: "AI / Modeling", recommendations: "Scikit-Learn or PyTorch for forecasting no-show probabilities based on historical data markers." }
      ]
    };
  }
  
  if (d.includes("fin") || d.includes("bank") || d.includes("money")) {
    return { 
      nameBase: "Yield Momentum", 
      problemStatement: "Democratizing Micro-Investments for Hourly Workers", 
      targetUser: "Underbanked individuals operating on volatile hourly wages.",
      impact: "Traditional investment minimums shut out lower-income earners. We need an automated engine that analyzes daily income and securely rounds up purchases into accessible ETF vehicles without destabilizing liquidity.",
      techStack: [
        { category: "Frontend Stack", recommendations: "Next.js App Router for Web, or Swift for native iOS." },
        { category: "Backend Logic", recommendations: "Go or Rust for high-throughput, low-latency transaction processing." },
        { category: "Data & Integration", recommendations: "Plaid API for bank linking, Stripe for ledger processing." },
        { category: "Security", recommendations: "TLS 1.3, encrypted vault storage for PII, and simulated OAuth 2.0 flows." }
      ]
    };
  }

  if (d.includes("edu") || d.includes("learn") || d.includes("school")) {
    return { 
      nameBase: "Scholar Path", 
      problemStatement: "Preventing At-Risk Student Dropouts via Real-Time Analytics", 
      targetUser: "Academic advisors, university administrations, and struggling undergraduates.",
      impact: "By the time a student fails a midterm, intervention is often too late. We need a proactive system analyzing assignment submission cadences, library access logs, and cohort trends to flag at-risk students securely to advising teams.",
      techStack: [
        { category: "Frontend Stack", recommendations: "React focusing heavily on accessible Web Content Accessibility Guidelines (WCAG) compliance." },
        { category: "Backend Logic", recommendations: "Python Django or Ruby on Rails for robust relational data mapping." },
        { category: "Data Management", recommendations: "PostgreSQL for structured cohort data and Redis for real-time risk alerts." },
        { category: "Integration", recommendations: "Canvas LMS or Blackboard REST APIs (using simulated payloads)." }
      ]
    };
  }

  if (d.includes("sustain") || d.includes("climate") || d.includes("green") || d.includes("eco")) {
    return { 
      nameBase: "Grid Balance", 
      problemStatement: "Predictive Energy Load Balancing for Smart Microgrids", 
      targetUser: "Municipal planners and residential solar contributors.",
      impact: "Inconsistent renewable generation stresses local grids. We need a localized system that predicts sun/wind drop-offs and seamlessly delegates power down-cycling to non-critical appliances in participating households.",
      techStack: [
        { category: "Frontend Stack", recommendations: "Vue.js or React with D3.js/Chart.js for real-time grid visualization." },
        { category: "Backend Logic", recommendations: "Elixir/Phoenix or Go for highly concurrent websocket connections." },
        { category: "Data Management", recommendations: "Time-series databases like InfluxDB or TimescaleDB." },
        { category: "Hardware/IoT", recommendations: "MQTT protocol simulation for residential smart meters." }
      ]
    };
  }

  // Fallback defaults mapping the input closely
  const fallbackTopic = capitalize(domain.split(" ")[0]);
  return { 
    nameBase: `${fallbackTopic} Architect`, 
    problemStatement: `Modernizing Operational Bottlenecks in the ${fallbackTopic} Sector`, 
    targetUser: `Enterprise stakeholders and end-consumers in the ${fallbackTopic} space.`,
    impact: `Legacy architectures are preventing agile scaling in this sector. We need a modernized, cloud-native utility that digitizes slow, manual workflows to enable frictionless user interaction.`,
    techStack: [
      { category: "Frontend App", recommendations: "Next.js or React with Tailwind CSS for rapid prototyping." },
      { category: "API & Logic", recommendations: "Express.js or Python FastAPI running scalable serverless functions." },
      { category: "Data Persistence", recommendations: "PostgreSQL via Prisma ORM or MongoDB for flexible schemas." },
      { category: "Deployment", recommendations: "Vercel or AWS Amplify for immediate public access and validation." }
    ]
  };
}

export function generateHackathonPlan(inputs: HackathonInputs): HackathonPlan {
  const context = getProblemContext(inputs.domain);
  const name = `${context.nameBase} Hackathon`;
  const theme = context.problemStatement;

  const isBeginner = inputs.skillLevels === "Beginner" || inputs.skillLevels === "Mixed";

  // Timeline & Duration logic
  let timeline = [];
  let pulseChecks = [];
  let durationExplanation = "";
  if (inputs.duration <= 12) {
    durationExplanation = `This is an intensive, single-day ${inputs.duration}-hour rapid prototyping sprint. The compressed timeline is designed to force rigorous prioritization—teams must immediately agree on a minimal feature set and execute it without the luxury of overnight iterations.`;
    timeline = [
      { time: "09:00 AM", event: "Event Kickoff & Problem Deep-Dive" },
      { time: "09:45 AM", event: "Development Sprints Begin" },
      { time: "01:00 PM", event: "Working Lunch" },
      { time: "04:30 PM", event: "Code Freeze & Submission Deadline" },
      { time: "05:00 PM", event: "Final Presentations & Judging" }, 
      { time: "06:30 PM", event: "Awards & Closing Remarks" }
    ];
    pulseChecks = [
      { time: "11:00 AM", event: "Architecture Validation Checkpoint" },
      { time: "02:30 PM", event: "Mentor Obstacle Unblocking Session" }
    ];
  } else if (inputs.duration <= 36) {
    // Standard 24h
    durationExplanation = `This ${inputs.duration}-hour overnight hackathon challenges teams to balance aggressive technical execution with stamina and focus. It provides enough space to stand up a functional backend layer while requiring strict time boxing to achieve a polished frontend by morning.`;
    timeline = [
      { time: "09:00 AM", event: "Arrival, Breakfast & Team Formation" },
      { time: "10:00 AM", event: "Opening Ceremony & Challenge Briefing" },
      { time: "11:00 AM", event: "Sprint Commences" },
      { time: "06:00 PM", event: "Dinner & Technical Workshops" },
      { time: "12:00 AM", event: "Midnight Refueling" },
      { time: "08:00 AM (Day 2)", event: "Breakfast & Pitch Prep" },
      { time: "11:00 AM (Day 2)", event: "Code Freeze & Project Submissions" },
      { time: "12:00 PM (Day 2)", event: "Live Demonstrations & Judging" },
      { time: "02:00 PM (Day 2)", event: "Awards Ceremony" }
    ];
    pulseChecks = [
      { time: "02:00 PM", event: "Idea Feasibility Review" },
      { time: "08:00 PM", event: "MVP Core Loop Architecture Review" },
      { time: "09:00 AM (Day 2)", event: "Pitch Deck & Narrative Polish" }
    ];
  } else {
    // Multi-day
    durationExplanation = `Structured over a comprehensive ${inputs.duration}-hour multi-day format. This expanded window simulates a standard corporate sprint, allowing teams appropriate rest cycles while setting higher expectations for code quality, data integration, and user-validation.`;
    timeline = [
      { time: "Friday 06:00 PM", event: "Welcome Mixer & Ideation" },
      { time: "Friday 08:30 PM", event: "Development Begins" },
      { time: "Saturday 10:00 AM", event: "Deep-Dive Technology Workshops" },
      { time: "Saturday 06:00 PM", event: "Mentor Check-in Sessions" },
      { time: "Sunday 01:00 PM", event: "Submission Deadline" },
      { time: "Sunday 02:00 PM", event: "Judging Expo" },
      { time: "Sunday 05:00 PM", event: "Winner Announcements" }
    ];
    pulseChecks = [
      { time: "Friday 09:30 PM", event: "Team Formation & Idea Lockdown" },
      { time: "Saturday 03:00 PM", event: "Technical Architecture Mid-Point Review" },
      { time: "Sunday 10:00 AM", event: "Demo Polish & Dry-Runs" }
    ];
  }

  // Mathematics
  const totalTeams = Math.floor(inputs.participants / inputs.teamSize);
  const remainder = inputs.participants % inputs.teamSize;
  
  let logicStr = `Drawing from a pool of ${inputs.participants} exact participants, aiming for groups of exactly ${inputs.teamSize} individuals. `;
  if (remainder === 0) {
    logicStr += `This mathematical alignment yields precisely ${totalTeams} even teams without requiring adjustments.`;
  } else {
    logicStr += `This strict sizing forms ${totalTeams} full teams and leaves ${remainder} participant(s) unassigned natively, requiring manual intervention or team flex rules.`;
  }

  // Learning Goals Leapfrog
  const fallbackGoal = "executing functional MVPs under intense pressure";
  const providedGoal = inputs.learningGoals.trim().length > 0 ? inputs.learningGoals : fallbackGoal;

  return {
    name,
    theme,
    purpose: `The objective of this hackathon is to directly confront a specific operational friction: ${context.problemStatement}. By focusing exclusively on this domain, we ensure participants address actual enterprise bottlenecks affecting ${context.targetUser}`,
    nameMeaning: `The title "${name}" reflects our directive. We are not just building software; we are engineering a catalyst capable of shifting paradigms and solving real-world friction.`,
    coreChallenge: `Target Challenge: ${context.impact}`,
    techPrinciples: context.techStack,
    teamFormat: {
      totalTeams: totalTeams + (remainder > 0 ? 1 : 0),
      distribution: `${totalTeams} teams of ${inputs.teamSize}${remainder > 0 ? ` + 1 fragmented group of ${remainder}` : ''}`,
      logic: logicStr,
      tags: [isBeginner ? "Mixed Experience Tiers" : "Advanced Execution Pods", "Cross-Functional Expected"]
    },
    skillLeapfrog: `Traditional tutorials fail to provide real stakes. This environment forces teams to prioritize features ruthlessly, specifically advancing their competencies in ${providedGoal}. Participants will leave with robust portfolio artifacts and experience resolving conflicting architecture design choices.`,
    durationExplanation,
    pulseChecks,
    timeline,
    finalSubmission: [
      "A fully functional Minimum Viable Product (MVP) accessible via browser or mobile.",
      "A public Git repository containing the uncompiled source code and a detailed README.md.",
      "A tight, 3-minute pitch deck defining the business value, the technical architecture, and the scaling methodology.",
      "A clear technical declaration explicitly identifying what elements are functional versus what layers are strictly mocked."
    ],
    judgingCriteria: [
      { name: "Technical Execution", weight: 35, description: "Is the software functional? Does it intelligently leverage the suggested technology stacks?" },
      { name: "Problem Eradication", weight: 30, description: `How completely does this application solve the identified pain points for ${context.targetUser.split(' and ')[0]}?` },
      { name: "Experience Design", weight: 20, description: "Is the interface intuitive, accessible, and free of critical usability logic flaws?" },
      { name: "Market Reality", weight: 15, description: "Are the deployment expectations and business models realistic?" }
      // Deliberately missing personal growth/learning goal alignment for the optimizer to flag
    ],
    awards: [
      "Overall Architecture Champion ($5,000 + Incubation)",
      "Best Technical Implementation ($2,500)",
      "Exceptional User Experience Design ($1,500)",
      "Most Scalable Framework (Mentorship Package)"
    ],
    finalStandard: `Judges expect a functional, demonstrable application. Slide-deck-only submissions will be disqualified. The solution must handle a happy-path demonstration gracefully without encountering fatal crashes, and the codebase must be organized professionally as if handing it off to a senior engineering team.`
  };
}
