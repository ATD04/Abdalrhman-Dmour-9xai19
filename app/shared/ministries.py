"""
Shared Ministry Registry — Single Source of Truth
All ministry/agent identifiers, labels, and mappings live here.

To add a new ministry:
  1. Add an entry to MINISTRY_REGISTRY below
  2. Run the SQL partition creation (or restart services — _ensure_partitions() auto-creates)
  3. Done. All services import from here.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class MinistryInfo:
    """Metadata for a single ministry/agent."""
    agent_key: str          # Lowercase key used in DB: "labor_agent"
    label_en: str           # English display name
    label_ar: str           # Arabic display name
    scope_en: str           # English scope description for router prompts
    scope_ar: str           # Arabic scope description for router prompts
    topics_en: list[str]    # English topic keywords for A2A matching
    topics_ar: list[str]    # Arabic topic keywords for A2A matching
    sector: str             # High-level sector mapping for routing


# ─── Authoritative Registry ──────────────────────────────────────────────────

MINISTRY_REGISTRY: dict[str, MinistryInfo] = {
    "civil_status_agent": MinistryInfo(
        agent_key="civil_status_agent",
        label_en="Civil Status Dept.",
        label_ar="الأحوال المدنية",
        scope_en=(
            "Civil status and vital records, birth certificates, death "
            "certificates, marriage registration and documentation, divorce "
            "records, national ID cards, family book (daftar al-'a'ilah), "
            "name changes, nationality and citizenship, passport-related "
            "civil status requirements, civil registration procedures."
        ),
        scope_ar=(
            "الأحوال المدنية والسجل المدني، شهادات الميلاد، شهادات الوفاة، "
            "تسجيل الزواج وتوثيقه، سجلات الطلاق، بطاقة الهوية الوطنية، "
            "دفتر العائلة، تغيير الاسم، الجنسية والمواطنة، "
            "متطلبات الأحوال المدنية المتعلقة بجواز السفر، إجراءات التسجيل المدني."
        ),
        topics_en=[
            "birth certificate", "death certificate", "marriage registration",
            "divorce record", "national ID", "family book", "name change",
            "nationality", "citizenship", "civil registration",
            "vital records", "civil status",
        ],
        topics_ar=[
            "شهادة ميلاد", "شهادة وفاة", "تسجيل زواج",
            "سجل طلاق", "بطاقة الهوية", "دفتر العائلة", "تغيير الاسم",
            "الجنسية", "المواطنة", "التسجيل المدني",
            "السجل المدني", "الأحوال المدنية",
        ],
        sector="interior",
    ),
    "civil_service_agent": MinistryInfo(
        agent_key="civil_service_agent",
        label_en="Civil Service Bureau",
        label_ar="ديوان الخدمة المدنية",
        scope_en=(
            "Civil service regulations, government employment and hiring, "
            "civil servant rights, duties, and classifications, salary scales, "
            "promotions, transfers between government entities, retirement "
            "and pension benefits, employee discipline and grievances, "
            "public sector job announcements, government training programmes."
        ),
        scope_ar=(
            "أنظمة الخدمة المدنية، التوظيف الحكومي والتعيين، حقوق وواجبات "
            "الموظف العام، التصنيف الوظيفي، سلم الرواتب، الترقيات، النقل بين "
            "الجهات الحكومية، التقاعد والمعاشات، تأديب الموظفين والتظلمات، "
            "إعلانات الوظائف الحكومية، برامج التدريب الحكومية."
        ),
        topics_en=[
            "civil service law", "government jobs", "public sector employment",
            "salary scale", "promotion criteria", "employee transfer",
            "retirement benefits", "pension", "disciplinary action",
            "civil service bureau",
        ],
        topics_ar=[
            "قانون الخدمة المدنية", "الوظائف الحكومية", "التوظيف في القطاع العام",
            "سلم الرواتب", "معايير الترقية", "نقل الموظف",
            "مزايا التقاعد", "المعاش", "الإجراءات التأديبية",
            "ديوان الخدمة المدنية",
        ],
        sector="general",
    ),
    "labor_agent": MinistryInfo(
        agent_key="labor_agent",
        label_en="Ministry of Labor",
        label_ar="وزارة العمل",
        scope_en=(
            "Labor law and employment regulations in the private sector, "
            "worker rights and employer obligations, work contracts, wages, "
            "working hours, annual leave, sick leave, maternity leave, "
            "workplace safety and occupational health, termination and severance, "
            "labor disputes and mediation, work permits for foreign workers, "
            "social security contributions, trade unions."
        ),
        scope_ar=(
            "قانون العمل وأنظمة التوظيف في القطاع الخاص، حقوق العمال "
            "والتزامات أصحاب العمل، عقود العمل، الأجور، ساعات العمل، "
            "الإجازة السنوية، الإجازة المرضية، إجازة الأمومة، السلامة المهنية، "
            "الفصل من العمل ومكافأة نهاية الخدمة، النزاعات العمالية والوساطة، "
            "تصاريح العمل للعمالة الوافدة، الضمان الاجتماعي، النقابات."
        ),
        topics_en=[
            "labor law", "employment contract", "worker rights",
            "employer obligations", "wages", "working hours", "annual leave",
            "termination", "severance pay", "work permit",
            "social security", "workplace safety", "labor dispute",
        ],
        topics_ar=[
            "قانون العمل", "عقد العمل", "حقوق العامل",
            "التزامات صاحب العمل", "الأجور", "ساعات العمل", "الإجازة السنوية",
            "الفصل", "مكافأة نهاية الخدمة", "تصريح العمل",
            "الضمان الاجتماعي", "السلامة المهنية", "النزاع العمالي",
        ],
        sector="labor",
    ),
    "justice_agent": MinistryInfo(
        agent_key="justice_agent",
        label_en="Ministry of Justice",
        label_ar="وزارة العدل",
        scope_en=(
            "Judicial system and court procedures, civil litigation, "
            "criminal proceedings, family law, personal status law, "
            "inheritance and wills, notarisation and legal documentation, "
            "legal aid, judicial fees and stamps, enforcement of judgments, "
            "arbitration, mediation, bar association and lawyer licensing, "
            "penal code, criminal penalties."
        ),
        scope_ar=(
            "الجهاز القضائي وإجراءات المحاكم، الدعاوى المدنية، الإجراءات "
            "الجزائية، قانون الأسرة، قانون الأحوال الشخصية، الميراث والوصايا، "
            "التوثيق والكتابة العدلية، المساعدة القانونية، الرسوم القضائية، "
            "تنفيذ الأحكام، التحكيم، الوساطة، نقابة المحامين وترخيص المحاماة، "
            "قانون العقوبات، العقوبات الجزائية."
        ),
        topics_en=[
            "court procedures", "civil lawsuit", "criminal proceedings",
            "family law", "personal status", "inheritance", "wills",
            "notarization", "legal aid", "judicial fees", "judgments",
            "arbitration", "penal code", "criminal penalties", "bar association",
        ],
        topics_ar=[
            "إجراءات المحاكم", "الدعوى المدنية", "الإجراءات الجزائية",
            "قانون الأسرة", "الأحوال الشخصية", "الميراث", "الوصايا",
            "التوثيق", "المساعدة القانونية", "الرسوم القضائية", "الأحكام",
            "التحكيم", "قانون العقوبات", "العقوبات الجزائية", "نقابة المحامين",
        ],
        sector="justice",
    ),
    "digital_economy_agent": MinistryInfo(
        agent_key="digital_economy_agent",
        label_en="Digital Economy",
        label_ar="الاقتصاد الرقمي",
        scope_en=(
            "Digital economy and e-government services, digital transformation, "
            "ICT regulations, cybersecurity, e-commerce, innovation policy."
        ),
        scope_ar=(
            "الاقتصاد الرقمي وخدمات الحكومة الإلكترونية، التحول الرقمي، "
            "أنظمة تكنولوجيا المعلومات والاتصالات، الأمن السيبراني، التجارة الإلكترونية."
        ),
        topics_en=[
            "digital economy", "e-government", "digital transformation",
            "ICT", "cybersecurity", "e-commerce",
        ],
        topics_ar=[
            "الاقتصاد الرقمي", "الحكومة الإلكترونية", "التحول الرقمي",
            "تكنولوجيا المعلومات", "الأمن السيبراني", "التجارة الإلكترونية",
        ],
        sector="digital",
    ),
}


# ─── Derived Constants ────────────────────────────────────────────────────────
# Used by services that just need the flat sets/lists.

ALLOWED_MINISTRY_NAMES: set[str] = set(MINISTRY_REGISTRY.keys())
"""Set of valid ministry_name values for validation."""

VALID_MINISTRY_TYPES: list[str] = list(MINISTRY_REGISTRY.keys()) + ["general"]
"""Valid ministry_type values (includes 'general' for unclassified docs)."""

AGENT_MINISTRY_MAP: dict[str, str] = {k.upper(): k for k in MINISTRY_REGISTRY}
"""Maps uppercase agent IDs (LABOR_AGENT) to lowercase ministry_name (labor_agent)."""

AGENT_LABELS_EN: dict[str, str] = {
    k.upper(): v.label_en for k, v in MINISTRY_REGISTRY.items()
}
"""Maps uppercase agent IDs to English display labels."""

AGENT_LABELS_AR: dict[str, str] = {
    k.upper(): v.label_ar for k, v in MINISTRY_REGISTRY.items()
}
"""Maps uppercase agent IDs to Arabic display labels."""

DEFAULT_MINISTRY = "general"
"""Default ministry_name for unclassified documents and the DEFAULT partition."""

MINISTRY_PARTITION_NAMES: list[str] = list(MINISTRY_REGISTRY.keys())
"""Ordered list of ministry keys for partition creation."""
