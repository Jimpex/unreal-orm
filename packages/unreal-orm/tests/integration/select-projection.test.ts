import { test, describe, expect, beforeAll, afterAll } from "bun:test";
import { Field, Table, applySchema, typed } from "../../src";
import { surql } from "surrealdb";
import { setupInMemoryDb, teardownDb } from "../utils/dbTestUtils";
import { RecordId } from "surrealdb";
import type { Surreal } from "surrealdb";

let db: Surreal;

beforeAll(async () => {
	db = await setupInMemoryDb("select_projection", "select_projection");
});
afterAll(async () => {
	await teardownDb(db);
});

describe("Select Field Projection (runtime)", () => {
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
				tags: Field.array(Field.string()),
			}),
		},
		schemafull: true,
	}) {}

	let author: InstanceType<typeof Author>;
	let post: InstanceType<typeof Post>;

	beforeAll(async () => {
		await applySchema(db, [Author, Post]);

		author = await Author.create(db, {
			name: "Alice",
			email: "alice@example.com",
			bio: "Tech writer",
		});

		post = await Post.create(db, {
			title: "Hello World",
			content: "Post content here",
			views: 42,
			author: author.id,
			metadata: {
				category: "engineering",
				featured: true,
				tags: ["orms", "surrealdb"],
			},
		});
	});

	// =========================================================================
	// Basic field projection
	// =========================================================================

	test("select specific scalar fields — only selected fields are returned", async () => {
		const result = await Post.select(db, {
			select: { title: true, views: true },
			from: post.id,
			only: true,
		});

		// result is inferred as { title: string; views: number } | undefined
		expect(result).toBeTruthy();
		expect(result?.title).toBe("Hello World");
		expect(result?.views).toBe(42);
		// result.content would be a compile error — not in the projection
	});

	// =========================================================================
	// Nested object projection
	// =========================================================================

	test("select nested object sub-fields — only selected sub-fields returned", async () => {
		const result = await Post.select(db, {
			select: { title: true, metadata: { category: true } },
			from: post.id,
			only: true,
		});

		// result is inferred as { title: string; metadata: { category: string } } | undefined
		expect(result).toBeTruthy();
		expect(result?.title).toBe("Hello World");
		expect(result?.metadata?.category).toBe("engineering");
	});

	// =========================================================================
	// Record link with `true` — returns RecordId, not hydrated
	// =========================================================================

	test("select record link field with `true` — returns RecordId, not hydrated object", async () => {
		const result = await Post.select(db, {
			select: { title: true, author: true },
			from: post.id,
			only: true,
		});

		// result inferred as { title: string; author: RecordId<"author"> | InstanceType<... > } | undefined
		expect(result).toBeTruthy();
		expect(result?.title).toBe("Hello World");
		expect(result?.author).toBeInstanceOf(RecordId);
		expect(String(result?.author)).toBe(author.id.toString());
	});

	// =========================================================================
	// Nested record projection — expands author with specific sub-fields
	// =========================================================================

	test("select nested record sub-fields — expands author and returns only selected fields", async () => {
		const result = await Post.select(db, {
			select: { title: true, author: { name: true, email: true } },
			from: post.id,
			only: true,
		});

		// result inferred as { title: string; author: { name: string; email: string } } | undefined
		expect(result).toBeTruthy();
		expect(result?.title).toBe("Hello World");
		expect(typeof result?.author).toBe("object");
		expect(result?.author.name).toBe("Alice");
		expect(result?.author.email).toBe("alice@example.com");
	});

	// =========================================================================
	// Wildcard selection
	// =========================================================================

	test("select `*` — returns all fields at the root level", async () => {
		const result = await Post.select(db, {
			select: { "*": true },
			from: post.id,
			only: true,
		});

		// result inferred as full table shape | undefined (intersection with all fields)
		expect(result).toBeTruthy();
		expect(result?.title).toBe("Hello World");
		expect(result?.content).toBe("Post content here");
		expect(result?.views).toBe(42);
	});

	// =========================================================================
	// Wildcard + nested override
	// =========================================================================

	test("select `*` + explicit nested override — overrides record link with sub-selection", async () => {
		const result = await Post.select(db, {
			select: { "*": true, author: { name: true } },
			from: post.id,
			only: true,
		});

		// result inferred as all scalar fields + author: { name: string } | undefined
		expect(result).toBeTruthy();
		expect(result?.title).toBe("Hello World");
		expect(result?.views).toBe(42);
		expect(typeof result?.author).toBe("object");
		expect(result?.author.name).toBe("Alice");
	});

	// =========================================================================
	// ID projection
	// =========================================================================

	test("select `id: true` — returns the record ID", async () => {
		const result = await Post.select(db, {
			select: { id: true, title: true },
			from: post.id,
			only: true,
		});

		// result inferred as { id: RecordId; title: string } | undefined
		expect(result).toBeTruthy();
		expect(result?.id).toBeInstanceOf(RecordId);
		expect(String(result?.id)).toBe(post.id.toString());
		expect(result?.title).toBe("Hello World");
	});

	// =========================================================================
	// Multiple records
	// =========================================================================

	test("select projection across multiple records — returns array with only selected fields", async () => {
		const extra = await Post.create(db, {
			title: "Second Post",
			content: "Another post",
			views: 10,
			author: author.id,
			metadata: { category: "news", featured: false, tags: [] },
		});

		const results = await Post.select(db, {
			select: { title: true, views: true },
		});

		// results inferred as { title: string; views: number }[]
		expect(results.length).toBeGreaterThanOrEqual(2);
		for (const r of results) {
			expect(typeof r.title).toBe("string");
			expect(typeof r.views).toBe("number");
		}

		await extra.delete(db);
	});

	// =========================================================================
	// typed() computed field
	// =========================================================================

	test("typed() expression — inferred as the declared generic type", async () => {
		// typed<T>(expr) creates a TypedExpr<T> — the return should be inferred
		// as the declared generic T, not as unknown.
		const result = await Post.select(db, {
			select: {
				title: true,
				// Compute the string length as a custom expression
				titleLength: typed<number>(surql`string::len(title)`),
			},
			from: post.id,
			only: true,
		});

		// result inferred as { title: string; titleLength: number } | undefined
		expect(result).toBeTruthy();
		expect(result?.title).toBe("Hello World");
		expect(typeof result?.titleLength).toBe("number");
		expect(result?.titleLength).toBe("Hello World".length);
	});

	// =========================================================================
	// omit — field exclusion
	// =========================================================================

	test("omit single field — excluded field absent, others present", async () => {
		const results = await Post.select(db, {
			omit: { views: true },
			from: post.id,
		});

		// results inferred as InferOmitResult<PostFields, { views: true }>[]
		expect(results.length).toBeGreaterThanOrEqual(1);
		const r = results[0];
		expect(r).toBeTruthy();
		if (!r) return;
		expect(r.title).toBe("Hello World");
		expect(r.content).toBe("Post content here");
		// 'views' should be absent at runtime (omitted by SurrealDB)
		expect("views" in r).toBe(false);
	});

	test("omit multiple fields — all excluded fields absent", async () => {
		const result = await Post.select(db, {
			omit: { views: true, content: true },
			from: post.id,
			only: true,
		});

		// result inferred as Omit<PostShape, 'views' | 'content'> | undefined
		expect(result).toBeTruthy();
		expect(result?.title).toBe("Hello World");
		expect("views" in (result ?? {})).toBe(false);
		expect("content" in (result ?? {})).toBe(false);
	});

	test("omit with only: true — single result with field excluded", async () => {
		const result = await Post.select(db, {
			omit: { author: true },
			from: post.id,
			only: true,
		});

		// result inferred as Omit<PostShape, 'author'> | undefined
		expect(result).toBeTruthy();
		expect(result?.title).toBe("Hello World");
		expect("author" in (result ?? {})).toBe(false);
	});
});
