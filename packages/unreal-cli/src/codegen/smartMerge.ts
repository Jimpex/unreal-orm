import type {
	SchemaAST,
	TableAST,
	FieldAST,
	IndexAST,
} from "../introspection/types";
import type { SchemaChange } from "../diff/compare";
import { compareSchemas } from "../diff/compare";

/**
 * Result of a smart merge operation
 */
export interface MergeResult {
	content: string;
	addedFields: string[];
	addedIndexes: string[];
	removedFields: string[];
	removedIndexes: string[];
}

/**
 * Intelligently merges database schema changes into existing TypeScript code.
 * Preserves user customizations (comments, custom methods, formatting).
 *
 * Strategy:
 * 1. Find the `fields: {` block in the existing code
 * 2. For new fields: insert at the end of the fields block
 * 3. For new indexes: insert after the class, before Definitions export
 * 4. For removed items: add TODO comments (don't auto-delete user code)
 */
export function smartMergeTableCode(
	existingCode: string,
	dbTable: TableAST,
	codeTable: TableAST,
): MergeResult {
	const changes = compareTableSchemas(dbTable, codeTable);

	if (changes.length === 0) {
		return {
			content: existingCode,
			addedFields: [],
			addedIndexes: [],
			removedFields: [],
			removedIndexes: [],
		};
	}

	let result = existingCode;
	const addedFields: string[] = [];
	const addedIndexes: string[] = [];
	const removedFields: string[] = [];
	const removedIndexes: string[] = [];

	// Process field additions
	const fieldAdditions = changes.filter((c) => c.type === "field_added");
	for (const change of fieldAdditions) {
		if (!change.field) continue;
		const field = dbTable.fields.find((f) => f.name === change.field);
		if (!field) continue;

		// Skip nested fields (e.g., "address.city") - they need special handling
		if (field.name.includes(".")) continue;
		// Skip array element fields
		if (field.name.includes("[*]")) continue;

		const fieldCode = generateFieldCode(field);
		result = insertFieldIntoCode(result, field.name, fieldCode);
		addedFields.push(field.name);
	}

	// Process index additions
	const indexAdditions = changes.filter((c) => c.type === "index_added");
	for (const change of indexAdditions) {
		if (!change.index) continue;
		const index = dbTable.indexes.find((i) => i.name === change.index);
		if (!index) continue;

		const className = capitalize(dbTable.name);
		const indexCode = generateIndexCode(index, className);
		result = insertIndexIntoCode(result, index.name, indexCode, className);
		addedIndexes.push(index.name);
	}

	// Process field removals (comment out fields in code but not in DB)
	const fieldRemovals = changes.filter((c) => c.type === "field_removed");
	for (const change of fieldRemovals) {
		if (!change.field) continue;
		// Skip nested fields
		if (change.field.includes(".")) continue;
		// Skip array element fields
		if (change.field.includes("[*]")) continue;

		result = commentOutField(result, change.field);
		removedFields.push(change.field);
	}

	// Process index removals (comment out indexes in code but not in DB)
	const indexRemovals = changes.filter((c) => c.type === "index_removed");
	for (const change of indexRemovals) {
		if (!change.index) continue;

		result = commentOutIndex(result, change.index);
		removedIndexes.push(change.index);
	}

	return {
		content: result,
		addedFields,
		addedIndexes,
		removedFields,
		removedIndexes,
	};
}

/**
 * Compare two table schemas and return changes
 */
function compareTableSchemas(
	dbTable: TableAST,
	codeTable: TableAST,
): SchemaChange[] {
	const dbSchema: SchemaAST = { tables: [dbTable] };
	const codeSchema: SchemaAST = { tables: [codeTable] };
	return compareSchemas(dbSchema, codeSchema);
}

/**
 * Generate Field.* code for a single field
 */
function generateFieldCode(field: FieldAST): string {
	const options: string[] = [];

	if (field.default) {
		options.push(`default: surql\`${field.default}\``);
	}
	if (field.value) {
		options.push(`value: surql\`${field.value}\``);
	}
	if (field.assert) {
		options.push(`assert: surql\`${field.assert}\``);
	}

	const optionsStr = options.length > 0 ? `{ ${options.join(", ")} }` : "";
	return generateFieldTypeFromString(field.type, optionsStr);
}

/**
 * Maps SurrealDB type string to Field.* method.
 */
function generateFieldTypeFromString(type: string, options: string): string {
	const opt = options || "";

	// Handle option<T>
	if (type.startsWith("option<")) {
		const innerType = type.match(/option<(.+)>/)?.[1];
		if (innerType) {
			return `Field.option(${generateFieldTypeFromString(innerType, "")})${opt ? `, ${opt}` : ""}`;
		}
	}

	// Handle union types: none | T becomes Field.option(T)
	if (type.includes(" | ")) {
		const parts = type.split(" | ").map((t) => t.trim());
		if (parts.includes("none")) {
			const nonNoneTypes = parts.filter((t) => t !== "none");
			if (nonNoneTypes.length === 1 && nonNoneTypes[0]) {
				return `Field.option(${generateFieldTypeFromString(nonNoneTypes[0], "")})${opt ? `, ${opt}` : ""}`;
			}
		}
	}

	if (type === "string") return `Field.string(${opt})`;
	if (type === "int") return `Field.int(${opt})`;
	if (type === "float") return `Field.float(${opt})`;
	if (type === "number") return `Field.number(${opt})`;
	if (type === "bool") return `Field.bool(${opt})`;
	if (type === "datetime") return `Field.datetime(${opt})`;
	if (type === "duration") return `Field.duration(${opt})`;
	if (type === "decimal") return `Field.decimal(${opt})`;
	if (type === "uuid") return `Field.uuid(${opt})`;
	if (type === "bytes") return `Field.bytes(${opt})`;
	if (type === "any") return `Field.any(${opt})`;

	// Handle array<T>
	if (type.startsWith("array<")) {
		const content = type.slice(6, -1);
		const elementField = generateFieldTypeFromString(content, "");
		return `Field.array(${elementField}${opt ? `, ${opt}` : ""})`;
	}

	// Handle set<T>
	if (type.startsWith("set<")) {
		const content = type.slice(4, -1);
		const elementField = generateFieldTypeFromString(content, "");
		return `Field.set(${elementField}${opt ? `, ${opt}` : ""})`;
	}

	// Handle record<table>
	if (type.startsWith("record<")) {
		const match = type.match(/record<(\w+)>/);
		if (match?.[1]) {
			const tableName = match[1];
			return `Field.record(() => ${capitalize(tableName)}${opt ? `, ${opt}` : ""})`;
		}
	}

	// Fallback
	return `Field.custom('${type}'${opt ? `, ${opt}` : ""})`;
}

/**
 * Insert a new field into the fields block of existing code
 */
function insertFieldIntoCode(
	code: string,
	fieldName: string,
	fieldCode: string,
): string {
	// Find the fields: { block
	// We need to find the closing brace of the fields object
	const fieldsMatch = code.match(/fields:\s*\{/);
	if (!fieldsMatch || fieldsMatch.index === undefined) {
		// No fields block found, can't insert
		return code;
	}

	const fieldsStart = fieldsMatch.index + fieldsMatch[0].length;

	// Find the matching closing brace by counting braces
	let braceCount = 1;
	let fieldsEnd = fieldsStart;
	for (let i = fieldsStart; i < code.length && braceCount > 0; i++) {
		if (code[i] === "{") braceCount++;
		if (code[i] === "}") braceCount--;
		if (braceCount === 0) {
			fieldsEnd = i;
			break;
		}
	}

	// Detect indentation from existing fields
	const existingFieldsContent = code.slice(fieldsStart, fieldsEnd);
	const indentMatch = existingFieldsContent.match(/\n(\s+)\w+:/);
	const indent = indentMatch ? indentMatch[1] : "    ";

	// Check if there's already content (need comma handling)
	const trimmedContent = existingFieldsContent.trim();
	const needsLeadingComma =
		trimmedContent.length > 0 && !trimmedContent.endsWith(",");

	// Build the insertion
	let modifiedCode = code;
	let adjustedFieldsEnd = fieldsEnd;

	if (needsLeadingComma) {
		// Find the last non-whitespace position before fieldsEnd
		const lastContentMatch = existingFieldsContent.match(/\S\s*$/);
		if (lastContentMatch && lastContentMatch.index !== undefined) {
			// Insert comma after last content
			const insertPos = fieldsStart + lastContentMatch.index + 1;
			modifiedCode = `${code.slice(0, insertPos)},${code.slice(insertPos)}`;
			adjustedFieldsEnd++; // Adjust for inserted comma
		}
	}

	// Insert the new field before the closing brace
	const insertion = `\n${indent}// Added from database\n${indent}${fieldName}: ${fieldCode},`;

	return `${modifiedCode.slice(0, adjustedFieldsEnd)}${insertion}\n${modifiedCode.slice(adjustedFieldsEnd)}`;
}

/**
 * Insert a new index into the code after the class definition
 */
function insertIndexIntoCode(
	code: string,
	indexName: string,
	indexCode: string,
	className: string,
): string {
	// Find the Definitions export to insert before it
	const definitionsMatch = code.match(
		new RegExp(`export const ${className}Definitions\\s*=`),
	);

	if (definitionsMatch && definitionsMatch.index !== undefined) {
		// Insert before Definitions export
		const insertPos = definitionsMatch.index;
		const insertion = `// Added from database\n${indexCode}\n`;

		// Also need to add the index to the Definitions array
		let newCode = code.slice(0, insertPos) + insertion + code.slice(insertPos);

		// Update the Definitions array to include the new index
		const varName = indexName.replace(/[^a-zA-Z0-9_]/g, "_");
		newCode = newCode.replace(
			new RegExp(
				`(export const ${className}Definitions\\s*=\\s*\\[${className})([,\\s\\w]*)(\\])`,
			),
			`$1$2, ${varName}$3`,
		);

		return newCode;
	}

	// No Definitions export found, append at end
	return `${code}\n// Added from database\n${indexCode}`;
}

/**
 * Generate index definition code
 */
function generateIndexCode(index: IndexAST, tableClassName: string): string {
	const varName = index.name.replace(/[^a-zA-Z0-9_]/g, "_");
	let code = `export const ${varName} = Index.define(() => ${tableClassName}, {\n`;
	code += `  name: "${index.name}",\n`;
	code += `  fields: [${index.columns.map((c) => `"${c}"`).join(", ")}],\n`;
	if (index.unique) {
		code += "  unique: true,\n";
	}
	code += "});\n";
	return code;
}

/**
 * Comment out a field that exists in code but not in database.
 * Supports multi-line field definitions with nested objects/arrays.
 * Adds a "Removed from database" comment.
 */
function commentOutField(code: string, fieldName: string): string {
	// Find the start of the field definition: fieldName: Field.
	// Also match fieldName: { for nested object fields
	const fieldStartRegex = new RegExp(
		`([ \\t]*)(${escapeRegex(fieldName)}\\s*:\\s*(?:Field\\.|\\{))`,
	);
	const startMatch = code.match(fieldStartRegex);

	if (!startMatch || startMatch.index === undefined) {
		return code;
	}

	const indent = startMatch[1] ?? "";
	const startPos = startMatch.index + indent.length; // Start after indentation

	// Find the end by counting parens, braces, and brackets
	// Field ends at the comma (or closing brace if last field)
	let parenCount = 0;
	let braceCount = 0;
	let bracketCount = 0;
	let endPos = startPos;
	let inString = false;
	let stringChar = "";
	let inTemplate = false;

	for (let i = startPos; i < code.length; i++) {
		const char = code[i];
		const prevChar = i > 0 ? code[i - 1] : "";

		// Handle string literals (skip content inside strings)
		if ((char === '"' || char === "'" || char === "`") && prevChar !== "\\") {
			if (!inString && !inTemplate) {
				if (char === "`") {
					inTemplate = true;
				} else {
					inString = true;
					stringChar = char;
				}
			} else if (inTemplate && char === "`") {
				inTemplate = false;
			} else if (inString && char === stringChar) {
				inString = false;
			}
			continue;
		}

		if (inString || inTemplate) continue;

		// Count brackets
		if (char === "(") parenCount++;
		if (char === ")") parenCount--;
		if (char === "{") braceCount++;
		if (char === "}") braceCount--;
		if (char === "[") bracketCount++;
		if (char === "]") bracketCount--;

		// Field ends when we hit a comma at depth 0, or closing brace at depth -1
		if (parenCount === 0 && bracketCount === 0) {
			if (braceCount === 0 && char === ",") {
				endPos = i + 1; // Include the comma
				break;
			}
			if (braceCount === -1 && char === "}") {
				// Last field before closing brace - don't include the brace
				endPos = i;
				// Trim trailing whitespace/newlines before the brace
				while (endPos > startPos && /\s/.test(code[endPos - 1] || "")) {
					endPos--;
				}
				break;
			}
		}
	}

	const fieldCode = code.slice(startPos, endPos);
	const lines = fieldCode.split("\n");

	// Comment out each line, preserving original indentation
	// For each line, insert "// " after the leading whitespace
	const commented = lines
		.map((line, idx) => {
			if (idx === 0) {
				// First line - add base indent + comment
				return `${indent}// ${line}`;
			}
			// Subsequent lines - preserve their indentation, insert // after it
			const lineIndentMatch = line.match(/^(\s*)/);
			const lineIndent = lineIndentMatch?.[1] ?? "";
			const lineContent = line.slice(lineIndent.length);
			return `${lineIndent}// ${lineContent}`;
		})
		.join("\n");

	const header = `${indent}// Removed from database - uncomment if needed\n`;

	return code.slice(0, startPos) + header + commented + code.slice(endPos);
}

/**
 * Comment out an index that exists in code but not in database.
 * Adds a "Removed from database" comment.
 */
function commentOutIndex(code: string, indexName: string): string {
	const varName = indexName.replace(/[^a-zA-Z0-9_]/g, "_");

	// Find the start of the index definition
	const indexStartRegex = new RegExp(
		`export\\s+const\\s+${escapeRegex(varName)}\\s*=\\s*Index\\.define`,
	);
	const startMatch = code.match(indexStartRegex);

	if (!startMatch || startMatch.index === undefined) {
		return code;
	}

	const startPos = startMatch.index;

	// Find the end by counting braces and parentheses
	let braceCount = 0;
	let parenCount = 0;
	let endPos = startPos;
	let started = false;

	for (let i = startPos; i < code.length; i++) {
		const char = code[i];
		if (char === "(") {
			parenCount++;
			started = true;
		}
		if (char === ")") parenCount--;
		if (char === "{") braceCount++;
		if (char === "}") braceCount--;

		// End when we've closed all parens and braces after starting
		if (started && parenCount === 0 && braceCount === 0) {
			// Include the semicolon if present
			endPos = i + 1;
			if (code[i + 1] === ";") endPos = i + 2;
			break;
		}
	}

	const indexCode = code.slice(startPos, endPos);
	const lines = indexCode.split("\n");
	// Preserve indentation on each line - insert // after leading whitespace
	const commented = lines
		.map((line) => {
			const lineIndentMatch = line.match(/^(\s*)/);
			const lineIndent = lineIndentMatch?.[1] ?? "";
			const lineContent = line.slice(lineIndent.length);
			return `${lineIndent}// ${lineContent}`;
		})
		.join("\n");
	const replacement = `// Removed from database - uncomment if needed\n${commented}`;

	let result = code.slice(0, startPos) + replacement + code.slice(endPos);

	// Also remove from Definitions array if present
	const defRegex = new RegExp(`,\\s*${escapeRegex(varName)}(?=[\\s,\\]])`);
	result = result.replace(defRegex, "");

	return result;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Converts a string to PascalCase.
 */
function capitalize(str: string): string {
	return str
		.split("_")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join("");
}
