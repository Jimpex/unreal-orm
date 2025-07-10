// Tests for array of records, fetch, instance hydration

import { test, describe, expect, beforeAll, afterAll } from "bun:test";
import { Field } from "../../src/fields";
import Table from "../../src/define";
import { setupInMemoryDb, teardownDb } from "../utils/dbTestUtils";
import type { Surreal } from "surrealdb";
import { applySchema } from "../../src";

let db: Surreal;

beforeAll(async () => {
	db = await setupInMemoryDb("relation_hydration", "relation_hydration");
});
afterAll(async () => {
	await teardownDb(db);
});

describe("Relation Table - advanced hydration", () => {
	class User extends Table.normal({
		name: "user_hydr",
		fields: { name: Field.string() },
		schemafull: true,
	}) {}
	class Post extends Table.normal({
		name: "post_hydr",
		fields: { title: Field.string(), author: Field.record(() => User) },
		schemafull: true,
	}) {}
	class Authored extends Table.relation({
		name: "authored_hydr",
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

	test("should hydrate array of edges and multi-hop", async () => {
		const alice = await User.create(db, { name: "Alice" });
		const bob = await User.create(db, { name: "Bob" });
		const post1 = await Post.create(db, { title: "First", author: alice.id });
		const post2 = await Post.create(db, { title: "Second", author: alice.id });
		const post3 = await Post.create(db, { title: "Third", author: bob.id });
		await Authored.create(db, {
			in: alice.id,
			out: post1.id,
			since: new Date(),
		});
		await Authored.create(db, {
			in: alice.id,
			out: post2.id,
			since: new Date(),
		});
		await Authored.create(db, { in: bob.id, out: post3.id, since: new Date() });

		// Fetch all Authored edges for Alice
		const authoredEdges = await Authored.select(db, {
			where: "in = $id",
			vars: { id: alice.id },
			fetch: ["out"],
		});
		expect(authoredEdges.length).toBe(2);
		for (const edge of authoredEdges) {
			expect(edge.in.toString()).toBe(alice.id.toString());
			expect(edge.out).toBeInstanceOf(Post);
			// Check that the hydrated Post's author is Alice
			expect((edge.out as Post).author.toString()).toBe(alice.id.toString());
		}
	});

	test("should hydrate nested fetch (edge -> post -> author)", async () => {
		const alice = await User.create(db, { name: "Alice" });
		const post = await Post.create(db, { title: "Deep", author: alice.id });
		const edge = await Authored.create(db, {
			in: alice.id,
			out: post.id,
			since: new Date(),
		});
		const fetched = await Authored.select(db, {
			from: edge.id,
			only: true,
			fetch: ["out", "out.author", "in"],
		});
		expect(fetched).toBeTruthy();
		expect(fetched?.out).toBeInstanceOf(Post);
		expect((fetched?.out as Post).author.id.toString()).toBe(
			alice.id.toString(),
		);
		expect(fetched?.in).toBeInstanceOf(User);
		expect((fetched?.in as User).name).toBe("Alice");
	});
});
