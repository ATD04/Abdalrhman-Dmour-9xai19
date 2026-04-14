# Manara Platform Frontend - UI/UX Overhaul Documentation

## Overview

This document describes the UI/UX overhaul performed on the Manara Platform frontend, including the changes made, architecture decisions, and integration with backend services.

## Project Structure

```
app/frontend/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── page.tsx           # Main AI Chat interface
│   │   ├── login/             # Authentication page
│   │   ├── admin/             # Admin control tower
│   │   ├── executive/         # Executive dashboard
│   │   ├── expert/            # Expert review workspace
│   │   ├── knowledge/         # Document management
│   │   ├── my-tickets/        # User ticket tracking
│   │   ├── history/           # Conversation history
│   │   ├── saved/             # Saved answers
│   │   ├── help/              # Help center
│   │   └── profile/           # User profile
│   ├── components/
│   │   ├── AppShell.tsx       # Main layout with sidebar & topbar
│   │   └── ui.tsx             # Reusable UI component library
│   ├── lib/
│   │   ├── api.ts             # Centralized API service layer
│   │   ├── chat-history.ts    # Chat persistence utilities
│   │   ├── saved-answers.ts   # Saved answers management
│   │   ├── processing-status.ts # Upload job tracking
│   │   ├── user-context.ts    # User session utilities
│   │   └── utils.ts           # General utilities
│   └── __tests__/
│       ├── smoke.test.ts      # Backend connectivity tests
│       └── unit.test.ts       # Unit tests
```

## Backend Integration

### Services Connected

| Service | Port | Frontend Pages |
|---------|------|----------------|
| **Agent Service** | 9200 | Chat (page.tsx) |
| **Knowledge Service** | 9100 | Knowledge Library, Upload |
| **Governance Service** | 9300 | Admin, Executive dashboards |
| **Workflow Service** | 9400 | Expert tickets, My Requests |

### API Service Layer (`src/lib/api.ts`)

A centralized API layer was created to:
- Provide typed interfaces for all backend services
- Handle errors consistently
- Enable easy configuration via environment variables
- Support health checks across all services

Example usage:
```typescript
import { governanceService, workflowService } from '@/lib/api';

// Get metrics
const metrics = await governanceService.getMetrics('24h');

// List cases
const cases = await workflowService.listCases({ status: 'open' });
```

### Environment Variables

```env
NEXT_PUBLIC_AGENT_URL=http://localhost:9200
NEXT_PUBLIC_KNOWLEDGE_URL=http://localhost:9100
NEXT_PUBLIC_GOVERNANCE_URL=http://localhost:9300
NEXT_PUBLIC_WORKFLOW_URL=http://localhost:9400
```

## UI Components

### Component Library (`src/components/ui.tsx`)

| Component | Description |
|-----------|-------------|
| `StatCard` | Animated statistics card with trend indicators |
| `ConfidenceBadge` | AI confidence level display (high/medium/low) |
| `StatusBadge` | Generic status indicator |
| `MinistryTag` | Ministry label badge |
| `CitationChip` | Clickable source citation |
| `SourceCard` | Document source display |
| `EmptyState` | Empty state placeholder |
| `SkeletonLine/Card` | Loading skeletons |
| `PageHeader` | Page title with actions |
| `Button` | Primary/secondary/ghost/danger variants |
| `Input` | Form input with label and error handling |
| `Select` | Dropdown select with label |
| `Alert` | Info/success/warning/error alerts |
| `LoadingSpinner` | Loading indicator |
| `Card` | Container with optional hover effect |
| `ServiceHealthIndicator` | Service status display |

### Design System

- **Colors**: Navy/Gold/Teal professional palette
- **Typography**: IBM Plex Sans (English), IBM Plex Sans Arabic (Arabic)
- **Shadows**: Custom shadow tokens (xs, sm, md, lg, xl)
- **Animations**: Framer Motion for smooth interactions
- **RTL Support**: Full Arabic/RTL support

## Pages & Features

### 1. AI Assistant (Main Chat)
- **Route**: `/`
- **Features**:
  - Real-time SSE streaming responses
  - Fast/Thinking mode toggle
  - Source citation previews
  - Save answers functionality
  - Conversation persistence

### 2. Admin Control Tower
- **Route**: `/admin`
- **Data Source**: Governance Service
- **Features**:
  - Real-time metrics dashboard
  - Service health monitoring
  - Audit log viewer
  - Sector distribution charts

### 3. Executive Dashboard
- **Route**: `/executive`
- **Data Source**: Governance + Knowledge Services
- **Features**:
  - Performance overview
  - Confidence distribution
  - Agent distribution
  - Automated recommendations

### 4. Expert Review Workspace
- **Route**: `/expert`
- **Data Source**: Workflow Service
- **Features**:
  - Live ticket queue
  - Case statistics
  - Recent activity feed

### 5. Knowledge Library
- **Route**: `/knowledge`
- **Data Source**: Knowledge Service
- **Features**:
  - Document listing
  - Upload with progress tracking
  - Version management

### 6. My Requests
- **Route**: `/my-tickets`
- **Data Source**: Workflow Service
- **Features**:
  - Personal ticket tracking
  - Resolution display

## Removed/Simplified Pages

Some pages were simplified as they don't require backend integration:
- `/landing` - Static landing page
- `/login` - Role selection (no auth backend)
- `/history` - localStorage-based
- `/saved` - localStorage-based
- `/help` - Static content
- `/profile` - Frontend state only

## Testing

### Smoke Tests
Tests backend connectivity:
```bash
npm run test:smoke
```

Validates:
- All services are reachable
- API endpoints return expected data
- Health checks pass

### Unit Tests
Tests utility functions:
```bash
npm run test:unit
```

Validates:
- API service exports
- User context utilities
- State management functions

### Running All Tests
```bash
npm run test
```

## Getting Started

1. **Install dependencies**:
   ```bash
   cd app/frontend
   npm install
   ```

2. **Start backend services** (from root):
   ```bash
   # In separate terminals
   cd app/services/agent-service && python main.py
   cd app/services/knowledge-service && python main.py
   cd app/services/governance-service && python main.py
   cd app/services/workflow-service && python main.py
   ```

3. **Start frontend**:
   ```bash
   npm run dev
   ```

4. **Run tests**:
   ```bash
   npm run test:smoke  # Test backend connectivity
   npm run test:unit   # Test utilities
   ```

## Best Practices Applied

### Modern UI/UX Patterns
1. **Progressive disclosure** - Show information progressively
2. **Loading states** - Skeleton loaders for perceived performance
3. **Error boundaries** - Graceful error handling
4. **Empty states** - Clear guidance when no data
5. **Responsive design** - Works on all screen sizes
6. **RTL support** - Full Arabic language support
7. **Accessibility** - Semantic HTML, ARIA labels

### Code Quality
1. **TypeScript** - Full type safety
2. **Centralized API** - Single source of truth for backend calls
3. **Component composition** - Reusable UI primitives
4. **Consistent styling** - Design tokens via CSS variables
5. **Error handling** - Try-catch with user-friendly messages

## Future Improvements

1. **Real authentication** - Integrate with SSO/OAuth
2. **Real-time updates** - WebSocket for live data
3. **Offline support** - Service worker caching
4. **Performance monitoring** - Web Vitals tracking
5. **E2E tests** - Playwright/Cypress integration
