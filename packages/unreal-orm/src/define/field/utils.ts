// Field utility functions for Unreal-ORM (migrated from fieldUtils.ts)

import type { FieldDefinition } from "./types";

/**
 * Recursively enumerates all subfields of a `FieldDefinition`, including nested arrays and objects.
 * It returns a flattened array of all fields and their corresponding paths (e.g., `meta.views` or `items[*].name`).
 * This is a crucial utility for the schema generator to correctly define deeply nested structures in SurrealDB.
 *
 * @internal This is a low-level utility for schema generation and is not intended for direct use.
 * @param fieldDef The root `FieldDefinition` to start the enumeration from.
 * @param basePath The initial path for the root field.
 * @returns An array of objects, each containing the `path` string and the `fieldDef` for a field.
 */
export function enumerateSubfields(
	fieldDef: FieldDefinition<unknown>,
	basePath = "",
): Array<{ path: string; fieldDef: FieldDefinition<unknown> }> {
	const results: Array<{ path: string; fieldDef: FieldDefinition<unknown> }> =
		[];
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
