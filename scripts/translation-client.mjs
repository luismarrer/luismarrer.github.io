/**
 * Provider-decoupled LLM client for the i18n pipeline (PRD §6.2, §6.4).
 *
 * The sync and validate scripts only know `createClient(...).completeJson()`.
 * Swapping the provider means editing this file — never the pipeline logic.
 *
 * Providers:
 *  - openai (default): Chat Completions with a strict JSON schema response.
 *    Needs OPENAI_API_KEY; model from OPENAI_MODEL (default gpt-4o-mini).
 *  - mock: deterministic pseudo-translations for plumbing tests and CI dry
 *    runs. Never use for real content.
 */

export const CONTENT_RULES = `Content rules (from the repository README — both the translator and the
validator must obey them):
- cv-en.json and cv-es.json must contain the same content, translated.
- Keep names of technologies, products, tools, and organizations in their
  original form (TypeScript, Next.js, Excel, GitHub, SAC, ...).
- Project titles: maximum 2 words.
- Project descriptions: one sentence, maximum 90 characters.
- Projects: no more than 3 highlights each.
- Preserve the professional, concise tone of the original.
- Spanish uses sentence-style capitalization; do not invent content that the
  source language does not contain.`;

const LANGUAGE_NAMES = { en: 'English', es: 'Spanish' };

export function languageName(code) {
	return LANGUAGE_NAMES[code] ?? code;
}

export function createClient({ provider = 'openai', apiKey, model } = {}) {
	if (provider === 'mock') return createMockClient();
	if (provider === 'openai') return createOpenAiClient({ apiKey, model });
	throw new Error(`unknown translation provider: ${provider}`);
}

function createOpenAiClient({ apiKey = process.env.OPENAI_API_KEY, model = process.env.OPENAI_MODEL || 'gpt-4o-mini' }) {
	if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

	return {
		provider: 'openai',
		/**
		 * Run one JSON-schema-constrained completion.
		 * @param {{ system: string, user: string, schemaName: string, schema: object }} request
		 * @returns {Promise<object>} the parsed JSON response
		 */
		async completeJson({ system, user, schemaName, schema }) {
			const response = await fetch('https://api.openai.com/v1/chat/completions', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					authorization: `Bearer ${apiKey}`,
				},
				body: JSON.stringify({
					model,
					messages: [
						{ role: 'system', content: system },
						{ role: 'user', content: user },
					],
					response_format: {
						type: 'json_schema',
						json_schema: { name: schemaName, strict: true, schema },
					},
				}),
			});

			if (!response.ok) {
				const body = await response.text();
				throw new Error(`OpenAI request failed (${response.status}): ${body.slice(0, 400)}`);
			}

			const payload = await response.json();
			const content = payload.choices?.[0]?.message?.content;
			if (!content) throw new Error('OpenAI response had no content');
			return JSON.parse(content);
		},
	};
}

function createMockClient() {
	return {
		provider: 'mock',
		// The mock consumes the structured `payload`, never the prose prompt,
		// so prompt-wording edits cannot break plumbing tests.
		async completeJson({ schemaName, payload }) {
			if (schemaName === 'translations') {
				const { items, target } = payload;
				return {
					translations: items.map(({ path, text }) => ({
						path,
						translation: `[${target}] ${text}`,
					})),
				};
			}
			if (schemaName === 'validation') {
				return {
					verdict: 'abstain',
					summary: 'mock provider cannot judge translation quality',
					corrections: [],
				};
			}
			throw new Error(`mock client: unknown schema ${schemaName}`);
		},
	};
}

/**
 * Translate a batch of CV fields. Pure orchestration over completeJson so
 * every provider shares the same prompt and schema.
 *
 * @param {object} client from createClient
 * @param {{ path: string, text: string }[]} items
 * @param {'en'|'es'} source
 * @param {'en'|'es'} target
 * @returns {Promise<Map<string, string>>} path → translated text
 */
export async function translateFields(client, items, source, target) {
	if (items.length === 0) return new Map();

	const system = `You translate resume content between English and Spanish for a JSON Resume
portfolio. Translate naturally — no literal word-by-word renderings — while
preserving meaning, register, and length discipline.

${CONTENT_RULES}

Return only the JSON described by the schema: one translation per input item,
same paths, same order.`;

	const user = `Translate each item's "text" from ${languageName(source)} to ${languageName(target)}.
${JSON.stringify({ items, source, target }, null, 2)}`;

	const schema = {
		type: 'object',
		additionalProperties: false,
		required: ['translations'],
		properties: {
			translations: {
				type: 'array',
				items: {
					type: 'object',
					additionalProperties: false,
					required: ['path', 'translation'],
					properties: {
						path: { type: 'string' },
						translation: { type: 'string' },
					},
				},
			},
		},
	};

	const { translations } = await client.completeJson({
		system,
		user,
		payload: { items, source, target },
		schemaName: 'translations',
		schema,
	});

	const byPath = new Map(translations.map(({ path, translation }) => [path, translation]));
	for (const { path } of items) {
		if (!byPath.has(path)) throw new Error(`translator returned no result for ${path}`);
	}
	return byPath;
}
