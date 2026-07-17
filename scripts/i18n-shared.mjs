/**
 * Shared i18n contract: which JSON Resume paths are translatable, plus the
 * path helpers the check/sync/validate scripts use to walk both CV files.
 *
 * Everything not matched by TRANSLATABLE is invariant and must be
 * byte-identical between cv-en.json and cv-es.json.
 */

export const FILES = { en: 'cv-en.json', es: 'cv-es.json' };

// Translatable field patterns (JSON Resume). Array leaves end in [].
export const TRANSLATABLE = new Set([
	'basics.label',
	'basics.summary',
	'work[].position',
	'work[].summary',
	'work[].highlights[]',
	'volunteer[].position',
	'volunteer[].summary',
	'volunteer[].highlights[]',
	'education[].area',
	'education[].studyType',
	'education[].courses[]',
	'awards[].title',
	'awards[].summary',
	'certificates[].name',
	'publications[].summary',
	'skills[].level',
	'skills[].keywords[]',
	'languages[].language',
	'languages[].fluency',
	'interests[].name',
	'interests[].keywords[]',
	'references[].reference',
	'projects[].description',
	'projects[].highlights[]',
]);

const kind = (v) => (Array.isArray(v) ? 'array' : v !== null && typeof v === 'object' ? 'object' : 'leaf');

/** Flatten every translatable leaf of a CV object into path → value. */
export function flattenTranslatable(node, p = '', pattern = '', out = new Map()) {
	const k = kind(node);
	if (k === 'array') node.forEach((v, i) => flattenTranslatable(v, `${p}[${i}]`, `${pattern}[]`, out));
	else if (k === 'object')
		for (const key of Object.keys(node))
			flattenTranslatable(node[key], p ? `${p}.${key}` : key, pattern ? `${pattern}.${key}` : key, out);
	else if (TRANSLATABLE.has(pattern)) out.set(p, node);
	return out;
}

/** Parse "work[0].highlights[2]" into ['work', 0, 'highlights', 2]. */
export function parsePath(path) {
	const segments = [];
	for (const part of path.split('.')) {
		const m = /^([^[\]]+)((\[\d+\])*)$/.exec(part);
		if (!m) throw new Error(`unparseable path segment: ${part}`);
		segments.push(m[1]);
		for (const idx of m[2].matchAll(/\[(\d+)\]/g)) segments.push(Number(idx[1]));
	}
	return segments;
}

export function getByPath(obj, path) {
	return parsePath(path).reduce((node, seg) => (node == null ? undefined : node[seg]), obj);
}

export function setByPath(obj, path, value) {
	const segments = parsePath(path);
	let node = obj;
	for (const seg of segments.slice(0, -1)) {
		if (node[seg] == null) throw new Error(`path does not exist: ${path}`);
		node = node[seg];
	}
	node[segments[segments.length - 1]] = value;
}
