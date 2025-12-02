import { describe, test, expect } from "bun:test";
import {
	compareSchemas,
	formatChanges,
	type SchemaChange,
} from "../src/diff/compare";
import type { SchemaAST } from "unreal-orm";

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
});
