"""
Governance Service — Topic Insights Collector
Builds topic-centric demand trends and recommendation signals from audit logs.
"""
from __future__ import annotations

import logging
import re
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

from storage.database import Database

logger = logging.getLogger("governance-service.topic_insights")


class TopicInsightsCollector:
    PERIOD_DELTAS = {
        "7d": timedelta(days=7),
        "30d": timedelta(days=30),
        "90d": timedelta(days=90),
    }

    TOPIC_TAXONOMY = [
        {
            "key": "passports_travel",
            "label_en": "Passports and Travel Documents",
            "label_ar": "الجوازات ووثائق السفر",
            "keywords": {
                "passport", "passports", "visa", "visas", "residency", "residence permit",
                "travel document", "renew passport", "جواز", "الجواز", "الجوازات", "تاشيرة",
                "تأشيرة", "اقامة", "إقامة", "سفر", "تصريح سفر",
            },
        },
        {
            "key": "labor_employment",
            "label_en": "Labor and Employment",
            "label_ar": "العمل وحقوق الموظفين",
            "keywords": {
                "labor", "employment", "worker", "salary", "contract", "leave", "overtime",
                "unemployment", "عمل", "عمال", "موظف", "موظفين", "راتب", "رواتب", "عقد",
                "اجازة", "إجازة", "ساعات عمل",
            },
        },
        {
            "key": "education",
            "label_en": "Education and Scholarships",
            "label_ar": "التعليم والمنح",
            "keywords": {
                "education", "school", "university", "scholarship", "student", "students",
                "curriculum", "tuition", "تعليم", "مدرسة", "مدارس", "جامعة", "جامعات", "منحة",
                "منح", "طالب", "طلاب", "قبول جامعي",
            },
        },
        {
            "key": "healthcare",
            "label_en": "Healthcare and Medical Services",
            "label_ar": "الصحة والخدمات الطبية",
            "keywords": {
                "health", "healthcare", "medical", "hospital", "insurance", "clinic", "medicine",
                "appointment", "صحة", "صحي", "مستشفى", "مستشفيات", "عيادة", "تأمين صحي", "دواء",
                "مواعيد طبية", "طبيب",
            },
        },
        {
            "key": "tax_finance",
            "label_en": "Tax and Public Finance",
            "label_ar": "الضرائب والمالية العامة",
            "keywords": {
                "tax", "taxes", "finance", "vat", "customs", "invoice", "financial", "budget",
                "ضريبة", "ضرائب", "مالية", "جمارك", "فاتورة", "رسوم", "موازنة",
            },
        },
        {
            "key": "business_investment",
            "label_en": "Business Licensing and Investment",
            "label_ar": "تراخيص الأعمال والاستثمار",
            "keywords": {
                "business", "company", "registration", "license", "licensing", "investment",
                "entrepreneur", "startup", "commercial", "company law", "شركة", "شركات", "ترخيص",
                "رخصة", "سجل تجاري", "استثمار", "مستثمر", "ريادة",
            },
        },
        {
            "key": "justice_legal",
            "label_en": "Justice and Legal Affairs",
            "label_ar": "العدل والشؤون القانونية",
            "keywords": {
                "law", "legal", "court", "judiciary", "crime", "penalty", "attorney", "litigation",
                "قانون", "قوانين", "قضية", "قضايا", "محكمة", "محاكم", "عدالة", "جريمة", "عقوبة",
                "دعوى", "تشريع",
            },
        },
        {
            "key": "social_protection",
            "label_en": "Social Protection and Support",
            "label_ar": "الحماية الاجتماعية والدعم",
            "keywords": {
                "social", "support", "aid", "benefits", "pension", "welfare", "subsidy", "family",
                "دعم", "مساعدة", "مساعدات", "ضمان", "اجتماعي", "تقاعد", "معونة", "اسرة", "أسرة",
            },
        },
        {
            "key": "transport_traffic",
            "label_en": "Transport and Traffic",
            "label_ar": "النقل والسير",
            "keywords": {
                "transport", "traffic", "vehicle", "driving", "license renewal", "public transport",
                "نقل", "مرور", "مركبة", "مركبات", "رخصة قيادة", "ترخيص مركبة", "سير",
            },
        },
        {
            "key": "environment_energy",
            "label_en": "Environment, Water, and Energy",
            "label_ar": "البيئة والمياه والطاقة",
            "keywords": {
                "environment", "water", "energy", "electricity", "solar", "climate", "pollution",
                "بيئة", "مياه", "طاقة", "كهرباء", "مناخ", "تلوث", "طاقة شمسية",
            },
        },
    ]

    AR_STOPWORDS = {
        "ما", "ماذا", "كيف", "هل", "من", "الى", "إلى", "عن", "في", "على", "مع", "هذا", "هذه",
        "ذلك", "تلك", "هناك", "هنا", "انا", "نحن", "هو", "هي", "هم", "هن", "او", "أو", "ثم",
        "اذا", "إذا", "بعد", "قبل", "حتى", "اي", "أي", "التي", "الذي", "الذين", "و", "او", "ال",
        "قانون", "مادة", "مواد", "قرار", "نظام", "تعليمات",
    }

    EN_STOPWORDS = {
        "what", "how", "when", "where", "which", "who", "is", "are", "can", "could", "should",
        "about", "for", "with", "from", "into", "that", "this", "those", "these", "the", "a", "an",
        "please", "tell", "me", "we", "i", "you", "they", "law", "regulation", "policy",
    }

    def __init__(self):
        self.db = Database()
        self._taxonomy_by_key = {item["key"]: item for item in self.TOPIC_TAXONOMY}

    def collect(self, period: str = "30d", top_k: int = 8) -> dict:
        window = self.PERIOD_DELTAS.get(period, self.PERIOD_DELTAS["30d"])
        now = datetime.now(timezone.utc)
        window_start = now - window
        previous_start = window_start - window

        current_records = self.db.list_audit_window(
            date_from=window_start.isoformat(),
            date_to=now.isoformat(),
        )
        previous_records = self.db.list_audit_window(
            date_from=previous_start.isoformat(),
            date_to=window_start.isoformat(),
        )

        topic_stats: dict[str, dict] = {}
        topic_daily_counts: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        current_counts: Counter[str] = Counter()
        previous_counts: Counter[str] = Counter()
        total_queries = len(current_records)

        for record in current_records:
            query = (record.get("query") or "").strip()
            if not query:
                continue
            topic = self._extract_topic(query, record.get("sector"))
            topic_key = topic["topic_key"]
            current_counts[topic_key] += 1

            if topic_key not in topic_stats:
                topic_stats[topic_key] = {
                    "topic_key": topic_key,
                    "label_en": topic["label_en"],
                    "label_ar": topic["label_ar"],
                    "count": 0,
                    "confidence_sum": 0.0,
                    "confidence_count": 0,
                    "escalated_count": 0,
                    "rejected_count": 0,
                    "latency_sum": 0.0,
                    "latency_count": 0,
                    "sample_queries": [],
                }

            item = topic_stats[topic_key]
            item["count"] += 1

            confidence = record.get("confidence")
            if confidence is not None:
                try:
                    item["confidence_sum"] += float(confidence)
                    item["confidence_count"] += 1
                except Exception:
                    pass

            if bool(record.get("escalated", False)):
                item["escalated_count"] += 1

            input_passed = bool(record.get("input_passed", True))
            output_passed = bool(record.get("output_passed", True))
            if not input_passed or not output_passed:
                item["rejected_count"] += 1

            latency_ms = record.get("total_latency_ms")
            if latency_ms is not None:
                try:
                    item["latency_sum"] += float(latency_ms)
                    item["latency_count"] += 1
                except Exception:
                    pass

            if len(item["sample_queries"]) < 3 and query not in item["sample_queries"]:
                item["sample_queries"].append(query)

            created_at = self._parse_timestamp(record.get("created_at"))
            if created_at is not None:
                day_key = created_at.date().isoformat()
                topic_daily_counts[topic_key][day_key] += 1

        for record in previous_records:
            query = (record.get("query") or "").strip()
            if not query:
                continue
            topic = self._extract_topic(query, record.get("sector"))
            previous_counts[topic["topic_key"]] += 1

        analyzed_queries = int(sum(current_counts.values()))
        top_topics = self._build_top_topics(topic_stats, analyzed_queries, top_k)
        rising_topics = self._build_rising_topics(current_counts, previous_counts, top_k)
        trend_series = self._build_trend_series(top_topics, topic_daily_counts, window_start, now)

        recommendations_admin = self._build_admin_recommendations(top_topics)
        recommendations_executive = self._build_executive_recommendations(top_topics, rising_topics)

        return {
            "period": period if period in self.PERIOD_DELTAS else "30d",
            "window_start": window_start.isoformat(),
            "window_end": now.isoformat(),
            "total_queries": total_queries,
            "analyzed_queries": analyzed_queries,
            "top_topics": top_topics,
            "rising_topics": rising_topics,
            "trend_series": trend_series,
            "recommendations_admin": recommendations_admin,
            "recommendations_executive": recommendations_executive,
        }

    def _build_top_topics(self, topic_stats: dict[str, dict], analyzed_queries: int, top_k: int) -> list[dict]:
        rows = []
        for item in topic_stats.values():
            count = int(item["count"])
            confidence_count = item["confidence_count"]
            latency_count = item["latency_count"]

            rows.append(
                {
                    "topic_key": item["topic_key"],
                    "label_en": item["label_en"],
                    "label_ar": item["label_ar"],
                    "count": count,
                    "share": round((count / analyzed_queries), 4) if analyzed_queries > 0 else 0.0,
                    "avg_confidence": round(item["confidence_sum"] / confidence_count, 3)
                    if confidence_count > 0
                    else None,
                    "escalation_rate": round(item["escalated_count"] / count, 3) if count > 0 else 0.0,
                    "guardrail_rejection_rate": round(item["rejected_count"] / count, 3) if count > 0 else 0.0,
                    "avg_latency_ms": round(item["latency_sum"] / latency_count, 1)
                    if latency_count > 0
                    else None,
                    "sample_queries": item["sample_queries"],
                }
            )

        rows.sort(key=lambda x: (-x["count"], x["topic_key"]))
        return rows[: max(3, min(top_k, 20))]

    def _build_rising_topics(self, current_counts: Counter[str], previous_counts: Counter[str], top_k: int) -> list[dict]:
        rows = []
        all_keys = set(current_counts.keys()) | set(previous_counts.keys())

        for topic_key in all_keys:
            current = int(current_counts.get(topic_key, 0))
            previous = int(previous_counts.get(topic_key, 0))
            delta = current - previous

            if current < 2 or delta <= 0:
                continue

            taxonomy = self._taxonomy_by_key.get(topic_key)
            label_en = taxonomy["label_en"] if taxonomy else topic_key.replace("_", " ")
            label_ar = taxonomy["label_ar"] if taxonomy else topic_key.replace("_", " ")
            growth_rate = None if previous == 0 else round(delta / previous, 3)
            breakout = previous == 0 and current >= 3

            rows.append(
                {
                    "topic_key": topic_key,
                    "label_en": label_en,
                    "label_ar": label_ar,
                    "current_count": current,
                    "previous_count": previous,
                    "delta": delta,
                    "growth_rate": growth_rate,
                    "breakout": breakout,
                }
            )

        rows.sort(
            key=lambda x: (
                0 if x["breakout"] else 1,
                -x["delta"],
                -(x["growth_rate"] or 0.0),
                x["topic_key"],
            )
        )
        return rows[: max(3, min(top_k, 20))]

    def _build_trend_series(
        self,
        top_topics: list[dict],
        topic_daily_counts: dict[str, dict[str, int]],
        window_start: datetime,
        window_end: datetime,
    ) -> list[dict]:
        trend_topic_keys = [item["topic_key"] for item in top_topics[:5]]
        if not trend_topic_keys:
            return []

        day_cursor = window_start.date()
        day_end = window_end.date()
        all_days: list[str] = []
        while day_cursor <= day_end:
            all_days.append(day_cursor.isoformat())
            day_cursor += timedelta(days=1)

        result = []
        for topic_key in trend_topic_keys:
            taxonomy = self._taxonomy_by_key.get(topic_key)
            label_en = taxonomy["label_en"] if taxonomy else topic_key.replace("_", " ")
            label_ar = taxonomy["label_ar"] if taxonomy else topic_key.replace("_", " ")
            day_map = topic_daily_counts.get(topic_key, {})
            points = [{"date": day, "count": int(day_map.get(day, 0))} for day in all_days]
            result.append(
                {
                    "topic_key": topic_key,
                    "label_en": label_en,
                    "label_ar": label_ar,
                    "total": int(sum(day_map.values())),
                    "points": points,
                }
            )
        return result

    def _build_admin_recommendations(self, top_topics: list[dict]) -> list[dict]:
        recommendations = []

        for topic in top_topics[:4]:
            topic_name_en = topic["label_en"]
            topic_name_ar = topic["label_ar"]
            escalation_rate = float(topic.get("escalation_rate") or 0.0)
            rejection_rate = float(topic.get("guardrail_rejection_rate") or 0.0)
            avg_confidence = float(topic.get("avg_confidence") or 0.0)

            if rejection_rate >= 0.1:
                title_en = f"Strengthen guardrails for {topic_name_en}"
                title_ar = f"تعزيز ضوابط الحوكمة لموضوع {topic_name_ar}"
                rationale_en = "This topic shows elevated guardrail rejections, indicating ambiguous or risky phrasing patterns."
                rationale_ar = "هذا الموضوع يظهر معدل رفض مرتفع من ضوابط الحوكمة، مما يدل على وجود صياغات غامضة أو عالية المخاطر."
                suggested_rule = "Add targeted input/output guardrail rules with explicit safe-response templates for this topic."
                suggested_solution = "Run a weekly rule-tuning cycle using rejected-query clusters from this topic."
                priority = "high"
            elif avg_confidence < 0.45:
                title_en = f"Curate a high-confidence knowledge pack for {topic_name_en}"
                title_ar = f"بناء حزمة معرفة عالية الثقة لموضوع {topic_name_ar}"
                rationale_en = "Demand is high while answer confidence remains low, suggesting evidence gaps."
                rationale_ar = "الطلب مرتفع بينما ثقة الإجابات منخفضة، مما يشير إلى فجوات في الأدلة المرجعية."
                suggested_rule = "Enforce minimum citation count and ministry-source alignment checks for this topic."
                suggested_solution = "Prioritize ingestion of official documents and create canonical FAQ entries for this topic."
                priority = "high"
            elif escalation_rate >= 0.2:
                title_en = f"Create escalation runbook for {topic_name_en}"
                title_ar = f"إنشاء مسار تصعيد تشغيلي لموضوع {topic_name_ar}"
                rationale_en = "This topic has frequent escalations, so operators need consistent case-handling guidance."
                rationale_ar = "هذا الموضوع يشهد تصعيدات متكررة، لذلك يحتاج فريق التشغيل إلى آلية موحدة للتعامل مع الحالات."
                suggested_rule = "Route low-confidence cases in this topic to a specialized queue with SLA tagging."
                suggested_solution = "Publish an expert runbook and reusable response templates for first-line reviewers."
                priority = "medium"
            else:
                title_en = f"Publish self-service solution set for {topic_name_en}"
                title_ar = f"نشر حلول خدمة ذاتية لموضوع {topic_name_ar}"
                rationale_en = "High recurring demand with stable quality makes this topic suitable for self-service optimization."
                rationale_ar = "الطلب المتكرر مع جودة مستقرة يجعل هذا الموضوع مناسباً للتحسين عبر الخدمة الذاتية."
                suggested_rule = "Auto-suggest approved FAQ snippets before full generation for this topic."
                suggested_solution = "Deploy a proactive FAQ + guided flow to reduce repeat queries and support load."
                priority = "medium"

            recommendations.append(
                {
                    "target": "admin",
                    "topic_key": topic["topic_key"],
                    "topic_label_en": topic_name_en,
                    "topic_label_ar": topic_name_ar,
                    "priority": priority,
                    "title_en": title_en,
                    "title_ar": title_ar,
                    "rationale_en": rationale_en,
                    "rationale_ar": rationale_ar,
                    "suggested_rule": suggested_rule,
                    "suggested_solution": suggested_solution,
                }
            )

        return recommendations

    def _build_executive_recommendations(self, top_topics: list[dict], rising_topics: list[dict]) -> list[dict]:
        recommendations = []
        rising_keys = {item["topic_key"] for item in rising_topics[:6]}

        for topic in top_topics[:4]:
            topic_name_en = topic["label_en"]
            topic_name_ar = topic["label_ar"]
            share = float(topic.get("share") or 0.0)
            escalation_rate = float(topic.get("escalation_rate") or 0.0)
            avg_confidence = float(topic.get("avg_confidence") or 0.0)
            is_rising = topic["topic_key"] in rising_keys

            if share >= 0.2 and (avg_confidence < 0.5 or escalation_rate >= 0.2):
                title_en = f"Launch executive policy intervention for {topic_name_en}"
                title_ar = f"إطلاق تدخل سياساتي تنفيذي لموضوع {topic_name_ar}"
                rationale_en = "This topic combines high public demand with quality-risk indicators, requiring strategic action."
                rationale_ar = "هذا الموضوع يجمع بين طلب مرتفع ومؤشرات مخاطر جودة، مما يتطلب تدخلاً استراتيجياً."
                suggested_solution = "Initiate a cross-ministry taskforce and define a 60-day service-improvement roadmap."
                priority = "high"
            elif is_rising:
                title_en = f"Prepare proactive initiative for rising topic: {topic_name_en}"
                title_ar = f"الاستعداد لمبادرة استباقية لموضوع صاعد: {topic_name_ar}"
                rationale_en = "Rapid growth suggests an emerging policy need before operational pressure peaks."
                rationale_ar = "النمو السريع يشير إلى حاجة سياساتية ناشئة قبل وصول الضغط التشغيلي إلى الذروة."
                suggested_solution = "Approve an early policy communication package and targeted digital service updates."
                priority = "high"
            else:
                title_en = f"Scale service performance for {topic_name_en}"
                title_ar = f"توسيع كفاءة الخدمة لموضوع {topic_name_ar}"
                rationale_en = "Sustained demand makes this topic a strong candidate for measurable service-quality upgrades."
                rationale_ar = "استمرار الطلب يجعل هذا الموضوع مرشحاً قوياً لتحسينات قابلة للقياس في جودة الخدمة."
                suggested_solution = "Set KPI targets for turnaround, confidence, and escalation reduction in this topic."
                priority = "medium"

            recommendations.append(
                {
                    "target": "executive",
                    "topic_key": topic["topic_key"],
                    "topic_label_en": topic_name_en,
                    "topic_label_ar": topic_name_ar,
                    "priority": priority,
                    "title_en": title_en,
                    "title_ar": title_ar,
                    "rationale_en": rationale_en,
                    "rationale_ar": rationale_ar,
                    "suggested_rule": "Adopt a topic-specific governance policy review cadence in monthly leadership meetings.",
                    "suggested_solution": suggested_solution,
                }
            )

        return recommendations

    def _extract_topic(self, query: str, sector: str | None = None) -> dict:
        normalized = self._normalize_text(query)

        for topic in self.TOPIC_TAXONOMY:
            for keyword in topic["keywords"]:
                kw = self._normalize_text(keyword)
                if kw and kw in normalized:
                    return {
                        "topic_key": topic["key"],
                        "label_en": topic["label_en"],
                        "label_ar": topic["label_ar"],
                    }

        if sector:
            sector_normalized = self._normalize_text(sector)
            for topic in self.TOPIC_TAXONOMY:
                if sector_normalized and sector_normalized in topic["key"]:
                    return {
                        "topic_key": topic["key"],
                        "label_en": topic["label_en"],
                        "label_ar": topic["label_ar"],
                    }

        phrase = self._extract_fallback_phrase(query)
        if phrase:
            phrase_key = self._slugify_topic_key(phrase)
            return {
                "topic_key": phrase_key,
                "label_en": phrase,
                "label_ar": phrase,
            }

        return {
            "topic_key": "general_policy",
            "label_en": "General Policy Inquiries",
            "label_ar": "استفسارات سياسات عامة",
        }

    def _extract_fallback_phrase(self, query: str) -> str:
        normalized = self._normalize_text(query)
        tokens = re.findall(r"[A-Za-z0-9\u0600-\u06FF]+", normalized)
        if not tokens:
            return ""

        stopwords = self.EN_STOPWORDS | self.AR_STOPWORDS
        meaningful = [t for t in tokens if len(t) >= 3 and t not in stopwords and not t.isdigit()]
        if not meaningful:
            meaningful = [t for t in tokens if t not in stopwords and not t.isdigit()]

        phrase = " ".join(meaningful[:2]).strip()
        return phrase

    @staticmethod
    def _slugify_topic_key(text: str) -> str:
        lowered = text.lower().strip()
        lowered = re.sub(r"\s+", "_", lowered)
        lowered = re.sub(r"[^a-z0-9_\u0600-\u06FF]", "", lowered)
        return lowered[:48] if lowered else "general_policy"

    @staticmethod
    def _normalize_text(text: str) -> str:
        if not text:
            return ""

        value = str(text).lower()
        value = value.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا")
        value = value.replace("ة", "ه").replace("ى", "ي")
        value = re.sub(r"[\u064b-\u065f\u0670\u0640]", "", value)
        value = re.sub(r"[^\w\s\u0600-\u06FF]", " ", value)
        value = re.sub(r"\s+", " ", value).strip()
        return value

    @staticmethod
    def _parse_timestamp(value) -> datetime | None:
        if value is None:
            return None
        if isinstance(value, datetime):
            dt = value
        else:
            text = str(value).strip()
            if not text:
                return None
            if text.endswith("Z"):
                text = text[:-1] + "+00:00"
            try:
                dt = datetime.fromisoformat(text)
            except Exception:
                return None

        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
