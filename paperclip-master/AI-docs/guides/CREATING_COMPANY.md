# Creating a Company — Step-by-Step Guide

> **Goal**: Set up a Paperclip company with agents, goals, projects, and tasks from scratch.

---

## Step 1: Create the Company

```bash
curl -X POST http://localhost:3100/api/companies \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Minister Digital Twin",
    "description": "Digital Twin of the Minister of Public Sector Development - Jordan Modernization"
  }'
```

**Response** (save the `id`):
```json
{
  "id": "abc-123-...",
  "name": "Minister Digital Twin",
  "issuePrefix": "MDT",
  "status": "active",
  "budgetMonthlyCents": 0
}
```

---

## Step 2: Define the Mission (Company Goal)

```bash
curl -X POST http://localhost:3100/api/companies/{companyId}/goals \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Provide AI-native ministerial intelligence for Jordan public sector modernization",
    "description": "A bilingual (AR/EN) intelligence layer that helps the Minister understand, monitor, and act on modernization progress across all institutions.",
    "level": "company",
    "status": "active"
  }'
```

---

## Step 3: Create Sub-Goals (One per Capability)

```bash
# For each of the 7 capabilities, create a team-level goal:
curl -X POST http://localhost:3100/api/companies/{companyId}/goals \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Executive Radar: Real-time situational awareness",
    "level": "team",
    "status": "active",
    "parentId": "{companyGoalId}"
  }'
```

---

## Step 4: Create Projects (One per Capability)

```bash
curl -X POST http://localhost:3100/api/companies/{companyId}/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Executive Radar",
    "description": "Executive-level monitoring, alerting, and briefing capability",
    "status": "in_progress",
    "goalId": "{teamGoalId}"
  }'
```

---

## Step 5: Create the CEO / Lead Agent

```bash
curl -X POST http://localhost:3100/api/companies/{companyId}/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Digital Minister Advisor",
    "role": "ceo",
    "title": "Chief Digital Intelligence Officer",
    "adapterType": "process",
    "adapterConfig": {
      "command": "python3",
      "args": ["agents/chief_advisor.py"],
      "cwd": "/path/to/hackathon",
      "env": {
        "GEMMA_API_KEY": "your-key",
        "GEMMA_MODEL": "gemma-4"
      },
      "timeoutSec": 600
    },
    "capabilities": "Orchestrates all 7 capabilities, produces executive synthesis, manages ministerial agenda",
    "budgetMonthlyCents": 5000
  }'
```

---

## Step 6: Create Team Agents (Reporting to CEO)

```bash
# Executive Radar Lead
curl -X POST http://localhost:3100/api/companies/{companyId}/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Radar Analyst",
    "role": "researcher",
    "title": "Executive Radar Lead",
    "reportsTo": "{ceoAgentId}",
    "adapterType": "process",
    "adapterConfig": {
      "command": "python3",
      "args": ["agents/radar_analyst.py"],
      "cwd": "/path/to/hackathon",
      "env": { "GEMMA_API_KEY": "your-key" },
      "timeoutSec": 300
    },
    "capabilities": "Monitors initiative timelines, detects risks, generates alerts"
  }'
```

---

## Step 7: Create API Keys for Agents

Agents need API keys to interact with Paperclip:

```bash
curl -X POST http://localhost:3100/api/agents/{agentId}/keys \
  -H "Content-Type: application/json" \
  -d '{ "name": "primary-key" }'
```

**Response** (save the key — shown only once!):
```json
{
  "id": "key-id",
  "key": "pcp_abc123...",  // SAVE THIS!
  "name": "primary-key"
}
```

---

## Step 8: Create Issues (Work Items)

```bash
curl -X POST http://localhost:3100/api/companies/{companyId}/issues \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Generate morning executive briefing on modernization status",
    "description": "## Objective\nAnalyze all active modernization initiatives. Identify slippage, risks, and opportunities. Produce a concise bilingual (AR/EN) brief.\n\n## Expected Output\n- Initiative status summary\n- Top 3 risks\n- Recommended interventions",
    "status": "todo",
    "priority": "high",
    "assigneeAgentId": "{radarAnalystId}",
    "projectId": "{radarProjectId}",
    "goalId": "{radarGoalId}"
  }'
```

---

## Step 9: Set Up Routines (Recurring Tasks)

```bash
# Create routine
curl -X POST http://localhost:3100/api/companies/{companyId}/routines \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Daily Morning Executive Brief",
    "description": "Generate the ministerial morning briefing",
    "assigneeAgentId": "{radarAnalystId}",
    "projectId": "{radarProjectId}",
    "goalId": "{radarGoalId}",
    "status": "active"
  }'

# Add schedule trigger
curl -X POST http://localhost:3100/api/routines/{routineId}/triggers \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "schedule",
    "label": "Daily 7am",
    "cronExpression": "0 7 * * *",
    "enabled": true
  }'
```

---

## Step 10: Invoke an Agent Manually

To test your agent:

```bash
# Wake the agent manually
curl -X POST http://localhost:3100/api/agents/{agentId}/wakeup \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "manual test",
    "issueIds": ["{issueId}"]
  }'

# Or invoke heartbeat directly
curl -X POST http://localhost:3100/api/agents/{agentId}/heartbeat/invoke \
  -H "Content-Type: application/json"
```

---

## Verify Everything Works

```bash
# Check company dashboard
curl http://localhost:3100/api/companies/{companyId}/dashboard

# Check agent status
curl http://localhost:3100/api/agents/{agentId}

# Check issue status
curl http://localhost:3100/api/issues/{issueId}

# Check heartbeat runs
curl http://localhost:3100/api/agents/{agentId}/runs

# Check activity log
curl http://localhost:3100/api/companies/{companyId}/activity
```

---

## Agent Script Template (Python)

Here's a minimal agent script that works with the `process` adapter:

```python
#!/usr/bin/env python3
"""Minimal Paperclip agent script for hackathon."""

import os
import json
import requests

# Paperclip context from environment
API_URL = os.environ.get('PAPERCLIP_API_URL', 'http://localhost:3100')
API_KEY = os.environ['PAPERCLIP_AGENT_API_KEY']
AGENT_ID = os.environ['PAPERCLIP_AGENT_ID']
COMPANY_ID = os.environ['PAPERCLIP_COMPANY_ID']
TASK_ID = os.environ.get('PAPERCLIP_TASK_ID')
WAKE_REASON = os.environ.get('PAPERCLIP_WAKE_REASON', 'manual')

headers = {
    'Authorization': f'Bearer {API_KEY}',
    'Content-Type': 'application/json'
}

def get_task(task_id):
    """Fetch task details from Paperclip."""
    r = requests.get(f'{API_URL}/api/issues/{task_id}', headers=headers)
    return r.json()

def post_comment(task_id, body):
    """Post a comment on a task."""
    r = requests.post(
        f'{API_URL}/api/issues/{task_id}/comments',
        headers=headers,
        json={'body': body}
    )
    return r.json()

def update_task(task_id, updates):
    """Update task fields."""
    r = requests.patch(
        f'{API_URL}/api/issues/{task_id}',
        headers=headers,
        json=updates
    )
    return r.json()

def checkout_task(task_id):
    """Atomically checkout a task."""
    run_id = os.environ.get('PAPERCLIP_RUN_ID', '')
    r = requests.post(
        f'{API_URL}/api/issues/{task_id}/checkout',
        headers={**headers, 'X-Paperclip-Run-Id': run_id},
        json={'agentId': AGENT_ID}
    )
    if r.status_code == 409:
        print(f'Task {task_id} already checked out by another agent')
        return None
    return r.json()

def call_gemma(prompt):
    """Call Gemma 4 model for reasoning."""
    # Replace with your actual Gemma 4 API call
    gemma_key = os.environ.get('GEMMA_API_KEY', '')
    # ... implement Gemma 4 API call here ...
    return "Gemma 4 response placeholder"

def main():
    print(f'Agent {AGENT_ID} woke up. Reason: {WAKE_REASON}')
    
    if TASK_ID:
        task = get_task(TASK_ID)
        print(f'Working on: {task["title"]}')
        
        # Checkout the task
        result = checkout_task(TASK_ID)
        if not result:
            return
        
        # Do work with Gemma 4
        analysis = call_gemma(f'Analyze: {task["title"]}\n{task.get("description", "")}')
        
        # Post results
        post_comment(TASK_ID, f'## Analysis Complete\n\n{analysis}')
        
        # Mark done
        update_task(TASK_ID, {'status': 'done'})
        print('Task completed.')
    else:
        # No specific task - check for assignments
        r = requests.get(
            f'{API_URL}/api/companies/{COMPANY_ID}/issues?assigneeAgentId={AGENT_ID}&status=todo',
            headers=headers
        )
        tasks = r.json()
        if tasks:
            print(f'Found {len(tasks)} assigned tasks')
            # Work on highest priority first
            # ... 

if __name__ == '__main__':
    main()
```
