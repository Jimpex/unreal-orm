// Tests for Field.record (record links/relations)

import { test, describe, expect, beforeAll, afterAll } from "bun:test";
import { Field, Table, applySchema, generateFullSchemaQl } from "../../src";
import { setupInMemoryDb, teardownDb } from "../utils/dbTestUtils";
import type { Surreal } from "surrealdb";

let db: Surreal;

beforeAll(async () => {
	db = await setupInMemoryDb("record_test", "record_test");
});
afterAll(async () => {
	await teardownDb(db);
});

describe("Field.record - basic", () => {
	class User extends Table.normal({
		name: "user",
		fields: { name: Field.string() },
		schemafull: true,
	}) {}
	class Post extends Table.normal({
		name: "post",
		fields: {
			title: Field.string(),
			author: Field.record(() => User),
		},
		schemafull: true,
	}) {}

	test("should generate and apply SurrealQL for record field", async () => {
		const ddl = generateFullSchemaQl([Post]);
		expect(ddl).toContain(
			"DEFINE FIELD author ON TABLE post TYPE record<user>",
		);
		await applySchema(db, [User, Post]);
	});

	test("should create record with reference", async () => {
		const user = await User.create(db, { name: "Alice" });
		const post = await Post.create(db, { title: "Hello", author: user.id });
		expect(post.author?.toString()).toBe(user.id.toString());
	});
});

describe("Field.record - optional", () => {
	class User extends Table.normal({
		name: "user_opt",
		fields: { name: Field.string() },
		schemafull: true,
	}) {}
	class Post extends Table.normal({
		name: "post_opt",
		fields: {
			title: Field.string(),
			author: Field.option(Field.record(() => User)),
		},
		schemafull: true,
	}) {}

	test("should generate and apply SurrealQL for optional record field", async () => {
		const ddl = generateFullSchemaQl([Post]);
		expect(ddl).toContain(
			"DEFINE FIELD author ON TABLE post_opt TYPE option<record<user_opt>>",
		);
		await applySchema(db, [User, Post]);
	});

	test("should allow setting optional record field", async () => {
		const user = await User.create(db, { name: "Bob" });
		const post = await Post.create(db, {
			title: "With Author",
			author: user.id,
		});
		expect(post.author?.toString()).toBe(user.id.toString());
	});
});

describe("Field.record - negative cases", () => {
	class User extends Table.normal({
		name: "user_neg",
		fields: { name: Field.string() },
		schemafull: true,
	}) {}
	class Post extends Table.normal({
		name: "post_neg",
		fields: {
			title: Field.string(),
			author: Field.record(() => User),
		},
		schemafull: true,
	}) {}

	test("should generate and apply SurrealQL for record field", async () => {
		const ddl = generateFullSchemaQl([Post]);
		expect(ddl).toContain(
			"DEFINE FIELD author ON TABLE post_neg TYPE record<user_neg>",
		);
		await applySchema(db, [User, Post]);
	});

	test("should throw when setting invalid record id", async () => {
		// @ts-expect-error
		expect(Post.create(db, { title: "Bad", author: 123 })).rejects.toThrow();
	});
});
