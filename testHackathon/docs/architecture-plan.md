# Architecture Plan

## System Overview

The Digital Twin platform follows a modern three-tier architecture with clear separation between presentation, business logic, and data layers.

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  Next.js 14 + TypeScript + Tailwind + shadcn/ui                 │
│  ┌─────────┬─────────┬─────────┬─────────┬─────────┬─────────┐ │
│  │Executive│ Service │Readiness│ Policy  │  Cross  │ Citizen │ │
│  │ Radar   │Friction │Analyzer │ Impact  │ Entity  │  Voice  │ │
│  ├─────────┴─────────┴─────────┴─────────┴─────────┴─────────┤ │
│  │              Chief of Staff Office View                    │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │              Executive Dashboard (Unified)                  │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                  │
│  NestJS + TypeScript + REST API                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    API Gateway Layer                        │ │
│  │  Routes / Controllers / Validation / i18n Response         │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │                 Orchestration Layer                         │ │
│  │  Cross-Module Aggregation / Summary Generation              │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │                   Service Layer                             │ │
│  │  ┌────────┬────────┬────────┬────────┬────────┬────────┐  │ │
│  │  │Radar   │Friction│Readines│Policy  │Coordin │Citizen │  │ │
│  │  │Service │Service │Service │Service │Service │Service │  │ │
│  │  └────────┴────────┴────────┴────────┴────────┴────────┘  │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │          Chief of Staff Service                      │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │                 Guardrails Layer                            │ │
│  │  Business Rules / Validation / Thresholds / Alerts          │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        DATABASE                                  │
│  PostgreSQL + Prisma ORM                                        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Entities │ Initiatives │ Services │ Policies │ Feedback   │ │
│  │  Readiness│ Dependencies│ Blockers │ Meetings │ Decisions  │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Frontend Architecture

### Technology Stack
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS
- **Components:** shadcn/ui
- **Charts:** Recharts
- **i18n:** next-intl
- **State:** React Context + Server Components

### Directory Structure
```
frontend/
├── app/
│   ├── [locale]/
│   │   ├── layout.tsx
│   │   ├── page.tsx (Executive Dashboard)
│   │   ├── radar/
│   │   ├── friction/
│   │   ├── readiness/
│   │   ├── policy/
│   │   ├── coordination/
│   │   ├── citizen-voice/
│   │   └── chief-of-staff/
│   └── api/
├── components/
│   ├── ui/ (shadcn components)
│   ├── dashboard/
│   ├── capabilities/
│   └── shared/
├── lib/
│   ├── api.ts
│   ├── types.ts
│   └── utils.ts
├── messages/
│   ├── en.json
│   └── ar.json
└── styles/
    └── globals.css
```

### Design System
- **Color Palette:** Neutral base with blue accents for government professionalism
- **Typography:** Inter (Latin), Noto Sans Arabic (Arabic)
- **Spacing:** 4px base unit
- **Borders:** Subtle 1px borders with rounded corners
- **Shadows:** Subtle elevation for cards

## Backend Architecture

### Technology Stack
- **Framework:** NestJS
- **Language:** TypeScript (strict mode)
- **ORM:** Prisma
- **Database:** PostgreSQL
- **Validation:** class-validator + class-transformer
- **API:** REST with OpenAPI documentation

### Module Structure
```
backend/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── common/
│   │   ├── decorators/
│   │   ├── filters/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   └── pipes/
│   ├── modules/
│   │   ├── entities/           # Ministries, departments
│   │   ├── initiatives/        # Modernization projects
│   │   ├── services/           # Public services
│   │   ├── policies/           # Policy records
│   │   ├── feedback/           # Citizen feedback
│   │   ├── coordination/       # Cross-entity tracking
│   │   ├── meetings/           # Calendar, decisions
│   │   ├── radar/              # Executive Radar capability
│   │   ├── friction/           # Service Friction capability
│   │   ├── readiness/          # Readiness Analyzer capability
│   │   ├── policy-impact/      # Policy Impact capability
│   │   ├── cross-entity/       # Coordination Engine capability
│   │   ├── citizen-voice/      # Citizen Voice capability
│   │   └── chief-of-staff/     # CoS Office capability
│   ├── orchestration/
│   │   ├── aggregation.service.ts
│   │   ├── summary.service.ts
│   │   └── alerts.service.ts
│   ├── guardrails/
│   │   ├── rules.service.ts
│   │   └── thresholds.ts
│   └── i18n/
│       └── i18n.service.ts
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
└── test/
```

### Service Layer Pattern
Each capability module follows:
```typescript
@Module({
  imports: [PrismaModule],
  controllers: [CapabilityController],
  providers: [CapabilityService, CapabilityGuardrails],
  exports: [CapabilityService],
})
export class CapabilityModule {}
```

## Data Model Overview

### Core Entities
```
Entity (Ministry/Department)
├── id, nameEn, nameAr, type, parentId
├── readinessScores[]
└── initiatives[]

Initiative (Modernization Project)
├── id, titleEn, titleAr, entityId
├── status, progress, startDate, targetDate
├── risks[], milestones[]
└── dependencies[]

Service (Public Service)
├── id, nameEn, nameAr, entityId
├── category, digitalStatus
├── frictionIncidents[]
└── journeySteps[]

Policy (Policy Record)
├── id, titleEn, titleAr
├── status, impactAssessment
├── options[], tradeoffs[]
└── recommendations[]

Feedback (Citizen Feedback)
├── id, source, channel
├── contentEn, contentAr
├── sentiment, themes[]
└── serviceId, entityId

Dependency (Cross-Entity)
├── id, fromEntityId, toEntityId
├── initiativeId, type, status
└── blockers[]

Meeting (Calendar Item)
├── id, titleEn, titleAr
├── datetime, participants[]
├── decisions[], followUps[]
└── briefingNotes
```

## Orchestration Strategy

### Cross-Module Communication
```
┌─────────────────────────────────────────────────┐
│           Orchestration Service                  │
├─────────────────────────────────────────────────┤
│  aggregateExecutiveSummary()                    │
│  generateMorningBrief()                         │
│  computeCrossCapabilityInsights()              │
│  triggerAlerts()                                │
└─────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────┐
│         Data Flow Examples                       │
├─────────────────────────────────────────────────┤
│ Citizen Voice → Service Friction                │
│   (complaints inform friction analysis)         │
│                                                  │
│ Readiness → Executive Radar                     │
│   (low readiness creates alerts)                │
│                                                  │
│ Cross-Entity → Chief of Staff                   │
│   (blockers inform meeting agendas)             │
│                                                  │
│ Policy Impact → Executive Radar                 │
│   (high-risk policies surface to minister)      │
└─────────────────────────────────────────────────┘
```

## Bilingual Strategy

### Backend Approach
- All entities have `nameEn/nameAr`, `titleEn/titleAr`, etc.
- API accepts `Accept-Language` header
- Response transformer selects appropriate language fields

### Frontend Approach
- next-intl for UI translations
- URL-based locale: `/en/radar`, `/ar/radar`
- RTL layout applied via `dir="rtl"` at root level
- Tailwind RTL plugin for directional utilities

## Security Considerations (Demo Context)
- Simplified auth for demo purposes
- API rate limiting
- Input validation on all endpoints
- No exposed sensitive data in demo dataset

## Deployment Architecture (Future)
```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Vercel     │────▶│   Railway    │────▶│   Supabase   │
│  (Frontend)  │     │  (Backend)   │     │ (PostgreSQL) │
└──────────────┘     └──────────────┘     └──────────────┘
```
