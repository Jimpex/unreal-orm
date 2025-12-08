/**
 * Integration tests for the type-safe select API.
 * Tests actual query execution and verifies returned data matches expected types.
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Table, Field, typed, applySchema } from "../../src";
import { setupInMemoryDb, teardownDb } from "../utils/dbTestUtils";
import { surql } from "surrealdb";
import type { Surreal } from "surrealdb";

let db: Surreal;

// ============================================================================
// Test Models
// ============================================================================

class Author extends Table.normal({
	name: "author",
	fields: {
		name: Field.string(),
		email: Field.string(),
		bio: Field.option(Field.string()),
	},
	schemafull: true,
}) {}

class Post extends Table.normal({
	name: "post",
	fields: {
		title: Field.string(),
		content: Field.string(),
		views: Field.number(),
		author: Field.record(() => Author),
		metadata: Field.object({
			category: Field.string(),
			featured: Field.bool(),
		}),
	},
	schemafull: true,
}) {}

class Comment extends Table.normal({
	name: "comment",
	fields: {
		body: Field.string(),
		post: Field.record(() => Post),
	},
	schemafull: true,
}) {}

// ============================================================================
// Setup
// ============================================================================

beforeAll(async () => {
	db = await setupInMemoryDb("select_builder", "select_builder");
	await applySchema(db, [Author, Post, Comment]);

	// Seed test data
	const author = await Author.create(db, {
		name: "Alice",
		email: "alice@example.com",
		bio: "Writer",
	});

	const post = await Post.create(db, {
		title: "Hello World",
		content: "This is my first post",
		views: 100,
		author: author.id,
		metadata: {
			category: "tech",
			featured: true,
		},
	});

	await Comment.create(db, { body: "Great post!", post: post.id });
	await Comment.create(db, { body: "Thanks for sharing", post: post.id });
});

afterAll(async () => {
	await teardownDb(db);
});

// ============================================================================
// Tests
// ============================================================================

describe("Object select - field selection", () => {
	test("select specific fields returns only those fields", async () => {
		const results = await Post.select(db, {
			select: {
				title: true,
				views: true,
			},
		});

		expect(results).toHaveLength(1);
		const post = results[0];

		// Should have selected fields
		expect(post).toHaveProperty("title", "Hello World");
		expect(post).toHaveProperty("views", 100);

		// Should NOT have non-selected fields
		expect(post).not.toHaveProperty("content");
		expect(post).not.toHaveProperty("author");
		expect(post).not.toHaveProperty("metadata");
	});

	test("select with * returns all fields", async () => {
		const results = await Post.select(db, {
			select: {
				"*": true,
			},
		});

		expect(results).toHaveLength(1);
		const post = results[0];

		// Should have all fields
		expect(post).toHaveProperty("title", "Hello World");
		expect(post).toHaveProperty("content", "This is my first post");
		expect(post).toHaveProperty("views", 100);
		expect(post).toHaveProperty("author");
		expect(post).toHaveProperty("metadata");
	});

	test("select nested object fields with destructuring", async () => {
		const results = await Post.select(db, {
			select: {
				title: true,
				metadata: {
					category: true,
				},
			},
		});

		expect(results).toHaveLength(1);
		const post = results[0];

		// Type inference: post.title is string, post.metadata.category is string
		// (inferred from objectSchema)
		expect(post.title).toBe("Hello World");
		expect(post.metadata).toBeDefined();
		expect(post.metadata.category).toBe("tech");
		// featured should not be present since we only selected category
		expect(post.metadata).not.toHaveProperty("featured");
	});

	test("select record field with nested selection", async () => {
		const results = await Post.select(db, {
			select: {
				title: true,
				author: {
					name: true,
					email: true,
				},
			},
		});

		expect(results).toHaveLength(1);
		const post = results[0];

		// Type inference: post.title is string, post.author.name is string, post.author.email is string
		// (inferred from Author table via recordTableThunk)
		expect(post.title).toBe("Hello World");
		expect(post.author.name).toBe("Alice");
		expect(post.author.email).toBe("alice@example.com");
		// bio should not be present since we didn't select it
		expect(post.author).not.toHaveProperty("bio");
	});
});

describe("Object select - computed fields", () => {
	test("select with typed computed field", async () => {
		const results = await Post.select(db, {
			select: {
				title: true,
				doubled: typed<number>(surql`views * 2`),
			},
		});

		expect(results).toHaveLength(1);
		const post = results[0];

		// Type inference: post.title is string, post.doubled is number (from typed<number>)
		expect(post.title).toBe("Hello World");
		expect(post.doubled).toBe(200); // views (100) * 2
	});

	test("select * with computed field", async () => {
		const results = await Post.select(db, {
			select: {
				"*": true,
				doubled: typed<number>(surql`views * 2`),
			},
		});

		expect(results).toHaveLength(1);
		const post = results[0];

		// Type inference: post has all fields from Post + doubled: number
		expect(post.title).toBe("Hello World");
		expect(post.views).toBe(100);
		expect(post.doubled).toBe(200);
	});
});

describe("String array select", () => {
	test("select with string array", async () => {
		const results = await Post.select(db, {
			select: ["title", "views"],
		});

		expect(results).toHaveLength(1);
		// String array select returns Partial<PostData> - cast needed for specific fields
		const post = results[0] as { title?: string; views?: number };

		expect(post.title).toBe("Hello World");
		expect(post.views).toBe(100);
	});

	test("select nested field with string array", async () => {
		const results = await Post.select(db, {
			select: ["title", "metadata.category"],
		});

		expect(results).toHaveLength(1);
		// String array can't infer nested structure - cast needed
		const post = results[0] as {
			title?: string;
			metadata?: { category: string };
		};

		expect(post.title).toBe("Hello World");
		expect(post.metadata?.category).toBe("tech");
	});
});

describe("Raw surql select", () => {
	test("select with raw surql", async () => {
		const results = await Post.select(db, {
			select: surql`title, views * 3 AS tripled`,
		});

		expect(results).toHaveLength(1);
		// Raw surql can't be type-inferred - cast needed
		const post = results[0] as unknown as { title: string; tripled: number };

		expect(post.title).toBe("Hello World");
		expect(post.tripled).toBe(300); // views (100) * 3
	});
});

describe("OMIT clause", () => {
	test("omit with string array (less type-safe)", async () => {
		const results = await Post.select(db, {
			omit: ["content", "metadata"],
		});

		expect(results).toHaveLength(1);
		const post = results[0];

		// Should have non-omitted fields
		expect(post).toHaveProperty("title", "Hello World");
		expect(post).toHaveProperty("views", 100);

		// Should NOT have omitted fields
		expect(post).not.toHaveProperty("content");
		expect(post).not.toHaveProperty("metadata");
	});

	test("omit with object format (type-safe)", async () => {
		const results = await Post.select(db, {
			omit: { content: true, metadata: true },
		});

		expect(results).toHaveLength(1);
		const post = results[0];

		// Type inference: post has all fields EXCEPT content and metadata
		// post.title is string, post.views is number, post.author is Author | RecordId
		expect(post.title).toBe("Hello World");
		expect(post.views).toBe(100);

		// Should NOT have omitted fields (runtime check)
		expect(post).not.toHaveProperty("content");
		expect(post).not.toHaveProperty("metadata");

		// TypeScript should error if we try to access omitted fields:
		// @ts-expect-error - content is omitted
		void post.content;
		// @ts-expect-error - metadata is omitted
		void post.metadata;
	});
});

describe("VALUE clause", () => {
	test("select value returns array of values", async () => {
		const results = await Post.select(db, {
			value: "title",
		});

		// VALUE returns the values directly, not objects
		expect(results).toHaveLength(1);
		expect(results[0]).toBe("Hello World");
	});

	test("select value with nested field", async () => {
		const results = await Post.select(db, {
			value: "metadata.category",
		});

		expect(results).toHaveLength(1);
		expect(results[0]).toBe("tech");
	});
});
