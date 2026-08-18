/**
 * PRD 128 Phase 3 gate tests — Roma route validation + grant boundary.
 *
 * Gate 3.1: shared external request parser, without an internal coordinate re-proof
 * Gate 3.2: Grant authoritative — caller cannot overwrite
 * Gate 3.3: Reservation only after validation
 *
 * Run: cd roma && npx tsx tests/run-copilot-route-gates.ts
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'fs';

function assertPass(label: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ ${label}`);
  } catch (err) {
    console.error(`  ❌ ${label}`);
    throw err;
  }
}

const ROUTE_PATH = '/Users/piero_macpro/code/VS/clickeen/roma/app/api/account/instances/[instanceId]/copilot/route.ts';
const LIB_PATH = '/Users/piero_macpro/code/VS/clickeen/roma/lib/ai/account-copilot.ts';

// ---------------------------------------------------------------------------
// Gate 3.1: Shared external parser used; trusted Bob context is not re-proved
// ---------------------------------------------------------------------------

function testSharedParserInRoute() {
  console.log('\n--- Gate 3.1: Shared parser in route ---');
  const source = readFileSync(ROUTE_PATH, 'utf8');

  assertPass('route imports parseCopilotTurnRequest from ck-contracts', () => {
    assert.ok(source.includes('parseCopilotTurnRequest'), 'parseCopilotTurnRequest imported');
    assert.ok(source.includes("@clickeen/ck-contracts/ai"), 'imported from ck-contracts');
  });

  assertPass('route passes routeInstanceId to parser', () => {
    assert.ok(source.includes('routeInstanceId'), 'routeInstanceId passed');
  });

  assertPass('route trusts Bob widgetType after external request acceptance', () => {
    assert.ok(!source.includes('widgetType must match'), 'no downstream widgetType cross-check');
  });

  assertPass('route does NOT have its own inline kind validation (uses shared parser)', () => {
    // The old inline validation pattern should be gone
    assert.ok(!source.includes("payload.kind !== 'initial' && payload.kind !== 'continuation'"),
      'no inline kind check — shared parser handles it');
  });
}

// ---------------------------------------------------------------------------
// Gate 3.2: Grant authoritative — no caller overwrite
// ---------------------------------------------------------------------------

function testGrantAuthoritative() {
  console.log('\n--- Gate 3.2: Grant authoritative ---');
  const source = readFileSync(LIB_PATH, 'utf8');

  assertPass('streamCopilotTurn constructs upstream from explicit fields (no spread)', () => {
    // The old vulnerable pattern was: { grant: args.grant, ...turnBody }
    assert.ok(!source.includes('...((args.turnBody'), 'no spread of turnBody');
    assert.ok(!source.match(/\.\.\.\(.*turnBody/s), 'no spread of turnBody (multiline)');
  });

  assertPass('streamCopilotTurn takes CopilotTurnRequest (parsed), not raw turnBody', () => {
    assert.ok(source.includes('turnRequest: CopilotTurnRequest'), 'takes typed CopilotTurnRequest');
    assert.ok(!source.includes('turnBody: unknown'), 'does not take raw unknown body');
  });

  assertPass('grant written last in upstream body', () => {
    // Find the upstream construction and verify grant comes after all caller fields
    const match = source.match(/const upstream[\s\S]*?grant: args\.grant/s);
    assert.ok(match, 'upstream body includes grant: args.grant');
    const before = match![0];
    assert.ok(before.includes('conversationHistory'), 'caller fields before grant');
    assert.ok(before.includes('currentDraftContext'), 'more caller fields before grant');
  });

  assertPass('trace written by Roma (not caller)', () => {
    assert.ok(source.includes("trace: { client: 'roma'"), 'Roma writes its own trace');
  });
}

// ---------------------------------------------------------------------------
// Gate 3.3: Reservation only after validation
// ---------------------------------------------------------------------------

function testReservationAfterValidation() {
  console.log('\n--- Gate 3.3: Reservation after validation ---');
  const source = readFileSync(ROUTE_PATH, 'utf8');

  assertPass('parseCopilotTurnRequest runs BEFORE issueAccountCopilotGrant', () => {
    const parserIdx = source.indexOf('parseCopilotTurnRequest(');
    const grantIdx = source.indexOf('issueAccountCopilotGrant(');
    assert.ok(parserIdx > 0, 'parser is called');
    assert.ok(grantIdx > 0, 'grant is called');
    assert.ok(parserIdx < grantIdx, 'parser runs first');
  });

  assertPass('skipTurnReservation used for continuations (after validated kind)', () => {
    assert.ok(source.includes('skipTurnReservation'), 'skipTurnReservation used');
    // Must reference the VALIDATED turnRequest.kind, not raw payload.kind
    assert.ok(
      source.includes('turnRequest.kind') && !source.includes("payload.kind === 'initial'"),
      'uses validated turnRequest.kind not raw payload.kind',
    );
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function run(): void {
  console.log('=== PRD 128 Phase 3 Gate Tests — Roma Route + Grant Boundary ===');
  testSharedParserInRoute();
  testGrantAuthoritative();
  testReservationAfterValidation();
  console.log('\n=== All Phase 3 gate tests passed ===');
}

run();
