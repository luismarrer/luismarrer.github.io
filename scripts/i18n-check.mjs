#!/usr/bin/env node
/**
 * i18n-check — coherence gate between cv-en.json and cv-es.json.
 *
 * Coherent means:
 *  - both files have the same structure (keys, array lengths);
 *  - invariant (non-translatable) fields are identical;
 *  - no translatable field changed in one language without its counterpart
 *    changing too, relative to a baseline commit.
 *
 * Baseline: --base <git-ref>, or VERCEL_GIT_PREVIOUS_SHA when run with
 * --vercel (the last *successful* deployment — so an unrelated later push
 * cannot slip a previously blocked mismatch into production). Without a
 * baseline the check degrades to structure + invariants only (fail-open).
 *
 * Exit codes:
 *  default : 0 = coherent, 1 = incoherent
 *  --vercel: Ignored Build Step semantics — 0 = skip build, 1 = proceed
 *
 * Usage:
 *  node scripts/i18n-check.mjs [--base <ref>] [--vercel] [--json] [--dir <path>]
 *
 * --dir reads the two CV files from another directory (used by the delegated
 * validator to check a PR head extracted to a temp dir) while git operations
 * keep running against this repository.
 */

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { FILES, TRANSLATABLE, flattenTranslatable, kind } from './i18n-shared.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const VERCEL = args.includes('--vercel');
const JSON_OUT = args.includes('--json');
const baseArg = args.includes('--base') ? args[args.indexOf('--base') + 1] : null;
const DATA_DIR = args.includes('--dir') ? path.resolve(args[args.indexOf('--dir') + 1]) : ROOT;

const git = (cmd) =>
	execSync(`git ${cmd}`, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

const show = (v) => (String(v).length > 60 ? String(v).slice(0, 57) + '…' : String(v));

// ---------- structural + invariant comparison ----------

const problems = { structure: [], invariant: [] };
const pairs = []; // translatable leaves present in both files

function walk(en, es, p, pattern) {
	const kEn = kind(en);
	const kEs = kind(es);
	if (kEn !== kEs) {
		problems.structure.push(`${p}: type mismatch (${kEn} in en, ${kEs} in es)`);
		return;
	}
	if (kEn === 'array') {
		if (en.length !== es.length)
			problems.structure.push(`${p}: array length ${en.length} (en) vs ${es.length} (es)`);
		for (let i = 0; i < Math.min(en.length, es.length); i++)
			walk(en[i], es[i], `${p}[${i}]`, `${pattern}[]`);
	} else if (kEn === 'object') {
		for (const k of new Set([...Object.keys(en), ...Object.keys(es)])) {
			const cp = p ? `${p}.${k}` : k;
			const cpat = pattern ? `${pattern}.${k}` : k;
			if (!(k in en)) problems.structure.push(`${cp}: missing in cv-en.json`);
			else if (!(k in es)) problems.structure.push(`${cp}: missing in cv-es.json`);
			else walk(en[k], es[k], cp, cpat);
		}
	} else if (TRANSLATABLE.has(pattern)) {
		pairs.push({ path: p, en, es });
	} else if (!Object.is(en, es)) {
		problems.invariant.push(`${p}: "${show(en)}" (en) ≠ "${show(es)}" (es)`);
	}
}

// ---------- baseline (stale-translation) analysis ----------

function changedPaths(current, base) {
	const cur = flattenTranslatable(current, '', '', new Map());
	const old = flattenTranslatable(base, '', '', new Map());
	const changed = new Set();
	for (const [p, v] of cur) if (!old.has(p) || !Object.is(old.get(p), v)) changed.add(p);
	return changed;
}

function resolveBaseline() {
	let ref = baseArg || (VERCEL ? process.env.VERCEL_GIT_PREVIOUS_SHA : null) || null;
	if (!ref) return null;
	const exists = () => {
		try {
			git(`cat-file -e ${ref}^{commit}`);
			return true;
		} catch {
			return false;
		}
	};
	if (!exists()) {
		try {
			git('fetch --quiet --deepen=100 origin');
		} catch {
			/* not shallow, or no network — fall through */
		}
	}
	return exists() ? ref : null;
}

function loadAt(ref, file) {
	try {
		return JSON.parse(git(`show ${ref}:${file}`));
	} catch {
		return null; // file did not exist at baseline
	}
}

// ---------- run ----------

const cvEn = JSON.parse(readFileSync(path.join(DATA_DIR, FILES.en), 'utf8'));
const cvEs = JSON.parse(readFileSync(path.join(DATA_DIR, FILES.es), 'utf8'));
walk(cvEn, cvEs, '', '');

const baseline = resolveBaseline();
const stale = [];
if (baseline) {
	const baseEn = loadAt(baseline, FILES.en);
	const baseEs = loadAt(baseline, FILES.es);
	if (baseEn && baseEs) {
		const enChanged = changedPaths(cvEn, baseEn);
		const esChanged = changedPaths(cvEs, baseEs);
		for (const { path: p } of pairs) {
			const e = enChanged.has(p);
			const s = esChanged.has(p);
			if (e !== s) stale.push({ path: p, source: e ? 'en' : 'es', target: e ? 'es' : 'en' });
		}
	}
}

const coherent = !problems.structure.length && !problems.invariant.length && !stale.length;

const report = {
	coherent,
	baseline,
	structure: problems.structure,
	invariant: problems.invariant,
	stale,
};

if (JSON_OUT) {
	console.log(JSON.stringify(report, null, 2));
} else {
	console.log(`i18n-check: ${FILES.en} ↔ ${FILES.es}`);
	console.log(problems.structure.length ? `✗ structure:\n   ${problems.structure.join('\n   ')}` : '✓ structure OK');
	console.log(problems.invariant.length ? `✗ invariant fields:\n   ${problems.invariant.join('\n   ')}` : '✓ invariant fields OK');
	if (baseline) {
		console.log(
			stale.length
				? `✗ stale translations (baseline ${baseline}):\n   ${stale
						.map((s) => `${s.path}: changed in ${s.source.toUpperCase()}, not in ${s.target.toUpperCase()} → translate ${s.source} → ${s.target}`)
						.join('\n   ')}`
				: `✓ no stale translations (baseline ${baseline})`,
		);
	} else {
		console.log('⚠ no baseline — structure/invariant checks only');
	}
	console.log(`verdict: ${coherent ? 'COHERENT' : 'INCOHERENT'}`);
}

if (!VERCEL) process.exit(coherent ? 0 : 1);

// --vercel: Ignored Build Step semantics (exit 0 skips the build).
if (!coherent) {
	console.log('🛑 EN/ES out of sync — deploy blocked; production stays on the last good deploy.');
	process.exit(0);
}
if (baseline) {
	const IRRELEVANT = /^(docs\/|redirect\/|\.github\/|\.vscode\/|README|LICENSE|CLAUDE\.md|\.gitignore|portfolio_screenshot)/;
	const changed = git(`diff --name-only ${baseline} HEAD`).split('\n').filter(Boolean);
	if (changed.length && changed.every((f) => IRRELEVANT.test(f))) {
		console.log('⏭ only non-site files changed — skipping build.');
		process.exit(0);
	}
}
console.log('✅ languages in sync — proceeding with build.');
process.exit(1);
