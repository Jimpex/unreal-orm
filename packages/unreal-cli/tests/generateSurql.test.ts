import { describe, test, expect } from "bun:test";
import {
	generateSurqlFromAST,
	generateMigrationSurql,
} from "../src/diff/generateSurql";
import type { SchemaAST } from "../src/introspection/types";

describe("generateSurqlFromAST", () => {
	test("generates DEFINE TABLE statement for normal table", () => {
		const schema: SchemaAST = {
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

		const surql = generateSurqlFromAST(schema);
		expect(surql).toContain("DEFINE TABLE user TYPE NORMAL SCHEMAFULL;");
	});

	test("generates DEFINE TABLE statement for relation table", () => {
		const schema: SchemaAST = {
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

		const surql = generateSurqlFromAST(schema);
		expect(surql).toContain("DEFINE TABLE follow TYPE RELATION SCHEMAFULL;");
	});

	test("generates DEFINE TABLE with IF NOT EXISTS", () => {
		const schema: SchemaAST = {
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

		const surql = generateSurqlFromAST(schema, "IF NOT EXISTS");
		expect(surql).toContain("DEFINE TABLE IF NOT EXISTS user");
	});

	test("generates DEFINE FIELD statements", () => {
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

		const surql = generateSurqlFromAST(schema);
		expect(surql).toContain("DEFINE FIELD email ON TABLE user TYPE string;");
		expect(surql).toContain("DEFINE FIELD age ON TABLE user TYPE int;");
	});

	test("generates DEFINE FIELD with default value", () => {
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

		const surql = generateSurqlFromAST(schema);
		expect(surql).toContain("DEFAULT 'active'");
	});

	test("generates DEFINE FIELD with assertion", () => {
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
							assert: "$value != NONE",
							permissions: {},
						},
					],
					indexes: [],
					events: [],
				},
			],
		};

		const surql = generateSurqlFromAST(schema);
		expect(surql).toContain("ASSERT $value != NONE");
	});

	test("generates DEFINE FIELD with VALUE (computed field)", () => {
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
							name: "created_at",
							type: "datetime",
							flex: false,
							value: "time::now()",
							permissions: {},
						},
					],
					indexes: [],
					events: [],
				},
			],
		};

		const surql = generateSurqlFromAST(schema);
		expect(surql).toContain("VALUE time::now()");
	});

	test("generates DEFINE FIELD with FLEXIBLE", () => {
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
							name: "metadata",
							type: "object",
							flex: true,
							permissions: {},
						},
					],
					indexes: [],
					events: [],
				},
			],
		};

		const surql = generateSurqlFromAST(schema);
		expect(surql).toContain("FLEXIBLE");
	});

	test("generates DEFINE INDEX statements", () => {
		const schema: SchemaAST = {
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

		const surql = generateSurqlFromAST(schema);
		expect(surql).toContain(
			"DEFINE INDEX email_idx ON TABLE user FIELDS email",
		);
		expect(surql).toContain("UNIQUE");
	});

	test("generates composite index", () => {
		const schema: SchemaAST = {
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
							unique: false,
						},
					],
					events: [],
				},
			],
		};

		const surql = generateSurqlFromAST(schema);
		expect(surql).toContain("FIELDS email, name");
	});

	test("generates complete schema with multiple tables", () => {
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
				{
					name: "post",
					type: "NORMAL",
					drop: false,
					schemafull: true,
					permissions: {},
					fields: [
						{
							name: "title",
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

		const surql = generateSurqlFromAST(schema);
		expect(surql).toContain("DEFINE TABLE user");
		expect(surql).toContain("DEFINE TABLE post");
		expect(surql).toContain("DEFINE FIELD email ON TABLE user");
		expect(surql).toContain("DEFINE FIELD title ON TABLE post");
	});
});

describe("generateMigrationSurql", () => {
	test("generates DEFINE FIELD for field_added", () => {
		const changes = [
			{
				type: "field_added",
				table: "user",
				field: "name",
				newValue: "string",
			},
		];

		const surql = generateMigrationSurql(changes);
		expect(surql).toContain("DEFINE FIELD name ON TABLE user TYPE string;");
	});

	test("generates DEFINE FIELD OVERWRITE for field_type_changed", () => {
		const changes = [
			{
				type: "field_type_changed",
				table: "user",
				field: "age",
				newValue: "float",
			},
		];

		const surql = generateMigrationSurql(changes);
		expect(surql).toContain(
			"DEFINE FIELD OVERWRITE age ON TABLE user TYPE float;",
		);
	});

	test("generates REMOVE FIELD for field_removed", () => {
		const changes = [
			{
				type: "field_removed",
				table: "user",
				field: "old_field",
			},
		];

		const surql = generateMigrationSurql(changes);
		expect(surql).toContain("REMOVE FIELD old_field ON TABLE user;");
	});

	test("generates DEFINE INDEX for index_added", () => {
		const changes = [
			{
				type: "index_added",
				table: "user",
				index: "email_idx",
				newValue: ["email"],
			},
		];

		const surql = generateMigrationSurql(changes);
		expect(surql).toContain(
			"DEFINE INDEX email_idx ON TABLE user FIELDS email;",
		);
	});

	test("generates REMOVE INDEX for index_removed", () => {
		const changes = [
			{
				type: "index_removed",
				table: "user",
				index: "old_idx",
			},
		];

		const surql = generateMigrationSurql(changes);
		expect(surql).toContain("REMOVE INDEX old_idx ON TABLE user;");
	});

	test("generates REMOVE TABLE for table_removed", () => {
		const changes = [
			{
				type: "table_removed",
				table: "old_table",
			},
		];

		const surql = generateMigrationSurql(changes);
		expect(surql).toContain("REMOVE TABLE old_table;");
	});

	test("generates multiple migration statements", () => {
		const changes = [
			{
				type: "field_added",
				table: "user",
				field: "name",
				newValue: "string",
			},
			{
				type: "field_removed",
				table: "user",
				field: "old_field",
			},
			{
				type: "index_added",
				table: "user",
				index: "name_idx",
				newValue: ["name"],
			},
		];

		const surql = generateMigrationSurql(changes);
		expect(surql).toContain("DEFINE FIELD name");
		expect(surql).toContain("REMOVE FIELD old_field");
		expect(surql).toContain("DEFINE INDEX name_idx");
	});
});
