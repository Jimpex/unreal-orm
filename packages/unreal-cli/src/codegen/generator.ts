import type { FieldAST, IndexAST, SchemaAST, TableAST } from "unreal-orm";

/**
 * Generates TypeScript code from a schema AST.
 */
export function generateCode(schema: SchemaAST): Map<string, string> {
	const files = new Map<string, string>();

	for (const table of schema.tables) {
		const code = generateTableCode(table);
		files.set(`${capitalize(table.name)}.ts`, code);
	}

	return files;
}

/**
 * Recursively extracts record table references from a type string and adds imports.
 */
function extractRecordImports(
	type: string,
	currentTable: string,
	imports: Set<string>,
): void {
	// Match all record<table> patterns in the type string
	const recordMatches = type.matchAll(/record<(\w+)>/g);
	for (const match of recordMatches) {
		const refTable = match[1];
		// Don't import self
		if (refTable && refTable !== currentTable) {
			imports.add(
				`import { ${capitalize(refTable)} } from './${capitalize(refTable)}';`,
			);
		}
	}
}

/**
 * Generates TypeScript code for a single table.
 */
function generateTableCode(table: TableAST): string {
	const imports = new Set<string>();
	imports.add("import { Table, Field, Index } from 'unreal-orm';");
	imports.add("import { surql } from 'surrealdb';");

	// Collect imports for record references (including nested in arrays, options, etc.)
	for (const field of table.fields) {
		extractRecordImports(field.type, table.name, imports);
	}

	const className = capitalize(table.name);
	const indexNames: string[] = [];

	let code = `${Array.from(imports).join("\n")}\n\n`;

	// Generate table class
	if (table.type === "VIEW") {
		code += `export class ${className} extends Table.view({\n`;
		code += `  name: "${table.name}",\n`;
		if (table.viewQuery) {
			code += `  as: surql\`${table.viewQuery}\`,\n`;
		}
		code += "}) {}\n";
	} else if (table.type === "RELATION") {
		code += `export class ${className} extends Table.relation({\n`;
		code += `  name: "${table.name}",\n`;
		if (table.schemafull) {
			code += "  schemafull: true,\n";
		}
		code += "  fields: {\n";
		code += generateFieldsCode(table.fields, "    ");
		code += "  },\n";
		code += "}) {}\n";
	} else {
		code += `export class ${className} extends Table.normal({\n`;
		code += `  name: "${table.name}",\n`;
		if (table.schemafull) {
			code += "  schemafull: true,\n";
		}
		code += "  fields: {\n";
		code += generateFieldsCode(table.fields, "    ");
		code += "  },\n";
		code += "}) {}\n";
	}

	// Generate indexes
	if (table.indexes.length > 0) {
		code += "\n";
		for (const index of table.indexes) {
			const varName = index.name.includes(table.name)
				? index.name
				: `${table.name}_${index.name}`;
			const safeVarName = varName.replace(/[^a-zA-Z0-9_]/g, "_");
			code += generateIndexCode(index, className, safeVarName);
			indexNames.push(safeVarName);
		}
	}

	// Generate Definitions export
	code += `\nexport const ${className}Definitions = [${className}${
		indexNames.length > 0 ? `, ${indexNames.join(", ")}` : ""
	}];\n`;

	return code;
}

interface FieldNode {
	field?: FieldAST;
	children: Map<string, FieldNode>;
}

function buildFieldTree(fields: FieldAST[]): FieldNode {
	const root: FieldNode = { children: new Map() };
	for (const field of fields) {
		const parts = field.name.split(".");
		let current = root;
		for (const part of parts) {
			if (!current.children.has(part)) {
				const newNode: FieldNode = { children: new Map() };
				current.children.set(part, newNode);
				current = newNode;
			} else {
				// biome-ignore lint/style/noNonNullAssertion: Key exists check above
				current = current.children.get(part)!;
			}
		}
		current.field = field;
	}
	return root;
}

/**
 * Generates field definitions code handling nested objects.
 */
function generateFieldsCode(fields: FieldAST[], indent: string): string {
	// Filter out wildcard fields (e.g., "family_members.*") as they're type constraints, not actual fields
	const filteredFields = fields.filter((f) => !f.name.endsWith(".*"));
	const root = buildFieldTree(filteredFields);
	return generateFieldsTreeCode(root, indent);
}

function generateFieldsTreeCode(node: FieldNode, indent: string): string {
	let code = "";
	for (const [name, child] of node.children) {
		// Check if it's an object (has children)
		if (child.children.size > 0) {
			const options = child.field ? extractOptionsString(child.field) : "";
			code += `${indent}${name}: Field.object({\n`;
			code += generateFieldsTreeCode(child, `${indent}  `);
			code += `${indent}}${options ? `, ${options}` : ""}),\n`;
		} else if (child.field) {
			code += `${indent}${name}: ${generateFieldType(child.field)},\n`;
		}
	}
	return code;
}

function extractOptionsString(field: FieldAST): string {
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

	return options.length > 0 ? `{ ${options.join(", ")} }` : "";
}

/**
 * Generates a Field.* call for a field.
 */
function generateFieldType(field: FieldAST): string {
	const optionsStr = extractOptionsString(field);

	// Parse the SurrealDB type and map to Field.*
	const type = field.type;

	// Handle option<T>
	if (type.startsWith("option<")) {
		const innerType = type.match(/option<(.+)>/)?.[1];
		if (innerType) {
			return `Field.option(${generateFieldTypeFromString(innerType, optionsStr || "")})`;
		}
	}

	// Handle union types: none | T becomes Field.option(T)
	if (type.includes(" | ")) {
		const parts = type.split(" | ").map((t) => t.trim());
		// If one part is 'none', treat as optional
		if (parts.includes("none")) {
			const nonNoneTypes = parts.filter((t) => t !== "none");
			if (nonNoneTypes.length === 1 && nonNoneTypes[0]) {
				return `Field.option(${generateFieldTypeFromString(nonNoneTypes[0], optionsStr || "")})`;
			}
			// Multiple non-none types: fall through to custom
		}
		// Complex union without none: use custom with comment
		return `Field.custom('${type}'${optionsStr ? `, ${optionsStr}` : ""}) /* TODO: Specify union type */`;
	}

	return generateFieldTypeFromString(type, optionsStr || "");
}

/**
 * Maps SurrealDB type string to Field.* method.
 */
function generateFieldTypeFromString(type: string, options: string): string {
	const opt = options ? options : "";

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
		// Extract content between array< and last >, handling nested brackets
		const content = type.slice(6, -1); // Remove 'array<' and '>'
		const elementField = generateFieldTypeFromString(content, "");
		return `Field.array(${elementField}${opt ? `, ${opt}` : ""})`;
	}

	// Handle set<T>
	if (type.startsWith("set<")) {
		// Extract content between set< and last >, handling nested brackets
		const content = type.slice(4, -1); // Remove 'set<' and '>'
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
		return `Field.record(() => Object${opt ? `, ${opt}` : ""})`;
	}

	// Handle geometry<type>
	if (type.startsWith("geometry<")) {
		const match = type.match(/geometry<(\w+)>/);
		if (match?.[1]) {
			const geoType = match[1];
			return `Field.geometry('${geoType}'${opt ? `, ${opt}` : ""})`;
		}
	}
	if (type === "geometry") {
		return `Field.geometry('feature'${opt ? `, ${opt}` : ""})`;
	}

	// Handle object (complex, usually handled by tree builder, but if leaf is strictly 'object' type without children known?)
	if (type === "object") {
		return `Field.object({} /* Schema not inferred */${opt ? `, ${opt}` : ""})`;
	}

	// Fallback to custom - user should specify the type
	return `Field.custom('${type}'${opt ? `, ${opt}` : ""}) /* TODO: Specify type, e.g., Field.custom<YourType>(...) */`;
}

/**
 * Generates index definition code.
 */
function generateIndexCode(
	index: IndexAST,
	tableClassName: string,
	indexVarName: string,
): string {
	let code = `export const ${indexVarName} = Index.define(() => ${tableClassName}, {\n`;
	code += `  name: "${index.name}",\n`;
	code += `  fields: [${index.columns.map((c) => `"${c}"`).join(", ")}],\n`;
	if (index.unique) {
		code += "  unique: true,\n";
	}
	code += "});\n";
	return code;
}

/**
 * Converts a string to PascalCase.
 * Examples: "user_profile" -> "UserProfile", "auth_provider" -> "AuthProvider"
 */
function capitalize(str: string): string {
	return str
		.split("_")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join("");
}
