// Tests for relation table definition, type checks, CRUD

import { test, describe, expect, beforeAll, afterAll } from "bun:test";
import { Field } from "../../src/fields";
import Table from "../../src/define";
import { setupInMemoryDb, teardownDb } from "../utils/dbTestUtils";
import type { Surreal } from "surrealdb";
import { applySchema } from "../../src";

let db: Surreal;

beforeAll(async () => {
	db = await setupInMemoryDb("relation_basic", "relation_basic");
});
afterAll(async () => {
	await teardownDb(db);
});

describe("Relation Table - definition and type checks", () => {
	class User extends Table.normal({
		name: "user_rel",
		fields: { name: Field.string() },
		schemafull: true,
	}) {}
	class Post extends Table.normal({
		name: "post_rel",
		fields: { title: Field.string() },
		schemafull: true,
	}) {}
	class Authored extends Table.relation({
		name: "authored_rel",
		fields: {
			in: Field.record(() => User),
			out: Field.record(() => Post),
			since: Field.datetime(),
		},
		schemafull: true,
	}) {}

	test("apply schema", async () => {
		await applySchema(db, [User, Post, Authored]);
	});

	test("should hydrate related records via fetch", async () => {
		const user = await User.create(db, { name: "Bob" });
		const post = await Post.create(db, { title: "World" });
		const rel = await Authored.create(db, {
			in: user.id,
			out: post.id,
			since: new Date(),
		});
		const fetched = await Authored.select(db, {
			from: rel.id,
			only: true,
			fetch: ["in", "out"],
		});
		expect(fetched?.in).toBeInstanceOf(User);
		expect(fetched?.out).toBeInstanceOf(Post);
		expect((fetched?.in as User).name).toBe("Bob");
		expect((fetched?.out as Post).title).toBe("World");
	});
});
