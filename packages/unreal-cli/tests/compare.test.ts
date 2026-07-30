import { describe, expect, test } from "bun:test";
import type { SchemaAST } from "unreal-orm";
import {
	compareSchemas,
	formatChanges,
	type SchemaChange,
} from "../src/diff/compare";

// Helper to assert change exists and return it
function getChange(changes: SchemaChange[], index: number): SchemaChange {
	const change = changes[index];
	if (!change) throw new Error(`Expected change at index ${index}`);
	return change;
}

describe("compareSchemas", () => {
	test("detects no changes when schemas are identical", () => {
		const schema: SchemaAST = {
			tables: [
				{
					name: "user",
					type: "NORMAL",
					drop: false,
					schemafull: true,
					permissions: {},
					fields: [
						{
							name: "email",
							type: "string",
							flex: false,
							permissions: {},
						},
					],
					indexes: [],
					events: [],
				},
			],
		};

		const changes = compareSchemas(schema, schema);
		expect(changes).toHaveLength(0);
	});

	test("detects table added", () => {
		const remote: SchemaAST = {
			tables: [
				{
					name: "user",
					type: "NORMAL",
					drop: false,
					schemafull: true,
					permissions: {},
					fields: [],
					indexes: [],
					events: [],
				},
			],
		};

		const local: SchemaAST = {
			tables: [],
		};

		const changes = compareSchemas(remote, local);
		expect(changes).toHaveLength(1);
		const change = getChange(changes, 0);
		expect(change.type).toBe("table_added");
		expect(change.table).toBe("user");
	});

	test("detects table removed", () => {
		const remote: SchemaAST = {
			tables: [],
		};

		const local: SchemaAST = {
			tables: [
				{
					name: "user",
					type: "NORMAL",
					drop: false,
					schemafull: true,
					permissions: {},
					fields: [],
					indexes: [],
					events: [],
				},
			],
		};

		const changes = compareSchemas(remote, local);
		expect(changes).toHaveLength(1);
		const change = getChange(changes, 0);
		expect(change.type).toBe("table_removed");
		expect(change.table).toBe("user");
	});

	test("detects table type changed", () => {
		const remote: SchemaAST = {
			tables: [
				{
					name: "follow",
					type: "RELATION",
					drop: false,
					schemafull: true,
					permissions: {},
					fields: [],
					indexes: [],
					events: [],
				},
			],
		};

		const local: SchemaAST = {
			tables: [
				{
					name: "follow",
					type: "NORMAL",
					drop: false,
					schemafull: true,
					permissions: {},
					fields: [],
					indexes: [],
					events: [],
				},
			],
		};

		const changes = compareSchemas(remote, local);
		expect(changes).toHaveLength(1);
		const change = getChange(changes, 0);
		expect(change.type).toBe("table_type_changed");
		expect(change.oldValue).toBe("NORMAL");
		expect(change.newValue).toBe("RELATION");
	});

	test("detects field added", () => {
		const remote: SchemaAST = {
			tables: [
				{
					name: "user",
					type: "NORMAL",
					drop: false,
					schemafull: true,
					permissions: {},
					fields: [
						{
							name: "email",
							type: "string",
							flex: false,
							permissions: {},
						},
						{
							name: "name",
							type: "string",
							flex: false,
							permissions: {},
						},
					],
					indexes: [],
					events: [],
				},
			],
		};

		const local: SchemaAST = {
			tables: [
				{
					name: "user",
					type: "NORMAL",
					drop: false,
					schemafull: true,
					permissions: {},
					fields: [
						{
							name: "email",
							type: "string",
							flex: false,
							permissions: {},
						},
					],
					indexes: [],
					events: [],
				},
			],
		};

		const changes = compareSchemas(remote, local);
		expect(changes).toHaveLength(1);
		const change = getChange(changes, 0);
		expect(change.type).toBe("field_added");
		expect(change.field).toBe("name");
		expect(change.newValue).toBe("string");
	});

	test("detects field removed", () => {
		const remote: SchemaAST = {
			tables: [
				{
					name: "user",
					type: "NORMAL",
					drop: false,
					schemafull: true,
					permissions: {},
					fields: [
						{
							name: "email",
							type: "string",
							flex: false,
							permissions: {},
						},
					],
					indexes: [],
					events: [],
				},
			],
		};

		const local: SchemaAST = {
			tables: [
				{
					name: "user",
					type: "NORMAL",
					drop: false,
					schemafull: true,
					permissions: {},
					fields: [
						{
							name: "email",
							type: "string",
							flex: false,
							permissions: {},
						},
						{
							name: "name",
							type: "string",
							flex: false,
							permissions: {},
						},
					],
					indexes: [],
					events: [],
				},
			],
		};

		const changes = compareSchemas(remote, local);
		expect(changes).toHaveLength(1);
		const change = getChange(changes, 0);
		expect(change.type).toBe("field_removed");
		expect(change.field).toBe("name");
	});

	test("detects field type changed", () => {
		const remote: SchemaAST = {
			tables: [
				{
					name: "user",
					type: "NORMAL",
					drop: false,
					schemafull: true,
					permissions: {},
					fields: [
						{
							name: "age",
							type: "float",
							flex: false,
							permissions: {},
						},
					],
					indexes: [],
					events: [],
				},
			],
		};

		const local: SchemaAST = {
			tables: [
				{
					name: "user",
					type: "NORMAL",
					drop: false,
					schemafull: true,
					permissions: {},
					fields: [
						{
							name: "age",
							type: "int",
							flex: false,
							permissions: {},
						},
					],
					indexes: [],
					events: [],
				},
			],
		};

		const changes = compareSchemas(remote, local);
		expect(changes).toHaveLength(1);
		const change = getChange(changes, 0);
		expect(change.type).toBe("field_type_changed");
		expect(change.field).toBe("age");
		expect(change.oldValue).toBe("int");
		expect(change.newValue).toBe("float");
	});

	test("detects field default changed", () => {
		const remote: SchemaAST = {
			tables: [
				{
					name: "user",
					type: "NORMAL",
					drop: false,
					schemafull: true,
					permissions: {},
					fields: [
						{
							name: "status",
							type: "string",
							flex: false,
							default: "'active'",
							permissions: {},
						},
					],
					indexes: [],
					events: [],
				},
			],
		};

		const local: SchemaAST = {
			tables: [
				{
					name: "user",
					type: "NORMAL",
					drop: false,
					schemafull: true,
					permissions: {},
					fields: [
						{
							name: "status",
							type: "string",
							flex: false,
							permissions: {},
						},
					],
					indexes: [],
					events: [],
				},
			],
		};

		const changes = compareSchemas(remote, local);
		expect(changes).toHaveLength(1);
		const change = getChange(changes, 0);
		expect(change.type).toBe("field_default_changed");
		expect(change.field).toBe("status");
	});

	test("detects field assertion changed", () => {
		const remote: SchemaAST = {
			tables: [
				{
					name: "user",
					type: "NORMAL",
					drop: false,
					schemafull: true,
					permissions: {},
					fields: [
						{
							name: "email",
							type: "string",
							flex: false,
							assert: "$value != NONE",
							permissions: {},
						},
					],
					indexes: [],
					events: [],
				},
			],
		};

		const local: SchemaAST = {
			tables: [
				{
					name: "user",
					type: "NORMAL",
					drop: false,
					schemafull: true,
					permissions: {},
					fields: [
						{
							name: "email",
							type: "string",
							flex: false,
							permissions: {},
						},
					],
					indexes: [],
					events: [],
				},
			],
		};

		const changes = compareSchemas(remote, local);
		expect(changes).toHaveLength(1);
		const change = getChange(changes, 0);
		expect(change.type).toBe("field_assertion_changed");
		expect(change.field).toBe("email");
	});

	test("detects index added", () => {
		const remote: SchemaAST = {
			tables: [
				{
					name: "user",
					type: "NORMAL",
					drop: false,
					schemafull: true,
					permissions: {},
					fields: [],
					indexes: [
						{
							name: "email_idx",
							columns: ["email"],
							unique: true,
						},
					],
					events: [],
				},
			],
		};

		const local: SchemaAST = {
			tables: [
				{
					name: "user",
					type: "NORMAL",
					drop: false,
					schemafull: true,
					permissions: {},
					fields: [],
					indexes: [],
					events: [],
				},
			],
		};

		const changes = compareSchemas(remote, local);
		expect(changes).toHaveLength(1);
		const change = getChange(changes, 0);
		expect(change.type).toBe("index_added");
		expect(change.index).toBe("email_idx");
	});

	test("detects index removed", () => {
		const remote: SchemaAST = {
			tables: [
				{
					name: "user",
					type: "NORMAL",
					drop: false,
					schemafull: true,
					permissions: {},
					fields: [],
					indexes: [],
					events: [],
				},
			],
		};

		const local: SchemaAST = {
			tables: [
				{
					name: "user",
					type: "NORMAL",
					drop: false,
					schemafull: true,
					permissions: {},
					fields: [],
					indexes: [
						{
							name: "email_idx",
							columns: ["email"],
							unique: true,
						},
					],
					events: [],
				},
			],
		};

		const changes = compareSchemas(remote, local);
		expect(changes).toHaveLength(1);
		const change = getChange(changes, 0);
		expect(change.type).toBe("index_removed");
		expect(change.index).toBe("email_idx");
	});

	test("detects index modified", () => {
		const remote: SchemaAST = {
			tables: [
				{
					name: "user",
					type: "NORMAL",
					drop: false,
					schemafull: true,
					permissions: {},
					fields: [],
					indexes: [
						{
							name: "user_idx",
							columns: ["email", "name"],
							unique: true,
						},
					],
					events: [],
				},
			],
		};

		const local: SchemaAST = {
			tables: [
				{
					name: "user",
					type: "NORMAL",
					drop: false,
					schemafull: true,
					permissions: {},
					fields: [],
					indexes: [
						{
							name: "user_idx",
							columns: ["email"],
							unique: false,
						},
					],
					events: [],
				},
			],
		};

		const changes = compareSchemas(remote, local);
		expect(changes).toHaveLength(1);
		const change = getChange(changes, 0);
		expect(change.type).toBe("index_modified");
		expect(change.index).toBe("user_idx");
	});

	test("detects multiple changes across tables", () => {
		const remote: SchemaAST = {
			tables: [
				{
					name: "user",
					type: "NORMAL",
					drop: false,
					schemafull: true,
					permissions: {},
					fields: [
						{
							name: "email",
							type: "string",
							flex: false,
							permissions: {},
						},
						{
							name: "age",
							type: "int",
							flex: false,
							permissions: {},
						},
					],
					indexes: [],
					events: [],
				},
				{
					name: "post",
					type: "NORMAL",
					drop: false,
					schemafull: true,
					permissions: {},
					fields: [],
					indexes: [],
					events: [],
				},
			],
		};

		const local: SchemaAST = {
			tables: [
				{
					name: "user",
					type: "NORMAL",
					drop: false,
					schemafull: true,
					permissions: {},
					fields: [
						{
							name: "email",
							type: "string",
							flex: false,
							permissions: {},
						},
					],
					indexes: [],
					events: [],
				},
			],
		};

		const changes = compareSchemas(remote, local);
		expect(changes).toHaveLength(2);
		expect(
			changes.some((c) => c.type === "field_added" && c.field === "age"),
		).toBe(true);
		expect(
			changes.some((c) => c.type === "table_added" && c.table === "post"),
		).toBe(true);
	});
});

// Helper to strip ANSI codes for testing
function stripAnsi(str: string): string {
	// biome-ignore lint/suspicious/noControlCharactersInRegex: needed for ANSI stripping
	return str.replace(/\u001b\[\d+m/g, "");
}

describe("formatChanges", () => {
	test("formats empty changes", () => {
		const result = stripAnsi(formatChanges([]));
		expect(result).toContain("identical");
	});

	test("formats changes grouped by table", () => {
		const changes = [
			{
				type: "field_added" as const,
				table: "user",
				field: "name",
				newValue: "string",
				description: "Field 'name' (string)",
			},
			{
				type: "field_removed" as const,
				table: "user",
				field: "age",
				oldValue: "int",
				description: "Field 'age'",
			},
		];

		const result = stripAnsi(formatChanges(changes));
		expect(result).toContain("user:");
		expect(result).toContain("+ Field 'name'");
		expect(result).toContain("- Field 'age'");
	});

	test("detects bucket added", () => {
		const remote: SchemaAST = {
			tables: [],
		};

		const local: SchemaAST = {
			tables: [],
			buckets: [{ name: "avatars", backend: "memory" }],
		};

		const changes = compareSchemas(local, remote);
		expect(changes).toHaveLength(1);
		expect(changes[0]?.type).toBe("bucket_added");
		expect(changes[0]?.bucket).toBe("avatars");
	});

	test("detects bucket removed", () => {
		const remote: SchemaAST = {
			tables: [],
			buckets: [{ name: "avatars", backend: "memory" }],
		};

		const local: SchemaAST = {
			tables: [],
		};

		const changes = compareSchemas(local, remote);
		expect(changes).toHaveLength(1);
		expect(changes[0]?.type).toBe("bucket_removed");
		expect(changes[0]?.bucket).toBe("avatars");
	});

	test("detects bucket modified", () => {
		const remote: SchemaAST = {
			tables: [],
			buckets: [{ name: "avatars", backend: "memory" }],
		};

		const local: SchemaAST = {
			tables: [],
			buckets: [{ name: "avatars", backend: "memory", readonly: true }],
		};

		const changes = compareSchemas(local, remote);
		expect(changes).toHaveLength(1);
		expect(changes[0]?.type).toBe("bucket_modified");
		expect(changes[0]?.bucket).toBe("avatars");
	});

	test("formats bucket changes under Buckets heading", () => {
		const changes = [
			{
				type: "bucket_added" as const,
				table: "",
				bucket: "avatars",
				description: "Bucket 'avatars' will be added",
			},
		];

		const result = stripAnsi(formatChanges(changes));
		expect(result).toContain("Buckets:");
		expect(result).toContain("+ Bucket 'avatars' will be added");
	});

	test("detects added vector index with [HNSW] suffix in description", () => {
		const remote: SchemaAST = {
			tables: [
				{
					name: "document",
					type: "NORMAL",
					drop: false,
					schemafull: true,
					permissions: {},
					fields: [],
					indexes: [],
					events: [],
				},
			],
		};

		const local: SchemaAST = {
			tables: [
				{
					name: "document",
					type: "NORMAL",
					drop: false,
					schemafull: true,
					permissions: {},
					fields: [],
					indexes: [
						{
							name: "idx_embedding",
							columns: ["embedding"],
							unique: false,
							vectorType: "HNSW",
							vectorDimension: 768,
						},
					],
					events: [],
				},
			],
		};

		const changes = compareSchemas(local, remote);
		expect(changes).toHaveLength(1);
		const change = getChange(changes, 0);
		expect(change.type).toBe("index_added");
		expect(change.description).toContain("[HNSW]");
	});

	test("detects vector dimension change with detailed description", () => {
		const remote: SchemaAST = {
			tables: [
				{
					name: "document",
					type: "NORMAL",
					drop: false,
					schemafull: true,
					permissions: {},
					fields: [],
					indexes: [
						{
							name: "idx_embedding",
							columns: ["embedding"],
							unique: false,
							vectorType: "HNSW",
							vectorDimension: 128,
						},
					],
					events: [],
				},
			],
		};

		const local: SchemaAST = {
			tables: [
				{
					name: "document",
					type: "NORMAL",
					drop: false,
					schemafull: true,
					permissions: {},
					fields: [],
					indexes: [
						{
							name: "idx_embedding",
							columns: ["embedding"],
							unique: false,
							vectorType: "HNSW",
							vectorDimension: 256,
						},
					],
					events: [],
				},
			],
		};

		const changes = compareSchemas(local, remote);
		expect(changes).toHaveLength(1);
		const change = getChange(changes, 0);
		expect(change.type).toBe("index_modified");
		expect(change.description).toContain("dimension 128 → 256");
	});

	test("detects vector type change (MTREE → HNSW)", () => {
		const remote: SchemaAST = {
			tables: [
				{
					name: "document",
					type: "NORMAL",
					drop: false,
					schemafull: true,
					permissions: {},
					fields: [],
					indexes: [
						{
							name: "idx_vec",
							columns: ["embedding"],
							unique: false,
							vectorType: "MTREE",
							vectorDimension: 128,
						},
					],
					events: [],
				},
			],
		};

		const local: SchemaAST = {
			tables: [
				{
					name: "document",
					type: "NORMAL",
					drop: false,
					schemafull: true,
					permissions: {},
					fields: [],
					indexes: [
						{
							name: "idx_vec",
							columns: ["embedding"],
							unique: false,
							vectorType: "HNSW",
							vectorDimension: 128,
						},
					],
					events: [],
				},
			],
		};

		const changes = compareSchemas(local, remote);
		expect(changes).toHaveLength(1);
		const change = getChange(changes, 0);
		expect(change.type).toBe("index_modified");
		expect(change.description).toContain("type MTREE → HNSW");
	});

	test("no change when vector params are identical", () => {
		const idx = {
			name: "idx_unchanged",
			columns: ["embedding"],
			unique: false,
			vectorType: "HNSW" as const,
			vectorDimension: 128,
			vectorDistance: "COSINE",
			vectorEfc: 200,
		};

		const schema: SchemaAST = {
			tables: [
				{
					name: "document",
					type: "NORMAL",
					drop: false,
					schemafull: true,
					permissions: {},
					fields: [],
					indexes: [idx],
					events: [],
				},
			],
		};

		const changes = compareSchemas(schema, schema);
		expect(changes).toHaveLength(0);
	});
});
