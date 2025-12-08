/**
 * Tests for runtime model extraction to SchemaAST.
 * These functions convert ORM model classes to AST structures.
 */

import { describe, expect, test } from "bun:test";
import {
	Table,
	Field,
	Index,
	extractSchemaFromDefinables,
	extractTableFromModel,
	extractIndexFromDefinition,
	isModelClass,
} from "../../src";
import { surql } from "surrealdb";

// ============================================================================
// Test Models
// ============================================================================

class User extends Table.normal({
	name: "user",
	fields: {
		name: Field.string(),
		email: Field.string(),
		age: Field.option(Field.int()),
		isActive: Field.bool({ default: surql`true` }),
		createdAt: Field.datetime({ value: surql`time::now()`, readonly: true }),
	},
	schemafull: true,
}) {}

class Post extends Table.normal({
	name: "post",
	fields: {
		title: Field.string({ assert: surql`$value != NONE` }),
		content: Field.string(),
		author: Field.record(() => User),
		tags: Field.array(Field.string()),
		metadata: Field.object({
			category: Field.string(),
			featured: Field.bool(),
		}),
	},
	schemafull: true,
}) {}

class Follow extends Table.relation({
	name: "follow",
	fields: {
		in: Field.record(() => User),
		out: Field.record(() => User),
		followedAt: Field.datetime({ default: surql`time::now()` }),
	},
	schemafull: true,
}) {}

const emailIndex = Index.define(() => User, {
	name: "idx_user_email",
	fields: ["email"],
	unique: true,
});

const authorIndex = Index.define(() => Post, {
	name: "idx_post_author",
	fields: ["author"],
});

// ============================================================================
// isModelClass Tests
// ============================================================================

describe("isModelClass", () => {
	test("returns true for model classes", () => {
		expect(isModelClass(User)).toBe(true);
		expect(isModelClass(Post)).toBe(true);
		expect(isModelClass(Follow)).toBe(true);
	});

	test("returns false for non-model values", () => {
		expect(isModelClass({})).toBe(false);
		expect(isModelClass(null)).toBe(false);
		expect(isModelClass(undefined)).toBe(false);
		expect(isModelClass("string")).toBe(false);
		expect(isModelClass(123)).toBe(false);
		expect(isModelClass(() => {})).toBe(false);
		expect(isModelClass(emailIndex)).toBe(false);
	});
});

// ============================================================================
// extractTableFromModel Tests
// ============================================================================

describe("extractTableFromModel", () => {
	test("extracts basic table info", () => {
		const tableAST = extractTableFromModel(User);

		expect(tableAST.name).toBe("user");
		expect(tableAST.type).toBe("NORMAL");
		expect(tableAST.schemafull).toBe(true);
		expect(tableAST.drop).toBe(false);
	});

	test("extracts relation table type", () => {
		const tableAST = extractTableFromModel(Follow);

		expect(tableAST.name).toBe("follow");
		expect(tableAST.type).toBe("RELATION");
		expect(tableAST.schemafull).toBe(true);
	});

	test("extracts simple fields", () => {
		const tableAST = extractTableFromModel(User);

		const nameField = tableAST.fields.find((f) => f.name === "name");
		expect(nameField).toBeDefined();
		expect(nameField?.type).toBe("string");

		const emailField = tableAST.fields.find((f) => f.name === "email");
		expect(emailField).toBeDefined();
		expect(emailField?.type).toBe("string");
	});

	test("extracts option fields", () => {
		const tableAST = extractTableFromModel(User);

		const ageField = tableAST.fields.find((f) => f.name === "age");
		expect(ageField).toBeDefined();
		expect(ageField?.type).toBe("option<int>");
	});

	test("extracts field with default value", () => {
		const tableAST = extractTableFromModel(User);

		const isActiveField = tableAST.fields.find((f) => f.name === "isActive");
		expect(isActiveField).toBeDefined();
		expect(isActiveField?.type).toBe("bool");
		expect(isActiveField?.default).toBe("true");
	});

	test("extracts field with value (computed)", () => {
		const tableAST = extractTableFromModel(User);

		const createdAtField = tableAST.fields.find((f) => f.name === "createdAt");
		expect(createdAtField).toBeDefined();
		expect(createdAtField?.type).toBe("datetime");
		expect(createdAtField?.value).toBe("time::now()");
		expect(createdAtField?.readonly).toBe(true);
	});

	test("extracts field with assertion", () => {
		const tableAST = extractTableFromModel(Post);

		const titleField = tableAST.fields.find((f) => f.name === "title");
		expect(titleField).toBeDefined();
		expect(titleField?.assert).toBe("$value != NONE");
	});

	test("extracts record link fields", () => {
		const tableAST = extractTableFromModel(Post);

		const authorField = tableAST.fields.find((f) => f.name === "author");
		expect(authorField).toBeDefined();
		expect(authorField?.type).toBe("record<user>");
	});

	test("extracts array fields", () => {
		const tableAST = extractTableFromModel(Post);

		const tagsField = tableAST.fields.find((f) => f.name === "tags");
		expect(tagsField).toBeDefined();
		expect(tagsField?.type).toBe("array<string>");
	});

	test("extracts nested object fields with dot notation", () => {
		const tableAST = extractTableFromModel(Post);

		// Should have the parent object field
		const metadataField = tableAST.fields.find((f) => f.name === "metadata");
		expect(metadataField).toBeDefined();
		expect(metadataField?.type).toBe("object");

		// Should have nested fields with dot notation
		const categoryField = tableAST.fields.find(
			(f) => f.name === "metadata.category",
		);
		expect(categoryField).toBeDefined();
		expect(categoryField?.type).toBe("string");

		const featuredField = tableAST.fields.find(
			(f) => f.name === "metadata.featured",
		);
		expect(featuredField).toBeDefined();
		expect(featuredField?.type).toBe("bool");
	});

	test("indexes array is initially empty", () => {
		const tableAST = extractTableFromModel(User);
		expect(tableAST.indexes).toEqual([]);
	});
});

// ============================================================================
// extractIndexFromDefinition Tests
// ============================================================================

describe("extractIndexFromDefinition", () => {
	test("extracts basic index info", () => {
		const { index, tableName } = extractIndexFromDefinition(emailIndex);

		expect(index.name).toBe("idx_user_email");
		expect(index.columns).toEqual(["email"]);
		expect(index.unique).toBe(true);
		expect(tableName).toBe("user");
	});

	test("extracts non-unique index", () => {
		const { index, tableName } = extractIndexFromDefinition(authorIndex);

		expect(index.name).toBe("idx_post_author");
		expect(index.columns).toEqual(["author"]);
		expect(index.unique).toBe(false);
		expect(tableName).toBe("post");
	});

	test("extracts composite index", () => {
		const compositeIndex = Index.define(() => Post, {
			name: "idx_post_author_title",
			fields: ["author", "title"],
		});

		const { index } = extractIndexFromDefinition(compositeIndex);

		expect(index.name).toBe("idx_post_author_title");
		expect(index.columns).toEqual(["author", "title"]);
	});
});

// ============================================================================
// extractSchemaFromDefinables Tests
// ============================================================================

describe("extractSchemaFromDefinables", () => {
	test("extracts schema from single model", () => {
		const schema = extractSchemaFromDefinables([User]);

		expect(schema.tables).toHaveLength(1);
		expect(schema.tables[0]?.name).toBe("user");
	});

	test("extracts schema from multiple models", () => {
		const schema = extractSchemaFromDefinables([User, Post, Follow]);

		expect(schema.tables).toHaveLength(3);
		const tableNames = schema.tables.map((t) => t.name).sort();
		expect(tableNames).toEqual(["follow", "post", "user"]);
	});

	test("associates indexes with their tables", () => {
		const schema = extractSchemaFromDefinables([
			User,
			Post,
			emailIndex,
			authorIndex,
		]);

		const userTable = schema.tables.find((t) => t.name === "user");
		expect(userTable?.indexes).toHaveLength(1);
		expect(userTable?.indexes[0]?.name).toBe("idx_user_email");

		const postTable = schema.tables.find((t) => t.name === "post");
		expect(postTable?.indexes).toHaveLength(1);
		expect(postTable?.indexes[0]?.name).toBe("idx_post_author");
	});

	test("handles indexes without corresponding table", () => {
		// Index for User but User not in definables
		const schema = extractSchemaFromDefinables([Post, emailIndex]);

		// Should not throw, index just won't be associated
		expect(schema.tables).toHaveLength(1);
		expect(schema.tables[0]?.name).toBe("post");
		expect(schema.tables[0]?.indexes).toHaveLength(0);
	});

	test("handles empty array", () => {
		const schema = extractSchemaFromDefinables([]);

		expect(schema.tables).toHaveLength(0);
	});

	test("deduplicates tables if same model passed twice", () => {
		const schema = extractSchemaFromDefinables([User, User]);

		// Map-based deduplication means only one entry
		expect(schema.tables).toHaveLength(1);
	});

	test("preserves field details in extracted schema", () => {
		const schema = extractSchemaFromDefinables([User]);

		const userTable = schema.tables[0];
		expect(userTable).toBeDefined();

		const emailField = userTable?.fields.find((f) => f.name === "email");
		expect(emailField?.type).toBe("string");

		const createdAtField = userTable?.fields.find(
			(f) => f.name === "createdAt",
		);
		expect(createdAtField?.value).toBe("time::now()");
		expect(createdAtField?.readonly).toBe(true);
	});
});
