import { Command } from "@commander-js/extra-typings";
import { promises as fs, existsSync } from "node:fs";
import path from "node:path";
import { loadConfig, resolveSchemaDir } from "../utils/config";
import { extractSchemaFromRuntime } from "../diff/parseTypeScript";
import { introspect } from "../introspection/introspect";
import { parseSurqlFile } from "../introspection/parseSurql";
import { resolveConnection } from "../utils/connect";
import { promptText, promptSelect } from "../utils/prompts";
import type { SchemaAST, TableAST, FieldAST } from "unreal-orm";
import { ui } from "../utils/ui";

type SchemaSource = "code" | "database" | "surql";

/**
 * Generate a Mermaid ERD diagram from TypeScript schema, database, or .surql file.
 *
 * Output format: https://mermaid.js.org/syntax/entityRelationshipDiagram.html
 */
export const mermaidCommand = new Command("mermaid")
	.description(
		"Generate a Mermaid ERD diagram from TypeScript schema, database, or .surql file",
	)
	.option("-o, --output <path>", "Output file path for .mermaid file")
	.option("-s, --schema-dir <path>", "Schema directory path (for --code mode)")
	.option("-c, --config <path>", "Path to config file")
	.option("--stdout", "Print to stdout instead of file")
	.option("--code", "Use TypeScript schema definitions")
	.option("--db", "Use database connection (introspect live database)")
	.option("--surql <path>", "Use a .surql schema file")
	.option("--url <url>", "Database URL (implies --db)")
	.option("-u, --username <username>", "Database username")
	.option("-p, --password <password>", "Database password")
	.option("-n, --namespace <namespace>", "Database namespace")
	.option("-d, --database <database>", "Database name")
	.option("--auth-level <level>", "Auth level: root, namespace, or database")
	.option("--embedded <mode>", "Use embedded mode (memory or file path)")
	.action(async (options) => {
		ui.header("Mermaid ERD Generator", "Visualize your schema");

		const spinner = ui.spin("Loading configuration...");

		try {
			// Load config (provides paths for both code and database connection)
			const config = await loadConfig(options.config);
			if (config) {
				spinner.succeed("Configuration loaded");
			} else {
				spinner.info("No configuration file found (using defaults/flags)");
			}

			// Determine output path
			let outputPath = options.output;
			if (!outputPath && !options.stdout) {
				spinner.stop();
				outputPath = await promptText(
					"Output file path:",
					config
						? path.join(config.path, "schema.mermaid")
						: "./unreal/schema.mermaid",
				);
			}

			// Determine source mode
			const hasConnectionFlags =
				options.url ||
				options.username ||
				options.password ||
				options.namespace ||
				options.database ||
				options.embedded;

			let sourceMode: SchemaSource | undefined;

			// Explicit flags take precedence
			if (options.surql) {
				sourceMode = "surql";
			} else if (options.db || hasConnectionFlags) {
				sourceMode = "database";
			} else if (options.code) {
				sourceMode = "code";
			}

			// If no mode specified, prompt user to choose
			if (!sourceMode) {
				spinner.stop();
				const choices: Array<{ title: string; value: SchemaSource }> = [
					{ title: "TypeScript schema (./unreal/tables/)", value: "code" },
					{ title: "Database (introspect live database)", value: "database" },
					{ title: "SurrealQL file (.surql)", value: "surql" },
				];
				sourceMode = await promptSelect("Schema source:", choices);
				if (!sourceMode) {
					process.exit(0);
				}
			}

			let schema: SchemaAST;

			if (sourceMode === "code") {
				// === Code Mode: Parse TypeScript schema files ===
				spinner.stop();
				const schemaDir = await resolveSchemaDir({
					cliOutput: options.schemaDir,
					config,
				});
				spinner.start(`Extracting schema from ${schemaDir}...`);
				schema = await extractSchemaFromRuntime(schemaDir);
				spinner.succeed(
					`Found ${schema.tables.length} tables from TypeScript schema`,
				);
			} else if (sourceMode === "database") {
				// === Database Mode: Introspect live database ===
				spinner.stop();

				const db = await resolveConnection({
					cliOptions: {
						url: options.url,
						username: options.username,
						password: options.password,
						namespace: options.namespace,
						database: options.database,
						authLevel: options.authLevel,
						embedded: options.embedded,
					},
					config,
					// Always show config/manual choice for mermaid since user explicitly chose "database"
					skipAutoConfig: true,
				});

				if (!db) {
					ui.error("Failed to establish database connection.");
					process.exit(1);
				}

				// Introspect
				spinner.start("Introspecting database schema...");
				try {
					schema = await introspect(db);
					spinner.succeed(`Found ${schema.tables.length} tables from database`);
				} finally {
					await db.close();
				}
			} else {
				// === SurrealQL Mode: Parse .surql file ===
				let surqlPath: string =
					typeof options.surql === "string" ? options.surql : "";
				if (!surqlPath) {
					spinner.stop();
					surqlPath = await promptText(
						"Path to .surql file:",
						"./schema.surql",
					);
				}
				const resolvedPath = path.resolve(process.cwd(), surqlPath);
				if (!existsSync(resolvedPath)) {
					spinner.fail(`File not found: ${resolvedPath}`);
					process.exit(1);
				}
				spinner.start(`Parsing ${surqlPath}...`);
				schema = await parseSurqlFile(resolvedPath);
				spinner.succeed(
					`Found ${schema.tables.length} tables from .surql file`,
				);
			}

			// Generate Mermaid
			spinner.start("Generating Mermaid diagram...");
			const mermaid = generateMermaidERD(schema);
			spinner.succeed("Diagram generated");

			if (options.stdout) {
				console.log(`\n${mermaid}`);
			} else {
				// Ensure we have an output path (should be set by prompt above)
				const finalPath = path.resolve(
					process.cwd(),
					outputPath || "./unreal/schema.mermaid",
				);
				await fs.writeFile(finalPath, mermaid);
				ui.success(`Saved to ${finalPath}`);
				ui.dim(
					"Tip: Preview with VS Code Mermaid extension,\n     https://mermiko.com, or https://mermaid.live",
				);
			}
		} catch (error) {
			spinner.fail("Failed to generate diagram");
			ui.error(error instanceof Error ? error.message : String(error));
			process.exit(1);
		}
	});

/**
 * Generate Mermaid ERD syntax from SchemaAST
 */
function generateMermaidERD(schema: SchemaAST): string {
	const lines: string[] = ["erDiagram"];
	// lines.push("    direction LR");

	// Separate tables by type for better organization
	const normalTables = schema.tables.filter((t) => t.type === "NORMAL");
	const relationTables = schema.tables.filter((t) => t.type === "RELATION");
	const viewTables = schema.tables.filter((t) => t.type === "VIEW");

	// Collect all relationships
	const relationships: string[] = [];

	// Build index lookup for unique constraints
	const uniqueFields = new Map<string, Set<string>>();
	// We always build this now for UK markers
	for (const table of schema.tables) {
		const uniqueSet = new Set<string>();
		for (const idx of table.indexes) {
			const col = idx.columns[0];
			if (idx.unique && idx.columns.length === 1 && col) {
				uniqueSet.add(col);
			}
		}
		if (uniqueSet.size > 0 && table.name) {
			uniqueFields.set(table.name, uniqueSet);
		}
	}

	// Process normal tables first
	if (normalTables.length > 0) {
		lines.push("    %% === TABLES ===");
		for (const table of normalTables) {
			const result = processTable(table, uniqueFields);
			lines.push(...result.lines);
			relationships.push(...result.relationships);
		}
	}

	// Process relation tables (graph edges)
	if (relationTables.length > 0) {
		lines.push("    %% === RELATIONS (Graph Edges) ===");
		for (const table of relationTables) {
			const result = processRelationTable(table, uniqueFields);
			lines.push(...result.lines);
			relationships.push(...result.relationships);
		}
	}

	// Process views
	if (viewTables.length > 0) {
		lines.push("    %% === VIEWS ===");
		for (const table of viewTables) {
			const result = processTable(table, uniqueFields);
			lines.push(...result.lines);
			// Views typically don't have FK relationships
		}
	}

	// Add relationships section
	if (relationships.length > 0) {
		lines.push("");
		lines.push("    %% === RELATIONSHIPS ===");
		lines.push(...relationships);
	}

	return lines.join("\n");
}

/**
 * Process a normal table or view
 */
function processTable(
	table: TableAST,
	uniqueFields: Map<string, Set<string>>,
): { lines: string[]; relationships: string[] } {
	const lines: string[] = [];
	const relationships: string[] = [];

	// Filter out nested fields
	const topLevelFields = table.fields.filter(
		(f) => !f.name.includes(".") && !f.name.includes("["),
	);

	const safeTableName = sanitizeName(table.name);
	const tableUniques = uniqueFields.get(table.name) ?? new Set();

	lines.push(`    ${safeTableName} {`);

	for (const field of topLevelFields) {
		const mermaidType = toMermaidType(field.type);
		const safeName = sanitizeName(field.name);
		const constraints = getFieldConstraints(field, tableUniques);

		// Determine if field is required
		// - ID is always required
		// - Fields with "!= NONE" assertion are required
		// - option<T> types are optional (but we rely on assertion for non-option types too)
		const isRequired = field.name === "id" || field.assert?.includes("!= NONE");

		// Prefix required fields with * (renders as bold in Mermaid)
		const displayName = isRequired ? `*${safeName}` : safeName;

		// Format: type name [keys]
		let line = `        ${mermaidType} ${displayName}`;
		if (constraints) line += ` ${constraints}`;
		lines.push(line);

		// Collect relationships for record fields
		const recordMatch = field.type.match(/^record<(\w+)>$/);
		if (recordMatch?.[1]) {
			const targetTable = sanitizeName(recordMatch[1]);
			const isRequired = field.assert?.includes("!= NONE");
			const isUnique = tableUniques.has(field.name);

			// Line style: Solid (--) for required, Dashed (..) for optional
			const line = isRequired ? "--" : "..";

			// Cardinality logic:
			// Source: } (Many) or | (One if unique)
			// Marker: o (Optional) or | (Mandatory if required)
			const srcCard = isUnique ? "|" : "}";
			const srcMandatory = isRequired ? "|" : "o";
			const srcMarker = `${srcCard}${srcMandatory}`;

			// Target: Always || (One specific record)
			const tgtMarker = "||";

			relationships.push(
				`    ${safeTableName} ${srcMarker}${line}${tgtMarker} ${targetTable} : "${field.name}"`,
			);
		}
	}

	lines.push("    }");
	lines.push("");

	return { lines, relationships };
}

/**
 * Process a relation table (graph edge) - special handling for in/out fields
 */
function processRelationTable(
	table: TableAST,
	uniqueFields: Map<string, Set<string>>,
): { lines: string[]; relationships: string[] } {
	const lines: string[] = [];
	const relationships: string[] = [];

	const safeTableName = sanitizeName(table.name);
	const tableUniques = uniqueFields.get(table.name) ?? new Set();

	// Find in/out fields for the edge relationship
	const inField = table.fields.find((f) => f.name === "in");
	const outField = table.fields.find((f) => f.name === "out");

	// Get target tables from in/out
	const inTarget = inField?.type.match(/^record<(\w+)>$/)?.[1];
	const outTarget = outField?.type.match(/^record<(\w+)>$/)?.[1];

	// Filter fields - exclude in/out since they're shown as the edge
	const edgeFields = table.fields.filter(
		(f) =>
			f.name !== "in" &&
			f.name !== "out" &&
			!f.name.includes(".") &&
			!f.name.includes("["),
	);

	// If no edge fields, still add the relationship
	if (edgeFields.length === 0) {
		if (inTarget && outTarget) {
			const safeIn = sanitizeName(inTarget);
			const safeOut = sanitizeName(outTarget);
			// Use }|--|{ for many-to-many relation
			relationships.push(`    ${safeIn} }|--|{ ${safeOut} : "${table.name}"`);
		}
		return { lines: [], relationships };
	}

	// Add the relation table with edge properties
	lines.push(`    ${safeTableName} {`);

	// Show in/out fields first with their target types and bolding (*)
	if (inField && inTarget) {
		lines.push(`        ${sanitizeName(inTarget)} *in FK`);
	}
	if (outField && outTarget) {
		lines.push(`        ${sanitizeName(outTarget)} *out FK`);
	}

	// Edge properties
	for (const field of edgeFields) {
		const mermaidType = toMermaidType(field.type);
		const safeName = sanitizeName(field.name);
		const constraints = getFieldConstraints(field, tableUniques);

		// Determine if field is required
		const isRequired = field.name === "id" || field.assert?.includes("!= NONE");

		// Prefix required fields with *
		const displayName = isRequired ? `*${safeName}` : safeName;

		let line = `        ${mermaidType} ${displayName}`;
		if (constraints) line += ` ${constraints}`;
		lines.push(line);
	}

	lines.push("    }");
	lines.push("");

	// Add edge relationships: in -> relation -> out (force left to right)
	if (inTarget && outTarget) {
		const safeIn = sanitizeName(inTarget);
		const safeOut = sanitizeName(outTarget);

		// in table connects to relation (One-to-Many)
		relationships.push(`    ${safeIn} ||--o{ ${safeTableName} : "in"`);
		// relation connects to out table (Many-to-One)
		relationships.push(`    ${safeTableName} }o--|| ${safeOut} : "out"`);
	}

	return { lines, relationships };
}

/**
 * Sanitize a name for Mermaid (only alphanumeric and underscore)
 */
function sanitizeName(name: string): string {
	return name.replace(/[^a-zA-Z0-9_]/g, "_");
}

/**
 * Convert SurrealDB type to Mermaid-compatible type
 */
function toMermaidType(surrealType: string): string {
	// Handle record links - record<user> or record<user | post>
	if (surrealType.startsWith("record<")) {
		return "record";
	}
	if (surrealType === "record") {
		return "record";
	}

	// Handle arrays - array<string> or array<record<user>>
	if (surrealType.startsWith("array<")) {
		const inner = surrealType.slice(6, -1);
		return `array_${toMermaidType(inner)}`;
	}
	if (surrealType === "array") {
		return "array";
	}

	// Handle options - option<string>
	if (surrealType.startsWith("option<")) {
		const inner = surrealType.slice(7, -1);
		return toMermaidType(inner);
	}

	// Handle set - set<string>
	if (surrealType.startsWith("set<")) {
		const inner = surrealType.slice(4, -1);
		return `set_${toMermaidType(inner)}`;
	}

	// Handle geometry types - geometry<point> etc
	if (surrealType.startsWith("geometry<")) {
		const inner = surrealType.slice(9, -1);
		return `geo_${inner}`;
	}

	// Handle range types - range<int, int>
	if (surrealType.startsWith("range<")) {
		return "range";
	}

	// Handle literal/union types - "draft" | "published"
	if (surrealType.includes("|")) {
		return "enum";
	}

	// Map common types
	const typeMap: Record<string, string> = {
		string: "string",
		int: "int",
		float: "float",
		bool: "bool",
		datetime: "datetime",
		duration: "duration",
		decimal: "decimal",
		number: "number",
		object: "object",
		array: "array",
		any: "any",
		bytes: "bytes",
		uuid: "uuid",
		ulid: "ulid",
		geometry: "geometry",
		point: "point",
		line: "line",
		polygon: "polygon",
		multipoint: "multipoint",
		multiline: "multiline",
		multipolygon: "multipolygon",
		collection: "collection",
		null: "null",
		none: "none",
	};

	return typeMap[surrealType] || surrealType;
}

/**
 * Get Mermaid constraint notation for a field
 */
function getFieldConstraints(
	field: FieldAST,
	uniqueFields: Set<string>,
): string {
	const constraints: string[] = [];

	// Check for primary key (id field)
	if (field.name === "id") {
		constraints.push("PK");
	}

	// Check for foreign key (record link)
	if (field.type.startsWith("record<")) {
		constraints.push("FK");
	}

	// Check for unique index
	if (uniqueFields.has(field.name)) {
		constraints.push("UK");
	}

	return constraints.join(",");
}
