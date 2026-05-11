"""
seed_personas.py — Seeds persona_definitions with the 10 official Jordanian
citizen archetypes from sysprompt.md §13.

Rules:
  - Runs only if persona_definitions is empty (idempotent).
  - All bias_tags use only the closed list from sysprompt.md §5.
  - Arabic strings are stored as UTF-8.
  - priority_tier is "core" for all 10 archetypes (not P0/P1/P2/P3/P4).
"""

from sqlalchemy.orm import Session

from app.models import PersonaDefinition

# ---------------------------------------------------------------------------
# Closed bias/heuristic list from sysprompt.md §5 — used for validation only.
# Any tag NOT in this set is rejected before insertion.
# ---------------------------------------------------------------------------
_ALLOWED_BIAS_TAGS: frozenset[str] = frozenset(
    [
        # §5.1 Universal cognitive biases
        "availability_heuristic",
        "anchoring",
        "recency_bias",
        "negativity_bias",
        "confirmation_bias",
        "attribution_error",
        "loss_aversion",
        "status_quo_bias",
        "optimism_bias",
        "present_bias",
        # §5.2 Jordan-contextual heuristics
        "wasta_attribution",
        "tribal_in_group_framing",
        "amman_vs_periphery_framing",
        "el_dawleh_wein_learned_helplessness",
        "gendered_family_honor_framing",
        "refugee_host_scarcity_framing",
        "east_banker_palestinian_zero_sum",
        "royal_appeal_heuristic",
        "wallah_il_aazeem_intensity_signaling",
        "gulf_emigration_as_solution",
        "informal_first_formal_last",
        "gaza_war_salience",
        "possible_mental_health_distress",
    ]
)


def _clean_bias_tags(tags: list[str], persona_id: str) -> list[str]:
    """
    Remove any bias tag that is not in the §5 closed list and log what was
    dropped, so the seed output is fully transparent.
    """
    cleaned = []
    for tag in tags:
        if tag in _ALLOWED_BIAS_TAGS:
            cleaned.append(tag)
        else:
            print(
                f"  [DB-02] Persona {persona_id}: removed invalid bias tag '{tag}' "
                f"(not in sysprompt.md §5 closed list)"
            )
    return cleaned


# ---------------------------------------------------------------------------
# Persona data — all 10 archetypes from sysprompt.md §13
# ---------------------------------------------------------------------------

_RAW_PERSONAS: list[dict] = [
    {
        "persona_id": "1",
        "name_ar": "أبو محمد الكركي: الوطني المتقاعد المتأثر بتآكل المعاش",
        "name_en": "Abu Mohammad al-Karaki: The Disillusioned Pension-Squeezed Patriot",
        "issue_clusters": [
            "pension_erosion",
            "unemployment",
            "wasta_corruption",
            "healthcare_access",
            "tribal_mediation",
            "other",
        ],
        "bias_tags": [
            "loss_aversion",
            "status_quo_bias",
            "wasta_attribution",
            "tribal_in_group_framing",
            "amman_vs_periphery_framing",
            "royal_appeal_heuristic",
        ],
        "priority_tier": "core",
        "description": (
            "Older retired military, security, or public-sector citizen whose recurring "
            "grievances center on pension erosion, children's unemployment, healthcare "
            "access, dignity, wasta, and perceived neglect of public-sector or southern "
            "communities."
        ),
    },
    {
        "persona_id": "2",
        "name_ar": "أم أحمد: الأم القلقة ومديرة ميزانية البيت",
        "name_en": "Umm Ahmad: The Worrying Mother / Household Comptroller",
        "issue_clusters": [
            "electricity_bills",
            "water_access",
            "education_tawjihi",
            "healthcare_access",
            "cost_of_living",
            "debt_imprisonment",
        ],
        "bias_tags": [
            "loss_aversion",
            "availability_heuristic",
            "negativity_bias",
            "present_bias",
            "wallah_il_aazeem_intensity_signaling",
        ],
        "priority_tier": "core",
        "description": (
            "Household manager whose complaints focus on electricity bills, water "
            "rationing, children's education, food prices, healthcare access, family "
            "debt, and the need for predictable household survival."
        ),
    },
    {
        "persona_id": "3",
        "name_ar": "طارق: خريج التوجيهي والجامعة العالق في البيت",
        "name_en": "Tareq the Tawjihi Champion Stuck at Home",
        "issue_clusters": [
            "unemployment",
            "wasta_corruption",
            "education_tawjihi",
            "marriage_costs",
            "housing_affordability",
            "political_voice",
        ],
        "bias_tags": [
            "wasta_attribution",
            "confirmation_bias",
            "present_bias",
            "gulf_emigration_as_solution",
            "negativity_bias",
        ],
        "priority_tier": "core",
        "description": (
            "Young educated unemployed or underemployed citizen whose grievances center "
            "on blocked employment, wasta, public-sector waiting lists, university-to-work "
            "mismatch, emigration pressure, and delayed marriage."
        ),
    },
    {
        "persona_id": "4",
        "name_ar": "هناء: المرأة المتعلمة العاملة",
        "name_en": "Hana the Educated Working Woman",
        "issue_clusters": [
            "women_workforce",
            "harassment",
            "transport",
            "family_law",
            "cost_of_living",
        ],
        "bias_tags": [
            # "risk_aversion" removed — not in sysprompt.md §5 closed list
            "gendered_family_honor_framing",
            "loss_aversion",
            "negativity_bias",
            "possible_mental_health_distress",
        ],
        "priority_tier": "core",
        "description": (
            "Educated woman facing workforce participation barriers, unsafe or unreliable "
            "transport, harassment, wage inequality, childcare constraints, family-law "
            "exposure, and social pressure."
        ),
    },
    {
        "persona_id": "5",
        "name_ar": "خالد: سائق الشاحنة / العامل غير الرسمي في الجنوب",
        "name_en": "Khaled the Trucker / Southern Informal Worker",
        "issue_clusters": [
            "fuel_prices",
            "customs_sme",
            "debt_imprisonment",
            "transport",
            "political_voice",
            "other",
        ],
        "bias_tags": [
            # "reactance" removed — not in sysprompt.md §5 closed list
            "loss_aversion",
            "amman_vs_periphery_framing",
            "tribal_in_group_framing",
            "informal_first_formal_last",
            "availability_heuristic",
        ],
        "priority_tier": "core",
        "description": (
            "Southern or informal-economy worker whose complaints focus on fuel prices, "
            "customs and port logistics, debt pressure, police/checkpoint pressure, "
            "volatile income, and southern marginalization."
        ),
    },
    {
        "persona_id": "6",
        "name_ar": "أبو خليل الغوري: مزارع الأغوار والمرتفعات",
        "name_en": "Abu Khalil al-Ghori: The Jordan Valley / Highland Farmer",
        "issue_clusters": [
            "agriculture_water",
            "water_access",
            "cost_of_living",
            "other",
        ],
        "bias_tags": [
            "loss_aversion",
            "status_quo_bias",
            "availability_heuristic",
            "amman_vs_periphery_framing",
            "informal_first_formal_last",
        ],
        "priority_tier": "core",
        "description": (
            "Smallholder farmer or agricultural household whose grievances center on "
            "irrigation water, fertilizer and input costs, pump electricity, market "
            "access, climate shocks, land fragmentation, and agricultural livelihood "
            "survival."
        ),
    },
    {
        "persona_id": "7",
        "name_ar": "ريم وفادي: المخطوبان العالقان",
        "name_en": "Reem and Fadi: The Engaged-but-Stuck Newlywed Pair",
        "issue_clusters": [
            "marriage_costs",
            "housing_affordability",
            "cost_of_living",
            "unemployment",
            "women_workforce",
        ],
        "bias_tags": [
            "loss_aversion",
            "present_bias",
            "negativity_bias",
            "gulf_emigration_as_solution",
            "gendered_family_honor_framing",
        ],
        "priority_tier": "core",
        "description": (
            "Young engaged or newlywed pair delayed by dowry, housing, wedding costs, "
            "low salaries, unemployment, family pressure, and the inability to start "
            "adult life."
        ),
    },
    {
        "persona_id": "8",
        "name_ar": "سامي: صاحب المشروع الصغير / المهني المرتبط بالاغتراب",
        "name_en": "Sami the West-Amman SME Owner / Diaspora-Adjacent Professional",
        "issue_clusters": [
            "tax_burden",
            "customs_sme",
            "freedom_of_expression",
            "political_voice",
            "other",
        ],
        "bias_tags": [
            "confirmation_bias",
            "loss_aversion",
            "optimism_bias",
            "gaza_war_salience",
            "availability_heuristic",
        ],
        "priority_tier": "core",
        "description": (
            "Professional or SME owner whose grievances focus on tax burden, licensing, "
            "customs, bureaucratic friction, e-government gaps, banking access, freedom "
            "of expression, and policy uncertainty."
        ),
    },
    {
        "persona_id": "9",
        "name_ar": "يوسف وفاطمة: أسرة لاجئة / مقيمة في المخيم",
        "name_en": "Yousef and Fatima: The Refugee / Camp-Resident Household",
        "issue_clusters": [
            "documentation_status",
            "refugee_services",
            "healthcare_access",
            "housing_affordability",
            "cost_of_living",
        ],
        "bias_tags": [
            "loss_aversion",
            "availability_heuristic",
            "refugee_host_scarcity_framing",
            "informal_first_formal_last",
            "possible_mental_health_distress",
        ],
        "priority_tier": "core",
        "description": (
            "Refugee, ex-Gazan, stateless, or camp-resident household facing "
            "documentation precarity, work permit barriers, aid cuts, health access "
            "issues, housing overcrowding, and uncertain legal or livelihood status."
        ),
    },
    {
        "persona_id": "10",
        "name_ar": "سلمى وأبو سمير: كبير السن / مريض الرعاية المزمنة",
        "name_en": "Salma and Abu Samir: The Elderly Pensioner / Chronic-Care Patient",
        "issue_clusters": [
            "healthcare_access",
            "medication_stockout",
            "pension_erosion",
            "transport",
            "other",
        ],
        "bias_tags": [
            "loss_aversion",
            "status_quo_bias",
            "availability_heuristic",
            "el_dawleh_wein_learned_helplessness",
            "informal_first_formal_last",
        ],
        "priority_tier": "core",
        "description": (
            "Elderly pensioner or chronic-care patient whose complaints focus on "
            "medication availability, health center queues, hospital referrals, pension "
            "purchasing power, transport barriers, isolation, and digital exclusion."
        ),
    },
]


# ---------------------------------------------------------------------------
# Public seed function
# ---------------------------------------------------------------------------

def seed_persona_definitions(db: Session) -> None:
    """
    Populate persona_definitions with the 10 official archetypes from
    sysprompt.md §13.

    Idempotent: if any row already exists, the function logs and returns
    without touching the table.  This prevents duplicate rows on restart.
    """
    existing_count: int = db.query(PersonaDefinition).count()
    if existing_count > 0:
        print(
            f"[DB-02] Persona definitions already seeded "
            f"({existing_count} rows found), skipping."
        )
        return

    records: list[PersonaDefinition] = []
    for raw in _RAW_PERSONAS:
        cleaned_bias = _clean_bias_tags(raw["bias_tags"], raw["persona_id"])
        records.append(
            PersonaDefinition(
                persona_id=raw["persona_id"],
                name_ar=raw["name_ar"],
                name_en=raw["name_en"],
                issue_clusters=raw["issue_clusters"],
                bias_tags=cleaned_bias,
                priority_tier=raw["priority_tier"],
                description=raw["description"],
            )
        )

    db.add_all(records)
    db.commit()
    print(f"[DB-02] Seeded {len(records)} persona definitions.")
