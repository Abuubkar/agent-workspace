// npm run eval                 scripted demo model (no API key, used in CI)
// npm run eval -- --model openai   real model, needs OPENAI_API_KEY
//
// Writes evals/report.json and exits non-zero when the pass rate drops
// below the threshold, so a prompt or model change that breaks behaviour
// fails the build.
import { writeFileSync } from "node:fs";
import { pickModel, type ModelChoice } from "@/lib/agent/agent";
import { CASES } from "./cases";
import { grade } from "./graders";
import { runCase } from "./run-case";

const THRESHOLD = Number(process.env.EVAL_THRESHOLD ?? 1);

async function main() {
  const arg = process.argv.indexOf("--model");
  const choice = (arg > -1 ? process.argv[arg + 1] : "demo") as ModelChoice;
  const only = process.argv.find((a) => a.startsWith("--case="))?.slice(7);
  const { model, label } = pickModel(choice);

  console.log(`\nAgent evals · model ${label}\n`);
  const results = [];
  for (const c of CASES.filter((c) => !only || c.id === only)) {
    const trace = await runCase(c, model);
    const checks = grade(c, trace);
    const passed = checks.every((ch) => ch.pass);
    results.push({ id: c.id, passed, checks, trace });

    console.log(`${passed ? "PASS" : "FAIL"}  ${c.id.padEnd(30)} ${trace.steps} steps · ${trace.ms}ms`);
    for (const ch of checks.filter((ch) => !ch.pass)) {
      console.log(`      x ${ch.name}${ch.detail ? `: ${ch.detail}` : ""}`);
    }
  }

  const passCount = results.filter((r) => r.passed).length;
  const checkCount = results.flatMap((r) => r.checks).length;
  const checkPass = results.flatMap((r) => r.checks).filter((c) => c.pass).length;
  const rate = passCount / results.length;

  console.log(`\n${passCount}/${results.length} cases · ${checkPass}/${checkCount} checks · pass rate ${(rate * 100).toFixed(0)}%\n`);
  writeFileSync(
    new URL("./report.json", import.meta.url),
    JSON.stringify({ model: label, ranAt: new Date().toISOString(), rate, results }, null, 2),
  );
  if (rate < THRESHOLD) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
