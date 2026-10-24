import fs from 'fs';
import path from 'path';
import type { AuditResult } from './audits';
import { outDir } from './env';

/** One screenshot's worth of results, written by the spec to <out>/.parts/<id>.json. */
export interface ComboResult {
  id: string;
  role: string;
  screen: string;
  size: string;
  scale: number;
  status: 'ok' | 'unreachable';
  reason?: string;
  audits?: AuditResult;
}

const flat = (combos: ComboResult[], pick: (a: AuditResult) => unknown[]): Array<Record<string, any>> =>
  combos.flatMap((c) => (c.audits ? pick(c.audits) : []).map((o) => ({ combo: c.id, role: c.role, screen: c.screen, size: c.size, scale: c.scale, ...(o as object) })));

const instances = (list: Array<{ count?: number }>) => list.reduce((n, o) => n + (o.count ?? 1), 0);

/** Runs once at the end: merges the per-combo files into findings.json (one section per check, so before/after runs diff) and prints the totals. */
export default async function globalTeardown() {
  const dir = path.join(outDir(), '.parts');
  if (!fs.existsSync(dir)) return;
  const combos = fs
    .readdirSync(dir)
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as ComboResult)
    .sort((a, b) => a.id.localeCompare(b.id));
  const ran = combos.filter((c) => c.status === 'ok');
  const overflow = flat(ran, (a) => (a.overflow.over || a.overflow.cutOff ? (a.overflow.offenders.length ? a.overflow.offenders : [{ selector: '(document)', text: '', overBy: a.overflow.scrollWidth - a.overflow.innerWidth }]) : []));
  const coveredInputs = flat(ran, (a) => a.coveredInputs);
  const tapTargets = flat(ran, (a) => a.tapTargets.offenders);
  const smallText = flat(ran, (a) => a.smallText);
  const smallInputs = flat(ran, (a) => a.smallInputs);
  const clippedText = flat(ran, (a) => a.clippedText);
  const worst = [...overflow].sort((a, b) => b.overBy - a.overBy).slice(0, 10);
  const summary = {
    combosRun: ran.length,
    combosUnreachable: combos.length - ran.length,
    overflowCombos: ran.filter((c) => c.audits!.overflow.over || c.audits!.overflow.cutOff).length,
    /** Of those, the ones where the page scrolls sideways (the rest are cut off at the edge). */
    overflowScrollingCombos: ran.filter((c) => c.audits!.overflow.over).length,
    overflowOffenders: overflow.length,
    coveredInputs: coveredInputs.length,
    // One offender = one selector on one screen at one size; "instances" counts every repeat (a card shown 20 times).
    tapTargetOffenders: tapTargets.length,
    tapTargetInstances: instances(tapTargets),
    tapTargetsBelowFloor28: tapTargets.filter((t) => t.severe).length,
    tapTargetMainOffenders: tapTargets.filter((t) => t.primary).length,
    smallInputs: smallInputs.length,
    smallTextOffenders: smallText.length,
    smallTextInstances: instances(smallText),
    clippedTextOffenders: clippedText.length,
    clippedTextInstances: instances(clippedText),
    worstOverflow: worst
  };
  const out = { generatedAt: new Date().toISOString(), phase: process.env.RESPONSIVE_OUT || 'before', summary, combos: combos.map(({ audits, ...c }) => c), overflow, coveredInputs, tapTargets, smallInputs, smallText, clippedText };
  fs.writeFileSync(path.join(outDir(), 'findings.json'), JSON.stringify(out, null, 1));
  fs.rmSync(dir, { recursive: true, force: true });
  const { worstOverflow, ...counts } = summary;
  console.log(`\nResponsive findings -> ${path.join(outDir(), 'findings.json')}\n${JSON.stringify(counts, null, 1)}`);
  console.log('Worst overflow:\n' + worst.map((o) => `  +${o.overBy}px  ${o.selector}  ${o.size} @${o.scale}%  ${o.role}-${o.screen}`).join('\n'));
  const un = combos.filter((c) => c.status !== 'ok');
  if (un.length) console.log('Unreachable:\n' + [...new Set(un.map((c) => `  ${c.role}-${c.screen}: ${c.reason}`))].join('\n'));
}
