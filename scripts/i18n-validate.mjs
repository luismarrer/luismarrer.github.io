#!/usr/bin/env node
/**
 * i18n-validate — delegated reviewer for translation PRs (PRD §6.4).
 *
 * Role-separated from the translator: it reviews the PR's full CV state
 * (including manual edits) for EN↔ES semantic equivalence plus the README
 * content rules, and returns an auditable verdict.
 *
 * The workflow (running base-branch code only) extracts the PR head's
 * cv-en.json / cv-es.json into a directory and calls:
 *
 *  node scripts/i18n-validate.mjs --dir <head-files-dir>
 *                                 [--provider openai|mock] [--json]
 *
 * Output (stdout, JSON): {
 *   verdict: 'approve' | 'fix' | 'abstain',
 *   summary: string,
 *   corrections: [{ file: 'cv-en.json'|'cv-es.json', path, value, reason }]
 * }
 *
 * On 'fix' the corrected files are also written back into --dir so the
 * workflow can commit them to the PR branch.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { FILES, flattenTranslatable, setByPath } from './i18n-shared.mjs';
import { CONTENT_RULES, createClient } from './translation-client.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const option = (name, fallback = null) =>
	args.includes(name) ? args[args.indexOf(name) + 1] : fallback;

const DIR = option('--dir');
const PROVIDER = option('--provider', 'openai');

if (!DIR) {
	console.error('i18n-validate: --dir <head-files-dir> is required');
	process.exit(2);
}

function emit(result) {
	console.log(JSON.stringify(result, null, 2));
	process.exit(0);
}

// 1) Structural gate: same shape + identical invariants, using the same
//    code production uses. A structural mismatch is never auto-fixed.
let structural;
try {
	const stdout = execFileSync(
		process.execPath,
		[path.join(ROOT, 'scripts/i18n-check.mjs'), '--json', '--dir', DIR],
		{ cwd: ROOT, encoding: 'utf8' },
	);
	structural = JSON.parse(stdout);
} catch (error) {
	structural = error.stdout ? JSON.parse(error.stdout.toString()) : null;
}

if (!structural) {
	emit({
		verdict: 'abstain',
		summary: 'could not run the structural coherence check on the PR head',
		corrections: [],
	});
}

if (structural.structure.length > 0 || structural.invariant.length > 0) {
	emit({
		verdict: 'abstain',
		summary:
			'structural or invariant mismatch between cv-en.json and cv-es.json — needs a human:\n' +
			[...structural.structure, ...structural.invariant].map((p) => `- ${p}`).join('\n'),
		corrections: [],
	});
}

// 2) Semantic review of every translatable pair (the reviewer sees the full
//    files, so manual edits inside the PR are reviewed too).
const cvEn = JSON.parse(readFileSync(path.join(DIR, FILES.en), 'utf8'));
const cvEs = JSON.parse(readFileSync(path.join(DIR, FILES.es), 'utf8'));

const enLeaves = flattenTranslatable(cvEn);
const esLeaves = flattenTranslatable(cvEs);
const pairs = [...enLeaves.entries()].map(([p, en]) => ({ path: p, en, es: esLeaves.get(p) }));

const system = `You are the delegated reviewer for a bilingual (English/Spanish) JSON Resume
portfolio. You did NOT produce these translations; judge them critically.

For every pair, check:
1. Semantic equivalence: both languages must say the same thing. Nuance loss,
   additions, omissions, or mistranslations are defects.
2. Natural register: the Spanish must read like a native resume, not like a
   literal machine translation (and vice versa).
${CONTENT_RULES}

Verdicts:
- "approve": every pair is equivalent and rule-compliant.
- "fix": one or more pairs have small, unambiguous defects you can correct
  with full confidence. Provide the corrected values.
- "abstain": something is wrong but the correction requires an editorial
  decision (meaning unclear, content missing, rules conflict). Explain why.

Never invent content. Corrections must only touch the defective field.`;

const user = `Review these translatable field pairs (path, English value, Spanish value):
${JSON.stringify({ pairs }, null, 2)}

Return the verdict JSON. For corrections, "file" is the file to change
("cv-en.json" or "cv-es.json"), "path" is the field path, "value" the
corrected text, and "reason" a one-line justification.`;

const schema = {
	type: 'object',
	additionalProperties: false,
	required: ['verdict', 'summary', 'corrections'],
	properties: {
		verdict: { type: 'string', enum: ['approve', 'fix', 'abstain'] },
		summary: { type: 'string' },
		corrections: {
			type: 'array',
			items: {
				type: 'object',
				additionalProperties: false,
				required: ['file', 'path', 'value', 'reason'],
				properties: {
					file: { type: 'string', enum: [FILES.en, FILES.es] },
					path: { type: 'string' },
					value: { type: 'string' },
					reason: { type: 'string' },
				},
			},
		},
	},
};

const client = createClient({ provider: PROVIDER });
const result = await client.completeJson({
	system,
	user,
	schemaName: 'validation',
	schema,
});

// 3) On "fix", write corrected files back into --dir for the workflow to
//    commit. A verdict of "fix" without corrections degrades to abstain.
if (result.verdict === 'fix') {
	if (result.corrections.length === 0) {
		emit({
			verdict: 'abstain',
			summary: `reviewer answered "fix" without corrections — treating as abstain. ${result.summary}`,
			corrections: [],
		});
	}

	const files = { [FILES.en]: cvEn, [FILES.es]: cvEs };
	for (const { file, path: fieldPath, value } of result.corrections) {
		setByPath(files[file], fieldPath, value);
	}
	for (const [file, cv] of Object.entries(files)) {
		writeFileSync(path.join(DIR, file), `${JSON.stringify(cv, null, 2)}\n`);
	}
}

emit(result);
