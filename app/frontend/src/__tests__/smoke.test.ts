/**
 * Smoke Tests for Shahem Platform API Services
 *
 * These tests verify that all backend services are reachable and responding correctly.
 * Run these tests to validate the frontend-backend integration.
 *
 * Usage:
 *   1. Ensure all backend services are running
 *   2. Run: npx tsx src/__tests__/smoke.test.ts
 *
 * Or add to package.json:
 *   "test:smoke": "npx tsx src/__tests__/smoke.test.ts"
 */

import {
  agentService,
  knowledgeService,
  governanceService,
  workflowService,
  checkAllServices,
} from '../lib/api';

// ANSI colors for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

const log = {
  success: (msg: string) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  info: (msg: string) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  header: (msg: string) => console.log(`\n${colors.bold}${colors.blue}═══ ${msg} ═══${colors.reset}\n`),
};

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    const duration = Date.now() - start;
    results.push({ name, passed: true, duration });
    log.success(`${name} (${duration}ms)`);
  } catch (err: any) {
    const duration = Date.now() - start;
    const error = err?.message || String(err);
    results.push({ name, passed: false, duration, error });
    log.error(`${name}: ${error}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Health Check Tests
// ═══════════════════════════════════════════════════════════════════════════

async function testServiceHealth() {
  log.header('Service Health Checks');

  await runTest('Agent Service Health', async () => {
    const result = await agentService.health();
    if (!result.status) throw new Error('No status returned');
  });

  await runTest('Knowledge Service Health', async () => {
    const result = await knowledgeService.health();
    if (!result.status) throw new Error('No status returned');
  });

  await runTest('Governance Service Health', async () => {
    const result = await governanceService.health();
    if (!result.status) throw new Error('No status returned');
  });

  await runTest('Workflow Service Health', async () => {
    const result = await workflowService.health();
    if (!result.status) throw new Error('No status returned');
  });

  await runTest('Check All Services Utility', async () => {
    const result = await checkAllServices();
    const healthyCount = Object.values(result).filter(Boolean).length;
    log.info(`  ${healthyCount}/4 services healthy`);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Knowledge Service Tests
// ═══════════════════════════════════════════════════════════════════════════

async function testKnowledgeService() {
  log.header('Knowledge Service Tests');

  await runTest('List Sources', async () => {
    const result = await knowledgeService.listSources();
    if (!Array.isArray(result.sources)) throw new Error('Expected sources array');
    log.info(`  Found ${result.sources.length} sources`);
  });

  await runTest('Retrieve Chunks (empty query)', async () => {
    const result = await knowledgeService.retrieve({
      query: 'test query',
      top_k: 3,
    });
    if (!Array.isArray(result.chunks)) throw new Error('Expected chunks array');
    log.info(`  Retrieved ${result.chunks.length} chunks`);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Governance Service Tests
// ═══════════════════════════════════════════════════════════════════════════

async function testGovernanceService() {
  log.header('Governance Service Tests');

  await runTest('Get Metrics (24h)', async () => {
    const result = await governanceService.getMetrics('24h');
    if (result.total_queries === undefined) throw new Error('No total_queries in metrics');
    log.info(`  Total queries: ${result.total_queries}`);
    log.info(`  Avg confidence: ${(result.avg_confidence * 100).toFixed(1)}%`);
  });

  await runTest('List Audit Logs', async () => {
    const result = await governanceService.listAuditLogs({ page_size: 5 });
    if (!Array.isArray(result.records)) throw new Error('Expected records array');
    log.info(`  Found ${result.records.length} audit records`);
  });

  await runTest('Get Release Status', async () => {
    const result = await governanceService.getReleaseStatus();
    if (!result.overall) throw new Error('No overall status');
    log.info(`  Overall status: ${result.overall}`);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Workflow Service Tests
// ═══════════════════════════════════════════════════════════════════════════

async function testWorkflowService() {
  log.header('Workflow Service Tests');

  await runTest('List Cases', async () => {
    const result = await workflowService.listCases({ page_size: 10 });
    if (!Array.isArray(result.cases)) throw new Error('Expected cases array');
    log.info(`  Found ${result.cases.length} cases`);
  });

  await runTest('Get User Cases (test-user)', async () => {
    const result = await workflowService.getUserCases('test-user', 10);
    if (!Array.isArray(result.cases)) throw new Error('Expected cases array');
    log.info(`  Found ${result.cases.length} cases for test-user`);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Agent Service Tests (Non-destructive)
// ═══════════════════════════════════════════════════════════════════════════

async function testAgentService() {
  log.header('Agent Service Tests');

  await runTest('Query Endpoint Accessible', async () => {
    // We only test that the endpoint is reachable, not a full query
    // Full queries are integration tests
    const health = await agentService.health();
    if (!health.status) throw new Error('Agent service not healthy');
    log.info('  Endpoint verified (skipping full query to avoid API costs)');
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Test Runner
// ═══════════════════════════════════════════════════════════════════════════

async function runAllTests() {
  console.log(`\n${colors.bold}${colors.blue}╔════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}║     SHAHEM PLATFORM - SMOKE TEST SUITE             ║${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}╚════════════════════════════════════════════════════╝${colors.reset}`);
  console.log(`\n${colors.yellow}Testing backend connectivity from frontend...${colors.reset}`);

  await testServiceHealth();
  await testKnowledgeService();
  await testGovernanceService();
  await testWorkflowService();
  await testAgentService();

  // Summary
  log.header('Test Summary');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalTime = results.reduce((acc, r) => acc + r.duration, 0);

  console.log(`  ${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`  ${colors.red}Failed: ${failed}${colors.reset}`);
  console.log(`  ${colors.blue}Total time: ${totalTime}ms${colors.reset}`);

  if (failed > 0) {
    console.log(`\n${colors.red}Failed tests:${colors.reset}`);
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log(`\n${colors.green}${colors.bold}All tests passed!${colors.reset}`);
    process.exit(0);
  }
}

// Run tests
runAllTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
