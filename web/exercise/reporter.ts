/**
 * Console reporter for exercise harness results.
 */

import type { ScenarioResult } from './types';

const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const YELLOW = '\x1b[33m';

export function printReport(results: ScenarioResult[], verbose: boolean): void {
  const passed = results.filter((r) => r.passed);
  const failed = results.filter((r) => !r.passed);

  console.log('');
  console.log(`${BOLD}WhereTF Exercise Harness${RESET}`);
  console.log('═'.repeat(50));
  console.log('');

  // Group by tags or just list
  for (const r of results) {
    const icon = r.passed ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
    const dur = `${DIM}${r.duration}ms${RESET}`;
    const retries = r.attempts > 1 ? ` ${YELLOW}(${r.attempts} attempts)${RESET}` : '';
    console.log(`  [${icon}] ${r.name} ${dur}${retries}`);

    if (!r.passed && r.failureReason) {
      console.log(`         ${RED}${r.failureReason}${RESET}`);
    }

    if (verbose && r.toolsCalled && r.toolsCalled.length > 0) {
      console.log(`         ${DIM}tools: ${r.toolsCalled.join(' → ')}${RESET}`);
    }

    if (verbose && r.agentUsed) {
      console.log(`         ${DIM}agent: ${r.agentUsed}${RESET}`);
    }
  }

  console.log('');
  console.log('─'.repeat(50));

  if (failed.length === 0) {
    console.log(`${GREEN}${BOLD}All ${passed.length} scenarios passed${RESET}`);
  } else {
    console.log(
      `${passed.length > 0 ? `${GREEN}${passed.length} passed${RESET}` : ''}` +
      `${passed.length > 0 && failed.length > 0 ? ', ' : ''}` +
      `${failed.length > 0 ? `${RED}${failed.length} failed${RESET}` : ''}` +
      ` ${DIM}(${results.length} total)${RESET}`,
    );
  }

  console.log('');
}
