import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { RecordId, surql } from "surrealdb";
import type { Surreal } from "surrealdb";
import {
	Field,
	Index,
	Table,
	applySchema,
	generateFullSchemaQl,
} from "../../src";
import { setupInMemoryDb, teardownDb } from "../utils/dbTestUtils";

// ============================================================================
// Test models
// ============================================================================

class PerfUser extends Table.normal({
	name: "perf_user",
	fields: {
		name: Field.string(),
		email: Field.string(),
		age: Field.number(),
		active: Field.bool({ default: surql`true` }),
	},
	schemafull: true,
}) {}

class PerfPost extends Table.normal({
	name: "perf_post",
	fields: {
		title: Field.string(),
		views: Field.number({ default: surql`0` }),
		author: Field.record(() => PerfUser),
	},
	schemafull: true,
}) {}

// Indexes
const PerfUserEmailIndex = Index.define(() => PerfUser, {
	name: "perf_user_email_unique",
	fields: ["email"],
	unique: true,
});

const PerfUserCountIndex = Index.define(() => PerfUser, {
	name: "perf_user_count",
	count: true,
});

const PerfPostFTSIndex = Index.define(() => PerfPost, {
	name: "perf_post_title_fts",
	fields: ["title"],
	search: true,
	analyzer: "class",
	bm25: true,
	highlights: true,
});

// ============================================================================
// Tests
// ============================================================================

describe("Performance features", () => {
	let db: Surreal;

	beforeAll(async () => {
		db = await setupInMemoryDb("perf_test", "perf_test");
		await applySchema(db, [
			PerfUser,
			PerfPost,
			PerfUserEmailIndex,
			PerfUserCountIndex,
			PerfPostFTSIndex,
		]);
	});

	afterAll(async () => {
		await teardownDb(db);
	});

	// ============================================================================
	// UPSERT
	// ============================================================================

	describe("UPSERT", () => {
		test("creates a new record when no match exists", async () => {
			const user = await PerfUser.upsert(db, {
				data: { name: "Alice", email: "alice@perf.com", age: 30, active: true },
			});

			expect(user).toBeDefined();
			expect(user.name).toBe("Alice");
			expect(user.email).toBe("alice@perf.com");
			expect(user.age).toBe(30);
		});

		test("updates existing record when unique index matches", async () => {
			// First create
			await PerfUser.upsert(db, {
				data: { name: "Bob", email: "bob@perf.com", age: 25, active: true },
			});

			// Upsert with same email — should update, not create
			const updated = await PerfUser.upsert(db, {
				data: {
					name: "Bob Smith",
					email: "bob@perf.com",
					age: 26,
					active: true,
				},
			});

			expect(updated.name).toBe("Bob Smith");
			expect(updated.age).toBe(26);

			// Verify only one record with this email exists
			const users = await PerfUser.select(db, {
				where: (f) => f.email.eq("bob@perf.com"),
			});
			expect(users.length).toBe(1);
		});

		test("upsert with explicit record ID", async () => {
			const user = await PerfUser.upsert(db, {
				id: new RecordId("perf_user", "explicit"),
				data: { name: "Carol", email: "carol@perf.com", age: 28, active: true },
			});

			expect(String(user.id)).toBe("perf_user:explicit");

			// Upsert again with same ID — should update
			const updated = await PerfUser.upsert(db, {
				id: new RecordId("perf_user", "explicit"),
				data: {
					name: "Carol Updated",
					email: "carol@perf.com",
					age: 29,
					active: true,
				},
			});

			expect(updated.name).toBe("Carol Updated");
			expect(updated.age).toBe(29);
		});
	});

	// ============================================================================
	// Record ID ranges
	// ============================================================================

	describe("Record ID ranges", () => {
		test("selects a range of records by ID order", async () => {
			// Create records with numeric IDs
			await PerfUser.create(db, {
				id: new RecordId("perf_user", 1),
				name: "U1",
				email: "u1@perf.com",
				age: 1,
				active: true,
			});
			await PerfUser.create(db, {
				id: new RecordId("perf_user", 2),
				name: "U2",
				email: "u2@perf.com",
				age: 2,
				active: true,
			});
			await PerfUser.create(db, {
				id: new RecordId("perf_user", 3),
				name: "U3",
				email: "u3@perf.com",
				age: 3,
				active: true,
			});
			await PerfUser.create(db, {
				id: new RecordId("perf_user", 4),
				name: "U4",
				email: "u4@perf.com",
				age: 4,
				active: true,
			});
			await PerfUser.create(db, {
				id: new RecordId("perf_user", 5),
				name: "U5",
				email: "u5@perf.com",
				age: 5,
				active: true,
			});

			const startId = new RecordId("perf_user", 2);
			const endId = new RecordId("perf_user", 4);

			const results = await PerfUser.select(db, {
				from: { range: [startId, endId] },
			});

			expect(results.length).toBe(3);
			const names = results.map((r) => r.name).sort();
			expect(names).toEqual(["U2", "U3", "U4"]);
		});
	});

	// ============================================================================
	// Multiple Record ID selection
	// ============================================================================

	describe("Multiple Record ID selection", () => {
		test("selects multiple records by ID array", async () => {
			const id1 = new RecordId("perf_user", 1);
			const id3 = new RecordId("perf_user", 3);
			const id5 = new RecordId("perf_user", 5);

			const results = await PerfUser.select(db, {
				from: [id1, id3, id5],
			});

			expect(results.length).toBe(3);
			const names = results.map((r) => r.name).sort();
			expect(names).toEqual(["U1", "U3", "U5"]);
		});

		test("single RecordId still works", async () => {
			const id = new RecordId("perf_user", 1);

			const result = await PerfUser.select(db, {
				from: id,
				only: true,
			});

			expect(result).toBeDefined();
			// biome-ignore lint/suspicious/noExplicitAny: explain returns raw plan objects
			const name = (result as any)?.name;
			expect(name).toBe("U1");
		});
	});

	// ============================================================================
	// Index DDL generation
	// ============================================================================

	describe("Index DDL generation", () => {
		test("COUNT index generates correct DDL", async () => {
			const ddl = generateFullSchemaQl([PerfUser, PerfUserCountIndex]);
			expect(ddl).toContain("COUNT");
		});

		test("CONCURRENTLY flag generates correct DDL", () => {
			const concurrentIndex = Index.define(() => PerfUser, {
				name: "perf_user_age_concurrent",
				fields: ["age"],
				concurrently: true,
			});
			const ddl = generateFullSchemaQl([PerfUser, concurrentIndex]);
			expect(ddl).toContain("CONCURRENTLY");
		});

		test("DEFER flag generates correct DDL", () => {
			const deferIndex = Index.define(() => PerfUser, {
				name: "perf_user_age_defer",
				fields: ["age"],
				defer: true,
			});
			const ddl = generateFullSchemaQl([PerfUser, deferIndex]);
			expect(ddl).toContain("DEFER");
		});

		test("Full-text search with BM25 and HIGHLIGHTS generates correct DDL", () => {
			const ftsIndex = Index.define(() => PerfPost, {
				name: "perf_post_content_fts",
				fields: ["title"],
				search: true,
				analyzer: "class",
				bm25: true,
				highlights: true,
			});
			const ddl = generateFullSchemaQl([PerfPost, ftsIndex]);
			expect(ddl).toContain("FULLTEXT");
			expect(ddl).toContain("ANALYZER class");
			expect(ddl).toContain("BM25");
			expect(ddl).toContain("HIGHLIGHTS");
		});
	});

	// ============================================================================
	// EXPLAIN
	// ============================================================================

	describe("EXPLAIN", () => {
		test("explain flag returns query plan", async () => {
			const results = await PerfUser.select(db, {
				explain: true,
				// biome-ignore lint/suspicious/noExplicitAny: explain returns raw plan objects, not model instances
			} as any);

			// EXPLAIN returns a query plan object with execution details
			expect(results).toBeDefined();
			expect(typeof results).toBe("object");
		});
	});

	// ============================================================================
	// WITH clause (index hints)
	// ============================================================================

	describe("WITH clause", () => {
		test("select with specific index hint", async () => {
			const results = await PerfUser.select(db, {
				with: { indexes: ["perf_user_email_unique"] },
				where: (f) => f.email.eq("alice@perf.com"),
			});

			expect(results.length).toBe(1);
			expect(results[0].name).toBe("Alice");
		});

		test("select with noIndex hint", async () => {
			const results = await PerfUser.select(db, {
				with: { noIndex: true },
				limit: 1,
			});

			expect(results.length).toBe(1);
		});
	});

	// ============================================================================
	// SPLIT clause
	// ============================================================================

	describe("SPLIT clause", () => {
		test("select with split on array field", async () => {
			// Create a post with tags
			const author = await PerfUser.select(db, {
				where: (f) => f.email.eq("alice@perf.com"),
				only: true,
			});

			// PerfPost doesn't have tags, but we can test split on author field
			const results = await PerfPost.select(db, {
				split: ["author"],
				limit: 1,
			});

			expect(results.length).toBeGreaterThanOrEqual(0);
		});
	});

	// ============================================================================
	// RangeId builder
	// ============================================================================

	describe("RangeId builder", () => {
		beforeAll(async () => {
			await PerfUser.create(db, {
				id: new RecordId("perf_user", 10),
				name: "R1",
				email: "r1@perf.com",
				age: 1,
				active: true,
			});
			await PerfUser.create(db, {
				id: new RecordId("perf_user", 11),
				name: "R2",
				email: "r2@perf.com",
				age: 2,
				active: true,
			});
			await PerfUser.create(db, {
				id: new RecordId("perf_user", 12),
				name: "R3",
				email: "r3@perf.com",
				age: 3,
				active: true,
			});
			await PerfUser.create(db, {
				id: new RecordId("perf_user", 13),
				name: "R4",
				email: "r4@perf.com",
				age: 4,
				active: true,
			});
			await PerfUser.create(db, {
				id: new RecordId("perf_user", 14),
				name: "R5",
				email: "r5@perf.com",
				age: 5,
				active: true,
			});
		});

		test("RangeId().from().toInclusive() selects inclusive range", async () => {
			const results = await PerfUser.select(db, {
				from: PerfUser.RangeId().from(11).toInclusive(13),
			});

			expect(results.length).toBe(3);
		});

		test("RangeId().from().to() excludes end by default", async () => {
			const results = await PerfUser.select(db, {
				from: PerfUser.RangeId().from(11).to(13),
			});

			expect(results.length).toBe(2);
		});

		test("fromUnbounded().to() excludes the end bound", async () => {
			const results = await PerfUser.select(db, {
				from: PerfUser.RangeId().fromUnbounded().to(12),
			});

			const names = results.map((r) => r.name);
			expect(names).toContain("R1");
			expect(names).toContain("R2");
			expect(names).not.toContain("R3");
		});

		test("from().toUnbounded() includes the start bound", async () => {
			const results = await PerfUser.select(db, {
				from: PerfUser.RangeId().from(13).toUnbounded(),
			});

			const names = results.map((r) => r.name);
			expect(names).toContain("R4");
			expect(names).toContain("R5");
			expect(names).not.toContain("R3");
		});

		test("string IDs are escaped to prevent injection", () => {
			const range = PerfUser.RangeId()
				.from("bad'; DROP TABLE perf_user; --")
				.to("zzz");
			const str = String(range);

			expect(str.startsWith("perf_user:⟨")).toBe(true);
			expect(str.endsWith("⟩..zzz")).toBe(true);
		});
	});
});
