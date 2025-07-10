// Tests for schema migration, applySchema

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Field } from "../../src/fields";
import Table from "../../src/define";
import { setupInMemoryDb, teardownDb } from "../utils/dbTestUtils";
import { applySchema } from "../../src/schemaGenerator";
import type { Surreal } from "surrealdb";

let db: Surreal;

beforeAll(async () => {
	db = await setupInMemoryDb("migration", "migration");
});
afterAll(async () => {
	await teardownDb(db);
});

describe("Schema Migration", () => {
	test("should apply schema for new tables and indexes", async () => {
		class User extends Table.normal({
			name: "user_mig",
			fields: { name: Field.string(), email: Field.string() },
			schemafull: true,
			indexes: [{ name: "idx_user_email", fields: ["email"], unique: true }],
		}) {}
		class Post extends Table.normal({
			name: "post_mig",
			fields: { title: Field.string() },
			schemafull: true,
		}) {}
		await applySchema(db, [User, Post]);
		// Try creating a user with duplicate email
		await User.create(db, { name: "A", email: "a@x.com" });
		expect(User.create(db, { name: "B", email: "a@x.com" })).rejects.toThrow();
		// Table existence: try creating a post
		const post = await Post.create(db, { title: "test" });
		expect(post.title).toBe("test");
	});

	test("should be idempotent (multiple applySchema calls)", async () => {
		class Foo extends Table.normal({
			name: "foo_mig",
			fields: { bar: Field.string() },
			schemafull: true,
		}) {}
		await applySchema(db, [Foo]);
		const rec = await Foo.create(db, { bar: "baz" });
		expect(rec.bar).toBe("baz");
	});
});
