import { test, describe, expect, beforeAll, afterAll } from "bun:test";
import { Field } from "../../src/fields";
import Table from "../../src/define";
import { setupInMemoryDb, teardownDb } from "../utils/dbTestUtils";
import type { Surreal } from "surrealdb";
import { applySchema } from "../../src";

let db: Surreal;

beforeAll(async () => {
	db = await setupInMemoryDb("full_crud", "full_crud");
});
afterAll(async () => {
	await teardownDb(db);
});

describe("Full CRUD & Relations Integration", () => {
	class User extends Table.normal({
		name: "user",
		fields: {
			name: Field.string(),
			email: Field.string(),
		},
		schemafull: true,
	}) {}

	class Post extends Table.normal({
		name: "post",
		fields: {
			title: Field.string(),
			content: Field.string(),
			author: Field.record(() => User),
		},
		schemafull: true,
	}) {}

	class Comment extends Table.normal({
		name: "comment",
		fields: {
			body: Field.string(),
			post: Field.record(() => Post),
			author: Field.record(() => User),
		},
		schemafull: true,
	}) {}

	let user: InstanceType<typeof User>;
	let post: InstanceType<typeof Post>;
	let comment: InstanceType<typeof Comment>;

	test("apply schema", async () => {
		await applySchema(db, [User, Post, Comment]);
	});

	test("create User", async () => {
		user = await User.create(db, { name: "Alice", email: "alice@example.com" });
		expect(user.name).toBe("Alice");
		expect(user.email).toBe("alice@example.com");
		expect(user.id.toString()).toMatch(/^user:/);
	});

	test("create Post with User relation", async () => {
		post = await Post.create(db, {
			title: "Hello World",
			content: "First post!",
			author: user.id,
		});
		expect(post.title).toBe("Hello World");
		expect(post.author.toString()).toBe(user.id.toString());
		expect(post.id.toString()).toMatch(/^post:/);
	});

	test("create Comment with Post/User relation", async () => {
		comment = await Comment.create(db, {
			body: "Nice post!",
			post: post.id,
			author: user.id,
		});
		expect(comment.body).toBe("Nice post!");
		expect(comment.post.toString()).toBe(post.id.toString());
		expect(comment.author.toString()).toBe(user.id.toString());
		expect(comment.id.toString()).toMatch(/^comment:/);
	});

	test("read Post and hydrate author", async () => {
		const found = await Post.select(db, {
			from: post.id,
			only: true,
			fetch: ["author"],
		});
		expect(found).toBeTruthy();
		expect(found?.author).toBeInstanceOf(User);
		expect((found?.author as User).name).toBe("Alice");
	});

	test("read Comment and hydrate post/author", async () => {
		const found = await Comment.select(db, {
			from: comment.id,
			only: true,
			fetch: ["post", "author"],
		});
		expect(found).toBeTruthy();
		expect(found?.post).toBeInstanceOf(Post);
		expect((found?.post as Post).title).toBe("Hello World");
		expect(found?.author).toBeInstanceOf(User);
		expect((found?.author as User).name).toBe("Alice");
	});

	test("update Post", async () => {
		await post.update(db, {
			title: "Updated Title",
			author: post.author,
			content: post.content,
		});
		expect(post.title).toBe("Updated Title");
	});

	test("delete Comment", async () => {
		await comment.delete(db);
		const found = await Comment.select(db, { from: comment.id, only: true });
		expect(found).toBeUndefined();
	});

	test("delete Post", async () => {
		await post.delete(db);
		const found = await Post.select(db, { from: post.id, only: true });
		expect(found).toBeUndefined();
	});

	test("delete User", async () => {
		await user.delete(db);
		const found = await User.select(db, { from: user.id, only: true });
		expect(found).toBeUndefined();
	});

	test("advanced query: create multiple, fetch all", async () => {
		const u1 = await User.create(db, { name: "Bob", email: "bob@example.com" });
		const u2 = await User.create(db, {
			name: "Carol",
			email: "carol@example.com",
		});
		const p1 = await Post.create(db, {
			title: "P1",
			content: "C1",
			author: u1.id,
		});
		const p2 = await Post.create(db, {
			title: "P2",
			content: "C2",
			author: u2.id,
		});
		const posts = await Post.select(db);
		expect(posts.length).toBeGreaterThanOrEqual(2);
		const authors = posts.map((p: InstanceType<typeof Post>) => p.author);
		expect(authors.map((a) => a.toString()).includes(u1.id.toString()));
		expect(authors.map((a) => a.toString()).includes(u2.id.toString()));
	});
});
