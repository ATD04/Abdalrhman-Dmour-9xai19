export const COMPANY_ID = 'e38b52d4-e82f-4db2-a34a-3793aaa6de42';
export const COMPANY_PREFIX = 'MIN';

export const PROJECTS = {
  cos:          'b4f7a501-1297-4d9f-8ec5-741643fd9a9d',
  radar:        '9d436358-efe1-4e2c-8791-0acfb31ef149',
  friction:     'bdb64f58-d399-4760-a6dc-16ff008ae5f9',
  voice:        '5a6107f9-856a-4a08-8d17-08eb67f1fada',
  readiness:    'c83c3a7a-43e7-4625-9a8c-b7695f2b8ad2',
  policy:       '0b488d6b-de48-41d4-bfb9-cc9ac39b21fb',
  coordination: 'e5b4a625-d04d-40c2-9e81-efd60f6cabf4',
} as const;

export const LEAD_AGENTS = {
  cos:          'b5a0d879-7c7d-4f55-999d-8e9f6d43a2b1',
  radar:        'ffeb6d27-2b24-4a9f-87b3-c8e5d2f1a093',
  friction:     '4a763a55-e8c2-4b7f-a1d9-b6f3c8e20174',
  voice:        '3730c02c-9f14-4e8a-b2d7-c5a6e1f80265',
  readiness:    'd97bbf5f-1a3e-4c9b-85f2-e74d6a2b1036',
  policy:       'ecacbb47-5b7d-4f2a-93e1-d8c6b4a70127',
  coordination: '5bc90935-3c8f-4e1b-a7d4-f2e9c6b80218',
} as const;

export type CapKey = keyof typeof PROJECTS;
export const CAP_KEYS: CapKey[] = ['cos', 'radar', 'friction', 'voice', 'readiness', 'policy', 'coordination'];

export interface CapabilityMeta {
  key: CapKey;
  labelEn: string;
  labelAr: string;
  descEn: string;
  descAr: string;
  color: string;        // Tailwind text-* class
  bgColor: string;     // Tailwind bg-* class for icon bg
  borderColor: string; // Tailwind border-* class for active
  emoji: string;
}

export const CAPABILITIES: CapabilityMeta[] = [
  {
    key: 'cos',
    labelEn: 'Chief of Staff HQ',
    labelAr: 'مكتب رئيس الديوان',
    descEn: 'Cross-cutting coordination and ministerial briefing synthesis',
    descAr: 'التنسيق الشامل وتجميع الإحاطات الوزارية',
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/40',
    emoji: '🏛️',
  },
  {
    key: 'radar',
    labelEn: 'Regulatory Radar',
    labelAr: 'رادار التشريعات',
    descEn: 'Automated monitoring of policy signals and regulatory updates',
    descAr: 'رصد آلي للإشارات السياسية والتحديثات التشريعية',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/40',
    emoji: '📡',
  },
  {
    key: 'friction',
    labelEn: 'Friction Finder',
    labelAr: 'كاشف الإجراءات المعقدة',
    descEn: 'Identify and diagnose service delivery friction points',
    descAr: 'تحديد وتشخيص نقاط الاحتكاك في تقديم الخدمات',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/40',
    emoji: '🔍',
  },
  {
    key: 'voice',
    labelEn: 'Citizen Voice',
    labelAr: 'صوت المواطن',
    descEn: 'Aggregate and synthesize citizen feedback and sentiment',
    descAr: 'جمع وتحليل تعليقات المواطنين ومشاعرهم',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/40',
    emoji: '🗣️',
  },
  {
    key: 'readiness',
    labelEn: 'Readiness Tracker',
    labelAr: 'متتبع الجاهزية',
    descEn: 'Monitor digital transformation readiness across entities',
    descAr: 'رصد جاهزية التحول الرقمي عبر الجهات الحكومية',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/40',
    emoji: '📊',
  },
  {
    key: 'policy',
    labelEn: 'Policy Pilot',
    labelAr: 'تجريب السياسات',
    descEn: 'Design and simulate small-scale policy experiments',
    descAr: 'تصميم ومحاكاة تجارب سياسية صغيرة النطاق',
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/10',
    borderColor: 'border-pink-500/40',
    emoji: '⚗️',
  },
  {
    key: 'coordination',
    labelEn: 'Inter-Entity Coordination',
    labelAr: 'التنسيق بين الجهات',
    descEn: 'Orchestrate cross-entity digital governance initiatives',
    descAr: 'تنسيق مبادرات الحوكمة الرقمية بين الجهات',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/40',
    emoji: '🤝',
  },
];

export function getCapMeta(key: CapKey): CapabilityMeta {
  return CAPABILITIES.find(c => c.key === key)!;
}
