// Minister Digital Twin — static configuration
// All IDs for the hackathon company and its 7 capabilities

export const TWIN_COMPANY_ID = "e38b52d4-e82f-4db2-a34a-3793aaa6de42";

export const PROJECTS = {
  cos:         "b4f7a501-1297-4d9f-8ec5-741643fd9a9d",
  radar:       "9d436358-efe1-4e2c-8791-0acfb31ef149",
  friction:    "bdb64f58-d399-4760-a6dc-16ff008ae5f9",
  voice:       "5a6107f9-856a-4a08-8d17-08eb67f1fada",
  readiness:   "c83c3a7a-43e7-4625-9a8c-b7695f2b8ad2",
  policy:      "0b488d6b-de48-41d4-bfb9-cc9ac39b21fb",
  coordination:"e5b4a625-d04d-40c2-9e81-efd60f6cabf4",
} as const;

export const AGENTS = {
  cos:              "b5a0d879-3977-4631-895d-e71c9daa2685",
  dailyBrief:       "2a309c34-87d7-40e5-8e9a-87d42061989c",
  meetingPrep:      "9fae4b06-30ef-493e-80c4-2452bd14e912",
  followupTracker:  "d2638010-f36d-454b-9000-bcc886b21df0",
  radarChief:       "ffeb6d27-069b-4171-b6f5-77ae7dc844ad",
  initiativeMonitor:"9ac28303-275e-42d0-b788-34115c99f90a",
  riskAnalyst:      "c5e3e17a-db46-40ff-86a5-ca4e0d3066f6",
  radarWriter:      "970a97e0-cadc-434f-8d08-d21d052dfcb0",
  frictionChief:    "4a763a55-ffe4-4ad3-a648-d3d586635c4c",
  serviceMapper:    "9f92a965-050a-41f4-a843-236203252873",
  bottleneck:       "476d1dd4-1351-49af-8746-2e15cac66271",
  frictionWriter:   "501f5135-6061-4c78-8469-d4e14d89e211",
  voiceChief:       "3730c02c-0026-448b-b81f-074078e77a87",
  aggregator:       "8ad49af9-51ce-4ee7-a101-12f39c71ff5e",
  sentiment:        "cfff8dc9-2711-4f74-889b-3a35e9daf40c",
  voiceWriter:      "4e576b60-d97b-4303-aa94-dd1bddf0ae49",
  readinessChief:   "d97bbf5f-4e77-4b24-b160-b0bfa1ddad13",
  capacityAssessor: "b190b53b-5f1e-4f23-a80d-1c0b4f7b23bd",
  readinessAnalyst: "e31bf9d0-3a31-4393-840b-efb7a9894dc9",
  readinessWriter:  "fe90c99a-577f-4312-a1f0-e9d41199e792",
  policyChief:      "ecacbb47-fa99-49a3-8bb2-b2be84a92168",
  policyTracker:    "5a5d3869-2943-40ac-8afb-543ac2397936",
  impactAnalyst:    "627381ee-e3d9-400b-97f6-bfb899883635",
  policyWriter:     "ade14348-1b7d-4214-b7cb-1e165253085c",
  coordChief:       "5bc90935-1eec-47d3-8822-7ed52122095d",
  entityLinker:     "71e8b804-ec4d-4ad9-b617-ca1b791d2523",
  conflictResolver: "9c620520-6f99-4582-bce0-1be6d2bfb238",
  coordWriter:      "1de761ce-fc9a-4b1b-87d5-ac997a3897b2",
} as const;

// Routines (for triggering from the UI)
export const ROUTINES = {
  dailyBrief:      null, // discoverable from project
  weeklyReview:    null,
  eodDigest:       null,
  cibWeekly:       "6ad11ff3-4950-4373-a418-6326a87d4a59",
  weeklyPolicyReport: "fe05481f-2281-47a1-95d2-ca9eaf49b8fc",
} as const;

export type CapabilityKey = keyof typeof PROJECTS;

export interface CapabilityMeta {
  key: CapabilityKey;
  label: string;
  labelAr: string;
  description: string;
  descriptionAr: string;
  projectId: string;
  leadAgentId: string;
  icon: string;
  color: string;
  sprint: number;
}

export const CAPABILITIES: CapabilityMeta[] = [
  {
    key: "cos",
    label: "Chief of Staff Office",
    labelAr: "مكتب رئيس الديوان",
    description: "Daily briefs, meeting prep, follow-up tracking, and executive rhythm.",
    descriptionAr: "الإحاطات اليومية، التحضير للاجتماعات، متابعة المهام، والإيقاع التنفيذي.",
    projectId: PROJECTS.cos,
    leadAgentId: AGENTS.cos,
    icon: "Briefcase",
    color: "#4f46e5",
    sprint: 1,
  },
  {
    key: "radar",
    label: "Executive Radar",
    labelAr: "الرادار التنفيذي",
    description: "High-level visibility over national initiatives — what's on track, slipping, or at risk.",
    descriptionAr: "رؤية عالية المستوى للمبادرات الوطنية — ما هو على المسار، يتأخر، أو في خطر.",
    projectId: PROJECTS.radar,
    leadAgentId: AGENTS.radarChief,
    icon: "Radar",
    color: "#0891b2",
    sprint: 2,
  },
  {
    key: "friction",
    label: "Service Friction Intelligence",
    labelAr: "ذكاء احتكاك الخدمات",
    description: "Identify, score, and resolve critical citizen service friction points across ministries.",
    descriptionAr: "تحديد وتقييم وحل نقاط الاحتكاك الحرجة في خدمات المواطنين عبر الوزارات.",
    projectId: PROJECTS.friction,
    leadAgentId: AGENTS.frictionChief,
    icon: "Zap",
    color: "#dc2626",
    sprint: 3,
  },
  {
    key: "voice",
    label: "Citizen Voice Translator",
    labelAr: "مترجم صوت المواطن",
    description: "Transform citizen feedback patterns into actionable ministerial intelligence.",
    descriptionAr: "تحويل أنماط تغذية المواطنين الراجعة إلى استخبارات وزارية قابلة للتنفيذ.",
    projectId: PROJECTS.voice,
    leadAgentId: AGENTS.voiceChief,
    icon: "MessageSquare",
    color: "#059669",
    sprint: 4,
  },
  {
    key: "readiness",
    label: "Institutional Readiness",
    labelAr: "الجاهزية المؤسسية",
    description: "Assess which entities are ready to move fast and where capability gaps threaten reform.",
    descriptionAr: "تقييم الجهات المستعدة للتحرك السريع وحيث تهدد الفجوات الإصلاح.",
    projectId: PROJECTS.readiness,
    leadAgentId: AGENTS.readinessChief,
    icon: "Building2",
    color: "#7c3aed",
    sprint: 5,
  },
  {
    key: "policy",
    label: "Policy Impact Assistant",
    labelAr: "مساعد أثر السياسات",
    description: "Track policy implementation speed, outcome gaps, and cross-ministry policy conflicts.",
    descriptionAr: "تتبع سرعة تنفيذ السياسات وفجوات النتائج والتعارضات السياسية عبر الوزارات.",
    projectId: PROJECTS.policy,
    leadAgentId: AGENTS.policyChief,
    icon: "FileText",
    color: "#d97706",
    sprint: 6,
  },
  {
    key: "coordination",
    label: "Cross-Entity Coordination",
    labelAr: "التنسيق عبر الجهات",
    description: "Detect and resolve cross-ministry dependencies, conflicts, and cascade risks.",
    descriptionAr: "اكتشاف وحل التبعيات والتعارضات ومخاطر التسلسل عبر الوزارات.",
    projectId: PROJECTS.coordination,
    leadAgentId: AGENTS.coordChief,
    icon: "Network",
    color: "#0f766e",
    sprint: 7,
  },
];
