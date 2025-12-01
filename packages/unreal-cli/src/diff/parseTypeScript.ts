import type {
	SchemaAST,
	TableAST,
	FieldAST,
	IndexAST,
} from "../introspection/types";
import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { createJiti } from "jiti";
import type { AnyModelClass, FieldDefinition } from "unreal-orm";

// Create a jiti instance for importing TypeScript files
const jiti = createJiti(import.meta.url, {
	// Enable TypeScript support
	interopDefault: true,
});

/**
 * Extracts SchemaAST from runtime model classes.
 * This is MUCH simpler than parsing TypeScript AST - we just import the files
 * and read the schema from the model class instances!
 *
 * The model classes already have all the metadata we need:
 * - modelClass._tableName
 * - modelClass._options (type, schemafull, permissions, etc.)
 * - modelClass._fields
 * - IndexDefinition instances
 */
export async function extractSchemaFromRuntime(
	outputDir: string,
): Promise<SchemaAST> {
	const tables: TableAST[] = [];

	for (const file of readdirSync(outputDir).filter((f) => f.endsWith(".ts"))) {
		const filePath = resolve(join(outputDir, file));

		try {
			// Use jiti to import TypeScript files
			const module = await jiti.import(filePath);

			// Find exported model classes and indexes
			const tableMap = new Map<string, TableAST>();
			const indexes: { index: IndexAST; tableName: string }[] = [];

			for (const [exportName, exportValue] of Object.entries(
				module as Record<string, unknown>,
			)) {
				// Check if it's a model class (has _tableName)
				if (isModelClass(exportValue)) {
					const tableAST = extractTableFromModel(exportValue);
					tableMap.set(tableAST.name, tableAST);
				}
				// Check if it's an index definition
				else if (isIndexDefinition(exportValue)) {
					const { index, tableName } = extractIndexFromDefinition(exportValue);
					indexes.push({ index, tableName });
				}
			}

			// Associate indexes with their tables
			for (const { index, tableName } of indexes) {
				const table = tableMap.get(tableName);
				if (table) {
					table.indexes.push(index);
				}
			}

			// Add all tables to the result
			tables.push(...tableMap.values());
		} catch (error) {
			console.warn(`Failed to import ${file}:`, error);
			// Skip files that can't be imported
		}
	}

	return { tables };
}

/**
 * Type guard to check if an export is a model class.
 */
function isModelClass(value: unknown): value is AnyModelClass {
	return (
		typeof value === "function" &&
		"_tableName" in value &&
		"_options" in value &&
		"_fields" in value
	);
}

interface IndexDefinitionRuntime {
	_type: "index";
	name: string;
	table: AnyModelClass;
	fields: string[];
	unique?: boolean;
	analyzer?: string;
}

/**
 * Type guard to check if an export is an index definition.
 */
function isIndexDefinition(value: unknown): value is IndexDefinitionRuntime {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	const obj = value as Record<string, unknown>;
	return (
		obj._type === "index" &&
		typeof obj.name === "string" &&
		"table" in obj &&
		Array.isArray(obj.fields)
	);
}

/**
 * Extracts IndexAST from a runtime index definition.
 * Returns both the index and the table name it belongs to.
 */
export function extractIndexFromDefinition(indexDef: IndexDefinitionRuntime): {
	index: IndexAST;
	tableName: string;
} {
	return {
		index: {
			name: indexDef.name,
			columns: indexDef.fields,
			unique: indexDef.unique ?? false,
		},
		tableName: indexDef.table._tableName,
	};
}

/**
 * Recursively enumerates all subfields of a field definition, matching the ORM's enumerateSubfields.
 */
function enumerateSubfields(
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

/**
 * Extracts fields from a model class, flattening nested objects like the database parser.
 */
function extractFieldsFromModel(modelClass: AnyModelClass): FieldAST[] {
	const fields: FieldAST[] = [];

	// Check if _fields exists and is an object
	if (!modelClass._fields || typeof modelClass._fields !== "object") {
		return [];
	}

	for (const [fieldName, fieldDef] of Object.entries(modelClass._fields)) {
		// Enumerate all subfields (flattened with dot notation)
		const subfields = enumerateSubfields(
			fieldDef as FieldDefinition<unknown>,
			fieldName,
		);

		for (const { path, fieldDef: subDef } of subfields) {
			// Skip wildcard type constraints (they're not real fields)
			if (path.endsWith(".*")) continue;

			const fieldAST = extractFieldFromDefinition(path, subDef);
			fields.push(fieldAST);
		}
	}

	return fields;
}

/**
 * Extracts a TableAST from a runtime model class.
 */
export function extractTableFromModel(modelClass: AnyModelClass): TableAST {
	const options = modelClass._options;

	// Extract fields
	const fields = extractFieldsFromModel(modelClass);

	return {
		name: modelClass._tableName,
		type:
			(options.type?.toUpperCase() as "NORMAL" | "RELATION" | "VIEW") ||
			"NORMAL",
		drop: false,
		schemafull: options.schemafull ?? true,
		viewQuery:
			options.type === "view" && options.as ? String(options.as) : undefined,
		permissions: extractPermissions(options.permissions),
		fields,
		indexes: [], // Indexes are separate exports
		events: [], // Not currently supported
	};
}

/**
 * Converts a value to string, handling BoundQuery objects from surql templates.
 */
function valueToString(value: unknown): string | undefined {
	if (!value) return undefined;

	// Handle BoundQuery objects from surql`` templates
	if (typeof value === "object" && value !== null && "query" in value) {
		return (value as { query: string }).query;
	}

	return String(value);
}

/**
 * Extracts FieldAST from a runtime field definition.
 */
function extractFieldFromDefinition(
	name: string,
	fieldDef: FieldDefinition<unknown>,
): FieldAST {
	return {
		name,
		type: fieldDef.type,
		flex: fieldDef.flexible ?? false,
		default: valueToString(fieldDef.default),
		value: valueToString(fieldDef.value),
		assert: valueToString(fieldDef.assert),
		permissions: extractPermissions(fieldDef.permissions),
	};
}

/**
 * Extracts permissions from various permission formats.
 */
function extractPermissions(perms: unknown): {
	select?: string;
	create?: string;
	update?: string;
	delete?: string;
} {
	if (!perms) return {};

	// Handle object format
	if (typeof perms === "object" && perms !== null) {
		const result: Record<string, string> = {};
		for (const [key, value] of Object.entries(perms)) {
			if (value) {
				result[key] = String(value);
			}
		}
		return result;
	}

	return {};
}
