#!/usr/bin/env node
/**
 * i18n-sync — translate the CV fields that changed in one language into the
 * other one (PRD §6.2).
 *
 * Reads the coherence report (scripts/i18n-check.mjs --json) against a
 * baseline, decides the direction from the git diff, translates only the
 * fields the diff singled out, and rewrites the target file. Branching,
 * committing, and PR creation belong to the workflow, not to this script.
 *
 * Usage:
 *  node scripts/i18n-sync.mjs --base <ref> [--provider openai|mock]
 *                             [--dry-run] [--json]
 *  node scripts/i18n-sync.mjs --smoke [--provider openai|mock]
 *
 * --smoke translates the real tagline and summary in both directions and
 * prints them (PRD Fase 2 quality gate) without touching any file.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { FILES, flattenTranslatable, getByPath, setByPath } from './i18n-shared.mjs';
import { createClient, translateFields } from './translation-client.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback = null) =>
	args.includes(name) ? args[args.indexOf(name) + 1] : fallback;

const BASE = option('--base');
const PROVIDER = option('--provider', 'openai');
const DRY_RUN = flag('--dry-run');
const JSON_OUT = flag('--json');
const SMOKE = flag('--smoke');

const git = (...cmd) =>
	execFileSync('git', cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

const readCv = (lang) => JSON.parse(readFileSync(path.join(ROOT, FILES[lang]), 'utf8'));
const readCvAt = (ref, lang) => {
	try {
		return JSON.parse(git('show', `${ref}:${FILES[lang]}`));
	} catch {
		return null;
	}
};

function writeCv(lang, cv) {
	writeFileSync(path.join(ROOT, FILES[lang]), `${JSON.stringify(cv, null, 2)}\n`);
}

function report(result) {
	if (JSON_OUT) console.log(JSON.stringify(result, null, 2));
	else {
		console.log(`i18n-sync: ${result.status}`);
		for (const line of result.log ?? []) console.log(`  ${line}`);
	}
}

async function smoke() {
	const client = createClient({ provider: PROVIDER });
	const en = readCv('en');
	const es = readCv('es');
	const cases = [
		{ source: 'en', target: 'es', items: [
			{ path: 'basics.label', text: en.basics.label },
			{ path: 'basics.summary', text: en.basics.summary },
		] },
		{ source: 'es', target: 'en', items: [
			{ path: 'basics.label', text: es.basics.label },
			{ path: 'basics.summary', text: es.basics.summary },
		] },
	];

	for (const { source, target, items } of cases) {
		const translated = await translateFields(client, items, source, target);
		console.log(`\n=== ${source} → ${target} ===`);
		for (const { path: p, text } of items) {
			console.log(`\n[${p}]`);
			console.log(`  ${source}: ${text}`);
			console.log(`  ${target}: ${translated.get(p)}`);
		}
	}
}

function runCheck() {
	try {
		const stdout = execFileSync(
			process.execPath,
			[path.join(ROOT, 'scripts/i18n-check.mjs'), '--json', ...(BASE ? ['--base', BASE] : [])],
			{ cwd: ROOT, encoding: 'utf8' },
		);
		return JSON.parse(stdout);
	} catch (error) {
		if (error.stdout) return JSON.parse(error.stdout.toString());
		throw error;
	}
}

async function main() {
	if (SMOKE) return smoke();

	if (!BASE) {
		console.error('i18n-sync: --base <ref> is required (the pre-push commit)');
		process.exit(2);
	}

	const check = runCheck();

	if (check.coherent) {
		report({ status: 'coherent — nothing to translate', changed: [] });
		return;
	}

	const changedFiles = git('diff', '--name-only', BASE, '--', FILES.en, FILES.es)
		.split('\n')
		.filter(Boolean);
	const enChanged = changedFiles.includes(FILES.en);
	const esChanged = changedFiles.includes(FILES.es);

	if (!enChanged && !esChanged) {
		report({
			status: 'incoherent, but neither CV file changed against the baseline — human review needed',
			problems: check,
		});
		process.exit(1);
	}

	if (check.structure.length > 0 && enChanged && esChanged) {
		report({
			status: 'structure mismatch with edits on both files — cannot pick a source of truth, human review needed',
			problems: check.structure,
		});
		process.exit(1);
	}

	const client = createClient({ provider: PROVIDER });
	const log = [];
	const changed = [];

	if (check.structure.length === 0) {
		// Same shape on both sides: translate exactly the stale leaves the
		// check reported, in whichever direction each one needs.
		const byDirection = new Map();
		for (const { path: p, source, target } of check.stale) {
			const key = `${source}->${target}`;
			if (!byDirection.has(key)) byDirection.set(key, { source, target, items: [] });
			byDirection.get(key).items.push({ path: p, text: getByPath(readCv(source), p) });
		}

		const targets = { en: readCv('en'), es: readCv('es') };
		for (const { source, target, items } of byDirection.values()) {
			const translated = await translateFields(client, items, source, target);
			for (const { path: p, text } of items) {
				setByPath(targets[target], p, translated.get(p));
				changed.push({ path: p, source, target, from: text, to: translated.get(p) });
				log.push(`${p}: ${source} → ${target}`);
			}
			if (!DRY_RUN) writeCv(target, targets[target]);
		}
	} else {
		// Structure changed on exactly one side: that side is the source of
		// truth. Rebuild the target from the source structure, keeping every
		// existing translation whose source text still appears — matched by
		// value, so insertions and reorders don't re-translate what already
		// has a reviewed translation.
		const source = enChanged ? 'en' : 'es';
		const target = source === 'en' ? 'es' : 'en';
		const sourceCv = readCv(source);
		const targetCv = readCv(target);
		const baseSource = readCvAt(BASE, source);

		const oldSourceLeaves = baseSource ? flattenTranslatable(baseSource) : new Map();
		const targetLeaves = flattenTranslatable(targetCv);
		const knownTranslations = new Map();
		for (const [p, sourceText] of oldSourceLeaves) {
			if (targetLeaves.has(p)) knownTranslations.set(sourceText, targetLeaves.get(p));
		}

		const rebuilt = structuredClone(sourceCv);
		const needsTranslation = [];

		for (const [p, sourceText] of flattenTranslatable(rebuilt)) {
			if (knownTranslations.has(sourceText)) {
				setByPath(rebuilt, p, knownTranslations.get(sourceText));
			} else {
				needsTranslation.push({ path: p, text: sourceText });
			}
		}

		const translated = await translateFields(client, needsTranslation, source, target);
		for (const { path: p, text } of needsTranslation) {
			setByPath(rebuilt, p, translated.get(p));
			changed.push({ path: p, source, target, from: text, to: translated.get(p) });
			log.push(`${p}: ${source} → ${target}`);
		}

		if (!DRY_RUN) writeCv(target, rebuilt);
	}

	report({
		status: DRY_RUN ? 'dry run — no files written' : 'target file updated',
		changed,
		log,
	});
}

await main();
