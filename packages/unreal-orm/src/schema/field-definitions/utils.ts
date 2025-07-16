// Field utility functions for Unreal-ORM (migrated from fieldUtils.ts)

import type { FieldDefinition } from "./definitions";

/**
 * Recursively enumerate all subfields of a FieldDefinition, including nested arrays and objects.
 * Returns an array of { path, fieldDef } for each subfield, including the root.
 * Used by the schema generator to emit SurrealQL for deeply nested structures.
 *
 * @param fieldDef The root FieldDefinition
 * @param basePath The base path (e.g., 'items', or 'items[*]')
 */
export function enumerateSubfields(
	fieldDef: FieldDefinition<unknown>,
	basePath = "",
): Array<{ path: string; fieldDef: FieldDefinition<unknown> }> {
	const results: Array<{ path: string; fieldDef: FieldDefinition<unknown> }> = [];
	const path = basePath;
	results.push({ path, fieldDef });

	// Handle array of objects/arrays recursively
	if (fieldDef.type.startsWith("array<") && fieldDef.arrayElementType) {
		const arrPath = path ? `${path}[*]` : "[*]";
		results.push(...enumerateSubfields(fieldDef.arrayElementType, arrPath));
	}

	// Handle option<object> and similar wrappers
	// If this is an option type that wraps an object, we want to enumerate subfields as well.
	// This works for type === 'option<object>' or type.startsWith('option<') && objectSchema
	if (
		(fieldDef.type === "object" ||
			(fieldDef.type.startsWith("option<") && fieldDef.objectSchema)) &&
		fieldDef.objectSchema
	) {
		for (const [subKey, subDef] of Object.entries(fieldDef.objectSchema)) {
			const objPath = path ? `${path}.${subKey}` : subKey;
			results.push(...enumerateSubfields(subDef, objPath));
		}
	}

	return results;
}
