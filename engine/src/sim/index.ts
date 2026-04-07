import { SimHarness } from './harness.js';

// Catch native assertion failures that would silently kill the process on Windows
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err.message);
  console.error(err.stack);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled rejection:', reason);
});

// Parse CLI args
const args = process.argv.slice(2);
const getArg = (name: string, defaultVal: string): string => {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1]! : defaultVal;
};

const agentCount = parseInt(getArg('agents', '10'));
const days = parseInt(getArg('days', '1'));
const speed = getArg('speed', 'max');
const logLevel = getArg('log', 'events') as 'silent' | 'errors' | 'events' | 'verbose' | 'debug';
const resume = args.includes('--resume');

console.log(`\n=== BUCCANEER LIFE SIMULATION ===`);
console.log(`Agents: ${agentCount} | Days: ${days} | Speed: ${speed} | Log: ${logLevel}${resume ? ' | RESUMING' : ''}`);
console.log(`================================\n`);

const harness = new SimHarness({
  agentCount,
  days,
  speed: speed === 'max' ? 0 : parseInt(speed),
  logLevel,
  resume,
});

harness.run().then(report => {
  console.log('\n=== SIMULATION COMPLETE ===');
  console.log(`Total ticks:     ${report.totalTicks}`);
  console.log(`Ticks processed: ${report.ticksProcessed}`);
  console.log(`Ticks skipped:   ${report.ticksSkipped} (${((report.ticksSkipped / report.totalTicks) * 100).toFixed(1)}%)`);
  console.log(`Decisions made:  ${report.totalDecisions}`);
  console.log(`Duration:        ${report.durationMs}ms`);
  console.log(`Avg tick time:   ${report.avgTickMs.toFixed(1)}ms`);
  console.log('===========================\n');
  process.exit(0);
}).catch(err => {
  console.error('Simulation failed:', err);
  process.exit(1);
});
