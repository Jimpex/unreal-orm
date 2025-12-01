import { describe, expect, test } from "bun:test";
import { generateCode } from "../src/codegen/generator";
import type { SchemaAST, FieldAST, TableAST } from "../src/introspection/types";

// Helper to create minimal FieldAST with required fields
function field(overrides: Partial<FieldAST>): FieldAST {
	return {
		name: "",
		type: "any",
		flex: false,
		permissions: {
			select: "FULL",
			create: "FULL",
			update: "FULL",
			delete: "FULL",
		},
		...overrides,
	};
}

// Helper to create minimal TableAST with required fields
function table(overrides: Partial<TableAST>): TableAST {
	return {
		name: "",
		type: "NORMAL",
		schemafull: false,
		drop: false,
		fields: [],
		indexes: [],
		permissions: {
			select: "FULL",
			create: "FULL",
			update: "FULL",
			delete: "FULL",
		},
		events: [],
		...overrides,
	};
}

describe("generateCode", () => {
	test("generates basic table with string field", () => {
		const schema: SchemaAST = {
			tables: [
				table({
					name: "user",
					schemafull: true,
					fields: [field({ name: "name", type: "string" })],
				}),
			],
		};

		const files = generateCode(schema);
		const code = files.get("User.ts");

		expect(code).toContain("export class User extends Table.normal");
		expect(code).toContain('name: "user"');
		expect(code).toContain("name: Field.string()");
		expect(code).toContain("export const UserDefinitions = [User]");
	});

	test("generates table with nested object fields", () => {
		const schema: SchemaAST = {
			tables: [
				table({
					name: "product",
					schemafull: true,
					fields: [
						field({ name: "price.amount", type: "float" }),
						field({ name: "price.currency", type: "string" }),
					],
				}),
			],
		};

		const files = generateCode(schema);
		const code = files.get("Product.ts");

		expect(code).toContain("price: Field.object({");
		expect(code).toContain("amount: Field.float()");
		expect(code).toContain("currency: Field.string()");
	});

	test("generates field with union type (none | string)", () => {
		const schema: SchemaAST = {
			tables: [
				table({
					name: "user",
					schemafull: true,
					fields: [field({ name: "avatar", type: "none | string" })],
				}),
			],
		};

		const files = generateCode(schema);
		const code = files.get("User.ts");

		expect(code).toContain("avatar: Field.option(Field.string())");
	});

	test("generates field with array of records", () => {
		const schema: SchemaAST = {
			tables: [
				table({
					name: "room",
					schemafull: true,
					fields: [
						field({ name: "participants", type: "array<record<user>>" }),
					],
				}),
			],
		};

		const files = generateCode(schema);
		const code = files.get("Room.ts");

		expect(code).toContain(
			"participants: Field.array(Field.record(() => User))",
		);
		expect(code).toContain("import { User } from './User'");
	});

	test("generates field with option of record", () => {
		const schema: SchemaAST = {
			tables: [
				table({
					name: "post",
					schemafull: true,
					fields: [field({ name: "author", type: "option<record<user>>" })],
				}),
			],
		};

		const files = generateCode(schema);
		const code = files.get("Post.ts");

		expect(code).toContain("author: Field.option(Field.record(() => User))");
		expect(code).toContain("import { User } from './User'");
	});

	test("generates relation table", () => {
		const schema: SchemaAST = {
			tables: [
				table({
					name: "follow",
					type: "RELATION",
					schemafull: true,
					fields: [
						field({ name: "in", type: "record<user>" }),
						field({ name: "out", type: "record<user>" }),
						field({ name: "status", type: "string", default: "'pending'" }),
					],
				}),
			],
		};

		const files = generateCode(schema);
		const code = files.get("Follow.ts");

		expect(code).toContain("export class Follow extends Table.relation");
		expect(code).toContain("in: Field.record(() => User)");
		expect(code).toContain("out: Field.record(() => User)");
		expect(code).toContain(
			"status: Field.string({ default: surql`'pending'` })",
		);
	});

	test("generates view table", () => {
		const schema: SchemaAST = {
			tables: [
				table({
					name: "active_users",
					type: "VIEW",
					viewQuery: "SELECT * FROM user WHERE is_active = true",
				}),
			],
		};

		const files = generateCode(schema);
		const code = files.get("ActiveUsers.ts");

		expect(code).toContain("export class ActiveUsers extends Table.view");
		expect(code).toContain('name: "active_users"');
		expect(code).toContain(
			"as: surql`SELECT * FROM user WHERE is_active = true`",
		);
	});

	test("generates indexes", () => {
		const schema: SchemaAST = {
			tables: [
				table({
					name: "user",
					schemafull: true,
					fields: [field({ name: "email", type: "string" })],
					indexes: [{ name: "idx_email", columns: ["email"], unique: true }],
				}),
			],
		};

		const files = generateCode(schema);
		const code = files.get("User.ts");

		expect(code).toContain(
			"export const user_idx_email = Index.define(() => User",
		);
		expect(code).toContain('name: "idx_email"');
		expect(code).toContain('fields: ["email"]');
		expect(code).toContain("unique: true");
		expect(code).toContain(
			"export const UserDefinitions = [User, user_idx_email]",
		);
	});

	test("generates field with default value", () => {
		const schema: SchemaAST = {
			tables: [
				table({
					name: "user",
					schemafull: true,
					fields: [field({ name: "is_active", type: "bool", default: "true" })],
				}),
			],
		};

		const files = generateCode(schema);
		const code = files.get("User.ts");

		expect(code).toContain("is_active: Field.bool({ default: surql`true` })");
	});

	test("generates field with assertion", () => {
		const schema: SchemaAST = {
			tables: [
				table({
					name: "user",
					schemafull: true,
					fields: [
						field({
							name: "email",
							type: "string",
							assert: "string::is_email($value)",
						}),
					],
				}),
			],
		};

		const files = generateCode(schema);
		const code = files.get("User.ts");

		expect(code).toContain(
			"email: Field.string({ assert: surql`string::is_email($value)` })",
		);
	});

	test("generates field with value (computed)", () => {
		const schema: SchemaAST = {
			tables: [
				table({
					name: "user",
					schemafull: true,
					fields: [
						field({
							name: "created_at",
							type: "datetime",
							value: "time::now()",
						}),
					],
				}),
			],
		};

		const files = generateCode(schema);
		const code = files.get("User.ts");

		expect(code).toContain(
			"created_at: Field.datetime({ value: surql`time::now()` })",
		);
	});

	test("does not import self-referencing records", () => {
		const schema: SchemaAST = {
			tables: [
				table({
					name: "user",
					schemafull: true,
					fields: [field({ name: "manager", type: "record<user>" })],
				}),
			],
		};

		const files = generateCode(schema);
		const code = files.get("User.ts");

		expect(code).not.toContain("import { User } from './User'");
		expect(code).toContain("manager: Field.record(() => User)");
	});

	test("generates complex union type with comment", () => {
		const schema: SchemaAST = {
			tables: [
				table({
					name: "data",
					schemafull: true,
					fields: [field({ name: "value", type: "string | int | bool" })],
				}),
			],
		};

		const files = generateCode(schema);
		const code = files.get("Data.ts");

		expect(code).toContain("Field.custom('string | int | bool')");
		expect(code).toContain("/* TODO: Specify union type */");
	});

	test("generates custom field with helpful comment", () => {
		const schema: SchemaAST = {
			tables: [
				table({
					name: "data",
					schemafull: true,
					fields: [field({ name: "metadata", type: "unknown_type" })],
				}),
			],
		};

		const files = generateCode(schema);
		const code = files.get("Data.ts");

		expect(code).toContain("Field.custom('unknown_type')");
		expect(code).toContain(
			"/* TODO: Specify type, e.g., Field.custom<YourType>(...) */",
		);
	});

	test("extracts nested record imports from arrays", () => {
		const schema: SchemaAST = {
			tables: [
				table({
					name: "room",
					schemafull: true,
					fields: [
						field({ name: "participants", type: "array<record<user>>" }),
						field({ name: "queue", type: "array<record<track>>" }),
					],
				}),
			],
		};

		const files = generateCode(schema);
		const code = files.get("Room.ts");

		expect(code).toContain("import { User } from './User'");
		expect(code).toContain("import { Track } from './Track'");
	});

	test("extracts nested record imports from options", () => {
		const schema: SchemaAST = {
			tables: [
				table({
					name: "post",
					schemafull: true,
					fields: [field({ name: "author", type: "option<record<user>>" })],
				}),
			],
		};

		const files = generateCode(schema);
		const code = files.get("Post.ts");

		expect(code).toContain("import { User } from './User'");
	});

	test("converts snake_case table names to PascalCase", () => {
		const schema: SchemaAST = {
			tables: [
				table({
					name: "user_profile",
					schemafull: true,
					fields: [field({ name: "bio", type: "string" })],
				}),
			],
		};

		const files = generateCode(schema);
		const code = files.get("UserProfile.ts");

		expect(code).toContain("export class UserProfile extends Table.normal");
		expect(code).toContain('name: "user_profile"');
	});

	test("handles multi-layer nested objects", () => {
		const schema: SchemaAST = {
			tables: [
				table({
					name: "config",
					schemafull: true,
					fields: [
						field({ name: "settings.theme.colors.primary", type: "string" }),
						field({ name: "settings.theme.colors.secondary", type: "string" }),
						field({ name: "settings.theme.mode", type: "string" }),
					],
				}),
			],
		};

		const files = generateCode(schema);
		const code = files.get("Config.ts");

		expect(code).toContain("settings: Field.object({");
		expect(code).toContain("theme: Field.object({");
		expect(code).toContain("colors: Field.object({");
		expect(code).toContain("primary: Field.string()");
		expect(code).toContain("secondary: Field.string()");
		expect(code).toContain("mode: Field.string()");
	});

	test("handles array of objects", () => {
		const schema: SchemaAST = {
			tables: [
				table({
					name: "product",
					schemafull: true,
					fields: [field({ name: "variants", type: "array<object>" })],
				}),
			],
		};

		const files = generateCode(schema);
		const code = files.get("Product.ts");

		expect(code).toContain(
			"variants: Field.array(Field.object({} /* Schema not inferred */))",
		);
	});

	test("handles object containing arrays", () => {
		const schema: SchemaAST = {
			tables: [
				table({
					name: "data",
					schemafull: true,
					fields: [
						field({ name: "metadata.tags", type: "array<string>" }),
						field({ name: "metadata.categories", type: "array<string>" }),
					],
				}),
			],
		};

		const files = generateCode(schema);
		const code = files.get("Data.ts");

		expect(code).toContain("metadata: Field.object({");
		expect(code).toContain("tags: Field.array(Field.string())");
		expect(code).toContain("categories: Field.array(Field.string())");
	});

	test("filters out wildcard type constraint fields", () => {
		const schema: SchemaAST = {
			tables: [
				table({
					name: "subscription",
					schemafull: true,
					fields: [
						field({ name: "family_members", type: "array<record<user>>" }),
						field({ name: "family_members.*", type: "record<user>" }), // Type constraint, should be ignored
					],
				}),
			],
		};

		const files = generateCode(schema);
		const code = files.get("Subscription.ts");

		// Should only have the array field, not the wildcard
		expect(code).toContain(
			"family_members: Field.array(Field.record(() => User))",
		);
		expect(code).not.toContain("*:");
		expect(code).not.toContain("Field.object");
	});
});
