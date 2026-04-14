import type {
  RisingTopic,
  TopicInsightsResult,
  TopicRecommendation,
  TopicStat,
  TopicTrendSeries,
} from "@/lib/api";
import type { ChatConversationRecord, ChatMessageRecord } from "@/lib/chat-history";

type SupportedPeriod = "7d" | "30d" | "90d";

type TopicDefinition = {
  key: string;
  label_en: string;
  label_ar: string;
  keywords: string[];
};

type HistoryQueryRecord = {
  query: string;
  created_at: string;
  confidence: number | null;
  escalated: boolean;
};

const PERIOD_TO_DAYS: Record<SupportedPeriod, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

const TOPIC_TAXONOMY: TopicDefinition[] = [
  {
    key: "passports_travel",
    label_en: "Passports and Travel Documents",
    label_ar: "الجوازات ووثائق السفر",
    keywords: [
      "passport", "passports", "visa", "visas", "residency", "residence permit",
      "travel document", "renew passport", "جواز", "الجواز", "الجوازات", "تاشيرة",
      "تأشيرة", "اقامة", "إقامة", "سفر", "تصريح سفر",
    ],
  },
  {
    key: "labor_employment",
    label_en: "Labor and Employment",
    label_ar: "العمل وحقوق الموظفين",
    keywords: [
      "labor", "employment", "worker", "salary", "contract", "leave", "overtime",
      "unemployment", "عمل", "عمال", "موظف", "موظفين", "راتب", "رواتب", "عقد",
      "اجازة", "إجازة", "ساعات عمل",
    ],
  },
  {
    key: "education",
    label_en: "Education and Scholarships",
    label_ar: "التعليم والمنح",
    keywords: [
      "education", "school", "university", "scholarship", "student", "students",
      "curriculum", "tuition", "تعليم", "مدرسة", "مدارس", "جامعة", "جامعات", "منحة",
      "منح", "طالب", "طلاب", "قبول جامعي",
    ],
  },
  {
    key: "healthcare",
    label_en: "Healthcare and Medical Services",
    label_ar: "الصحة والخدمات الطبية",
    keywords: [
      "health", "healthcare", "medical", "hospital", "insurance", "clinic", "medicine",
      "appointment", "صحة", "صحي", "مستشفى", "مستشفيات", "عيادة", "تأمين صحي", "دواء",
      "مواعيد طبية", "طبيب",
    ],
  },
  {
    key: "tax_finance",
    label_en: "Tax and Public Finance",
    label_ar: "الضرائب والمالية العامة",
    keywords: [
      "tax", "taxes", "finance", "vat", "customs", "invoice", "financial", "budget",
      "ضريبة", "ضرائب", "مالية", "جمارك", "فاتورة", "رسوم", "موازنة",
    ],
  },
  {
    key: "business_investment",
    label_en: "Business Licensing and Investment",
    label_ar: "تراخيص الأعمال والاستثمار",
    keywords: [
      "business", "company", "registration", "license", "licensing", "investment",
      "entrepreneur", "startup", "commercial", "company law", "شركة", "شركات", "ترخيص",
      "رخصة", "سجل تجاري", "استثمار", "مستثمر", "ريادة",
    ],
  },
  {
    key: "justice_legal",
    label_en: "Justice and Legal Affairs",
    label_ar: "العدل والشؤون القانونية",
    keywords: [
      "law", "legal", "court", "judiciary", "crime", "penalty", "attorney", "litigation",
      "قانون", "قوانين", "قضية", "قضايا", "محكمة", "محاكم", "عدالة", "جريمة", "عقوبة",
      "دعوى", "تشريع",
    ],
  },
  {
    key: "social_protection",
    label_en: "Social Protection and Support",
    label_ar: "الحماية الاجتماعية والدعم",
    keywords: [
      "social", "support", "aid", "benefits", "pension", "welfare", "subsidy", "family",
      "دعم", "مساعدة", "مساعدات", "ضمان", "اجتماعي", "تقاعد", "معونة", "اسرة", "أسرة",
    ],
  },
  {
    key: "transport_traffic",
    label_en: "Transport and Traffic",
    label_ar: "النقل والسير",
    keywords: [
      "transport", "traffic", "vehicle", "driving", "license renewal", "public transport",
      "نقل", "مرور", "مركبة", "مركبات", "رخصة قيادة", "ترخيص مركبة", "سير",
    ],
  },
  {
    key: "environment_energy",
    label_en: "Environment, Water, and Energy",
    label_ar: "البيئة والمياه والطاقة",
    keywords: [
      "environment", "water", "energy", "electricity", "solar", "climate", "pollution",
      "بيئة", "مياه", "طاقة", "كهرباء", "مناخ", "تلوث", "طاقة شمسية",
    ],
  },
];

const AR_STOPWORDS = new Set([
  "ما", "ماذا", "كيف", "هل", "من", "الى", "إلى", "عن", "في", "على", "مع", "هذا", "هذه",
  "ذلك", "تلك", "هناك", "هنا", "انا", "نحن", "هو", "هي", "هم", "هن", "او", "أو", "ثم",
  "اذا", "إذا", "بعد", "قبل", "حتى", "اي", "أي", "التي", "الذي", "الذين", "و", "ال",
  "قانون", "مادة", "مواد", "قرار", "نظام", "تعليمات",
]);

const EN_STOPWORDS = new Set([
  "what", "how", "when", "where", "which", "who", "is", "are", "can", "could", "should",
  "about", "for", "with", "from", "into", "that", "this", "those", "these", "the", "a", "an",
  "please", "tell", "me", "we", "i", "you", "they", "law", "regulation", "policy",
]);

const TOPIC_BY_KEY = new Map(TOPIC_TAXONOMY.map((topic) => [topic.key, topic]));

export function buildTopicInsightsFromChatHistory(
  conversations: ChatConversationRecord[],
  period: SupportedPeriod = "30d",
  topK: number = 8,
): TopicInsightsResult {
  const normalizedPeriod = period in PERIOD_TO_DAYS ? period : "30d";
  const now = new Date();
  const currentWindowMs = PERIOD_TO_DAYS[normalizedPeriod] * 24 * 60 * 60 * 1000;
  const windowStart = new Date(now.getTime() - currentWindowMs);
  const previousStart = new Date(windowStart.getTime() - currentWindowMs);
  const records = flattenHistoryQueries(conversations);

  const currentRecords = records.filter((record) => {
    const createdAt = new Date(record.created_at);
    return createdAt >= windowStart && createdAt <= now;
  });
  const previousRecords = records.filter((record) => {
    const createdAt = new Date(record.created_at);
    return createdAt >= previousStart && createdAt < windowStart;
  });

  const topicDailyCounts = new Map<string, Map<string, number>>();
  const currentCounts = new Map<string, number>();
  const previousCounts = new Map<string, number>();
  const topicStats = new Map<string, {
    topic_key: string;
    label_en: string;
    label_ar: string;
    count: number;
    confidence_sum: number;
    confidence_count: number;
    escalated_count: number;
    sample_queries: string[];
  }>();

  for (const record of currentRecords) {
    const topic = extractTopic(record.query);
    const dayKey = record.created_at.slice(0, 10);
    currentCounts.set(topic.topic_key, (currentCounts.get(topic.topic_key) || 0) + 1);

    if (!topicStats.has(topic.topic_key)) {
      topicStats.set(topic.topic_key, {
        topic_key: topic.topic_key,
        label_en: topic.label_en,
        label_ar: topic.label_ar,
        count: 0,
        confidence_sum: 0,
        confidence_count: 0,
        escalated_count: 0,
        sample_queries: [],
      });
    }

    const stat = topicStats.get(topic.topic_key)!;
    stat.count += 1;
    if (typeof record.confidence === "number") {
      stat.confidence_sum += record.confidence;
      stat.confidence_count += 1;
    }
    if (record.escalated) {
      stat.escalated_count += 1;
    }
    if (stat.sample_queries.length < 3 && !stat.sample_queries.includes(record.query)) {
      stat.sample_queries.push(record.query);
    }

    const existingDays = topicDailyCounts.get(topic.topic_key) || new Map<string, number>();
    existingDays.set(dayKey, (existingDays.get(dayKey) || 0) + 1);
    topicDailyCounts.set(topic.topic_key, existingDays);
  }

  for (const record of previousRecords) {
    const topic = extractTopic(record.query);
    previousCounts.set(topic.topic_key, (previousCounts.get(topic.topic_key) || 0) + 1);
  }

  const analyzedQueries = currentRecords.length;
  const topTopics = buildTopTopics(topicStats, analyzedQueries, topK);
  const risingTopics = buildRisingTopics(currentCounts, previousCounts, topK);
  const trendSeries = buildTrendSeries(topTopics, topicDailyCounts, windowStart, now);
  const recommendationsExecutive = buildExecutiveRecommendations(topTopics, risingTopics);

  return {
    period: normalizedPeriod,
    window_start: windowStart.toISOString(),
    window_end: now.toISOString(),
    total_queries: currentRecords.length,
    analyzed_queries: analyzedQueries,
    top_topics: topTopics,
    rising_topics: risingTopics,
    trend_series: trendSeries,
    recommendations_admin: [],
    recommendations_executive: recommendationsExecutive,
  };
}

function flattenHistoryQueries(conversations: ChatConversationRecord[]): HistoryQueryRecord[] {
  const rows: HistoryQueryRecord[] = [];

  for (const conversation of conversations) {
    const messages = Array.isArray(conversation.messages) ? conversation.messages : [];
    for (let index = 0; index < messages.length; index += 1) {
      const message = messages[index];
      if (message?.role !== "user" || !message.content?.trim()) {
        continue;
      }

      const createdAt = parseIso(message.timestamp) || parseIso(conversation.updatedAt);
      if (!createdAt) {
        continue;
      }

      const assistantReply = findNextAssistantMessage(messages, index + 1);
      rows.push({
        query: message.content.trim(),
        created_at: createdAt.toISOString(),
        confidence: typeof assistantReply?.confidence === "number" ? assistantReply.confidence : null,
        escalated: Boolean(assistantReply?.escalated),
      });
    }
  }

  return rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

function findNextAssistantMessage(messages: ChatMessageRecord[], startIndex: number): ChatMessageRecord | null {
  for (let index = startIndex; index < messages.length; index += 1) {
    const message = messages[index];
    if (message?.role === "assistant") {
      return message;
    }
    if (message?.role === "user") {
      return null;
    }
  }
  return null;
}

function buildTopTopics(
  topicStats: Map<string, {
    topic_key: string;
    label_en: string;
    label_ar: string;
    count: number;
    confidence_sum: number;
    confidence_count: number;
    escalated_count: number;
    sample_queries: string[];
  }>,
  analyzedQueries: number,
  topK: number,
): TopicStat[] {
  return Array.from(topicStats.values())
    .map((item) => ({
      topic_key: item.topic_key,
      label_en: item.label_en,
      label_ar: item.label_ar,
      count: item.count,
      share: analyzedQueries > 0 ? round(item.count / analyzedQueries, 4) : 0,
      avg_confidence: item.confidence_count > 0 ? round(item.confidence_sum / item.confidence_count, 3) : null,
      escalation_rate: item.count > 0 ? round(item.escalated_count / item.count, 3) : 0,
      guardrail_rejection_rate: 0,
      avg_latency_ms: null,
      sample_queries: item.sample_queries,
    }))
    .sort((left, right) => right.count - left.count || left.topic_key.localeCompare(right.topic_key))
    .slice(0, Math.max(3, Math.min(topK, 20)));
}

function buildRisingTopics(
  currentCounts: Map<string, number>,
  previousCounts: Map<string, number>,
  topK: number,
): RisingTopic[] {
  const keys = new Set<string>([...currentCounts.keys(), ...previousCounts.keys()]);
  const rows: RisingTopic[] = [];

  for (const topicKey of keys) {
    const current = currentCounts.get(topicKey) || 0;
    const previous = previousCounts.get(topicKey) || 0;
    const delta = current - previous;

    if (current < 2 || delta <= 0) {
      continue;
    }

    const topic = TOPIC_BY_KEY.get(topicKey);
    rows.push({
      topic_key: topicKey,
      label_en: topic?.label_en || topicKey.replaceAll("_", " "),
      label_ar: topic?.label_ar || topicKey.replaceAll("_", " "),
      current_count: current,
      previous_count: previous,
      delta,
      growth_rate: previous > 0 ? round(delta / previous, 3) : null,
      breakout: previous === 0 && current >= 3,
    });
  }

  return rows
    .sort((left, right) => {
      const breakoutRank = Number(right.breakout) - Number(left.breakout);
      if (breakoutRank !== 0) return breakoutRank;
      if (right.delta !== left.delta) return right.delta - left.delta;
      return (right.growth_rate || 0) - (left.growth_rate || 0);
    })
    .slice(0, Math.max(3, Math.min(topK, 20)));
}

function buildTrendSeries(
  topTopics: TopicStat[],
  topicDailyCounts: Map<string, Map<string, number>>,
  windowStart: Date,
  windowEnd: Date,
): TopicTrendSeries[] {
  const dayKeys: string[] = [];
  const cursor = new Date(windowStart);
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date(windowEnd);
  end.setUTCHours(0, 0, 0, 0);

  while (cursor <= end) {
    dayKeys.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return topTopics.slice(0, 5).map((topic) => {
    const counts = topicDailyCounts.get(topic.topic_key) || new Map<string, number>();
    return {
      topic_key: topic.topic_key,
      label_en: topic.label_en,
      label_ar: topic.label_ar,
      total: topic.count,
      points: dayKeys.map((date) => ({
        date,
        count: counts.get(date) || 0,
      })),
    };
  });
}

function buildExecutiveRecommendations(
  topTopics: TopicStat[],
  risingTopics: RisingTopic[],
): TopicRecommendation[] {
  const risingKeys = new Set(risingTopics.slice(0, 6).map((item) => item.topic_key));

  return topTopics.slice(0, 4).map((topic) => {
    const isRising = risingKeys.has(topic.topic_key);
    if (topic.share >= 0.2 && ((topic.avg_confidence || 0) < 0.5 || topic.escalation_rate >= 0.2)) {
      return {
        target: "admin",
        topic_key: topic.topic_key,
        topic_label_en: topic.label_en,
        topic_label_ar: topic.label_ar,
        priority: "high",
        title_en: `Launch executive policy intervention for ${topic.label_en}`,
        title_ar: `إطلاق تدخل سياساتي تنفيذي لموضوع ${topic.label_ar}`,
        rationale_en: "This topic combines high public demand with quality-risk indicators, requiring strategic action.",
        rationale_ar: "هذا الموضوع يجمع بين طلب مرتفع ومؤشرات مخاطر جودة، مما يتطلب تدخلاً استراتيجياً.",
        suggested_rule: "Adopt a topic-specific governance policy review cadence in monthly leadership meetings.",
        suggested_solution: "Initiate a cross-ministry taskforce and define a 60-day service-improvement roadmap.",
      };
    }

    if (isRising) {
      return {
        target: "admin",
        topic_key: topic.topic_key,
        topic_label_en: topic.label_en,
        topic_label_ar: topic.label_ar,
        priority: "high",
        title_en: `Prepare proactive initiative for rising topic: ${topic.label_en}`,
        title_ar: `الاستعداد لمبادرة استباقية لموضوع صاعد: ${topic.label_ar}`,
        rationale_en: "Rapid growth suggests an emerging policy need before operational pressure peaks.",
        rationale_ar: "النمو السريع يشير إلى حاجة سياساتية ناشئة قبل وصول الضغط التشغيلي إلى الذروة.",
        suggested_rule: "Adopt a topic-specific governance policy review cadence in monthly leadership meetings.",
        suggested_solution: "Approve an early policy communication package and targeted digital service updates.",
      };
    }

    return {
      target: "admin",
      topic_key: topic.topic_key,
      topic_label_en: topic.label_en,
      topic_label_ar: topic.label_ar,
      priority: "medium",
      title_en: `Scale service performance for ${topic.label_en}`,
      title_ar: `توسيع كفاءة الخدمة لموضوع ${topic.label_ar}`,
      rationale_en: "Sustained demand makes this topic a strong candidate for measurable service-quality upgrades.",
      rationale_ar: "استمرار الطلب يجعل هذا الموضوع مرشحاً قوياً لتحسينات قابلة للقياس في جودة الخدمة.",
      suggested_rule: "Adopt a topic-specific governance policy review cadence in monthly leadership meetings.",
      suggested_solution: "Set KPI targets for turnaround, confidence, and escalation reduction in this topic.",
    };
  });
}

function extractTopic(query: string): { topic_key: string; label_en: string; label_ar: string } {
  const normalized = normalizeText(query);

  for (const topic of TOPIC_TAXONOMY) {
    for (const keyword of topic.keywords) {
      if (normalizeText(keyword) && normalized.includes(normalizeText(keyword))) {
        return {
          topic_key: topic.key,
          label_en: topic.label_en,
          label_ar: topic.label_ar,
        };
      }
    }
  }

  const phrase = extractFallbackPhrase(query);
  if (phrase) {
    return {
      topic_key: slugifyTopicKey(phrase),
      label_en: phrase,
      label_ar: phrase,
    };
  }

  return {
    topic_key: "general_policy",
    label_en: "General Policy Inquiries",
    label_ar: "استفسارات سياسات عامة",
  };
}

function extractFallbackPhrase(query: string): string {
  const normalized = normalizeText(query);
  const tokens = normalized.match(/[A-Za-z0-9\u0600-\u06FF]+/g) || [];
  const stopwords = new Set<string>([...AR_STOPWORDS, ...EN_STOPWORDS]);
  let meaningful = tokens.filter((token) => token.length >= 3 && !stopwords.has(token) && !/^\d+$/.test(token));

  if (meaningful.length === 0) {
    meaningful = tokens.filter((token) => !stopwords.has(token) && !/^\d+$/.test(token));
  }

  return meaningful.slice(0, 2).join(" ").trim();
}

function slugifyTopicKey(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\u0600-\u06FF]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || "general_policy";
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s\u0600-\u06FF]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseIso(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function round(value: number, digits: number): number {
  return Number(value.toFixed(digits));
}
