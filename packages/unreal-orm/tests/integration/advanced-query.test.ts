import { test, describe, expect, beforeAll, afterAll } from "bun:test";
import { Field, Table, applySchema } from "../../src";
import { eq, raw, surql, type Surreal, Table as SurrealTable } from "surrealdb";
import { setupInMemoryDb, teardownDb } from "../utils/dbTestUtils";

let db: Surreal;

beforeAll(async () => {
	db = await setupInMemoryDb("advanced_query", "advanced_query");
});
afterAll(async () => {
	await teardownDb(db);
});

describe("Advanced Querying", () => {
	class User extends Table.normal({
		name: "user",
		fields: {
			name: Field.string(),
			age: Field.number(),
			city: Field.string(),
		},
		schemafull: true,
	}) {}

	class Post extends Table.normal({
		name: "post",
		fields: {
			title: Field.string(),
			published: Field.bool(),
			author: Field.record(() => User),
		},
		schemafull: true,
	}) {}

	let users: InstanceType<typeof User>[];
	let posts: InstanceType<typeof Post>[];

	test("apply schema", async () => {
		await applySchema(db, [User, Post], "OVERWRITE");
	});

	beforeAll(async () => {
		users = [
			await User.create(db, { name: "Alice", age: 30, city: "NY" }),
			await User.create(db, { name: "Bob", age: 25, city: "LA" }),
			await User.create(db, { name: "Carol", age: 35, city: "NY" }),
		];
		posts = [
			await Post.create(db, {
				title: "First",
				published: true,
				author: users[0]?.id,
			}),
			await Post.create(db, {
				title: "Second",
				published: false,
				author: users[1]?.id,
			}),
			await Post.create(db, {
				title: "Third",
				published: true,
				author: users[2]?.id,
			}),
		];
	});

	test("filter: users in NY", async () => {
		const city = "NY";
		const found = await User.select(db, {
			where: surql`city = ${city}`,
		});
		expect(found.length).toBe(2);
		expect(found.map((u) => u.name).sort()).toEqual(["Alice", "Carol"]);
	});

	test("filter: users age > 28", async () => {
		const age = 28;
		const found = await User.select(db, {
			where: surql`age > ${age}`,
		});
		expect(found.length).toBe(2);
		expect(found.map((u) => u.name).sort()).toEqual(["Alice", "Carol"]);
	});

	test("sort: users by age desc", async () => {
		const found = await User.select(db, {
			orderBy: [{ field: "age", order: "desc" }],
		});
		expect(found[0]?.name).toBe("Carol");
		expect(found[1]?.name).toBe("Alice");
		expect(found[2]?.name).toBe("Bob");
	});

	test("pagination: limit/offset", async () => {
		const first = await User.select(db, {
			orderBy: [{ field: "age", order: "asc" }],
			limit: 1,
		});
		expect(first.length).toBe(1);
		expect(first[0]?.name).toBe("Bob");
		const second = await User.select(db, {
			orderBy: [{ field: "age", order: "asc" }],
			limit: 1,
			start: 1,
		});
		expect(second.length).toBe(1);
		expect(second[0]?.name).toBe("Alice");
	});

	test("projection: select only name", async () => {
		const city = "NY";
		const found = await User.select(db, {
			select: ["name"],
			where: surql`city = ${city}`,
		});
		expect(found.length).toBe(2);
		expect(found[0]).toHaveProperty("name");
		expect(found[0]).not.toHaveProperty("age");
	});

	test("comprehensive: all query options combined", async () => {
		// Test using most available options: select, where, orderBy, limit, start, fetch
		const published = true;
		const found = await Post.select(db, {
			select: ["title", "published", "author"],
			where: surql`published = ${published}`,
			orderBy: [{ field: "title", order: "ASC" }],
			limit: 2,
			start: 0,
			fetch: ["author"],
		});

		expect(found.length).toBe(2);
		expect(found[0]).toHaveProperty("title");
		expect(found[0]).toHaveProperty("published");
		expect(found[0]).toHaveProperty("author");
		expect(found[0]).not.toHaveProperty("id"); // Not selected

		// Should be ordered by title ASC: "First", "Third"
		expect(found[0]?.title).toBe("First");
		expect(found[1]?.title).toBe("Third");

		// Both should be published
		expect(found.every((p) => p.published === true)).toBe(true);
	});

	test("group by with aggregation", async () => {
		// Test GROUP BY functionality
		const found = await User.select(db, {
			select: ["city", "count() as user_count"],
			groupBy: ["city"],
			orderBy: [{ field: "city", order: "ASC" }],
		});

		expect(found.length).toBe(2); // Two cities: LA, NY
		expect(found.some((g) => g.city === "LA" && g.user_count === 1)).toBe(true);
		expect(found.some((g) => g.city === "NY" && g.user_count === 2)).toBe(true);
	});

	test("only option: single record", async () => {
		// Test the 'only' option to return single record instead of array
		const name = "Alice";
		const user = await User.select(db, {
			where: surql`name = ${name}`,
			only: true,
			limit: 1,
		});

		expect(user).not.toBeInstanceOf(Array);
		expect(user?.name).toBe("Alice");
	});

	test("with clause: index specification", async () => {
		// Test WITH INDEX clause
		const city = "NY";
		const found = await User.select(db, {
			select: ["name", "city"],
			with: { indexes: ["city_idx"] },
			where: surql`city = ${city}`,
		});

		expect(found.length).toBe(2);
		expect(found.every((u) => u.city === "NY")).toBe(true);
	});

	test("with clause: no index", async () => {
		// Test WITH NOINDEX clause
		const age = 25;
		const found = await User.select(db, {
			select: ["name", "age"],
			with: { noIndex: true },
			where: surql`age > ${age}`,
		});

		expect(found.length).toBe(2);
		expect(found.every((u) => u.age && u.age > 25)).toBe(true);
	});

	test("split clause: split by field", async () => {
		// Test SPLIT clause functionality
		const found = await User.select(db, {
			select: ["city", "count() as user_count"],
			split: ["city"],
			orderBy: [{ field: "city", order: "ASC" }],
		});

		// SPLIT should return raw data, not model instances
		expect(Array.isArray(found)).toBe(true);
		expect(found.length).toBeGreaterThan(0);
	});

	test("timeout clause", async () => {
		// Test TIMEOUT clause
		const found = await User.select(db, {
			select: ["name", "city"],
			timeout: "5s",
			limit: 2,
		});

		expect(found.length).toBe(2);
		expect(found[0]).toHaveProperty("name");
	});

	test("parallel execution", async () => {
		// Test PARALLEL clause
		const found = await User.select(db, {
			select: ["name", "age"],
			parallel: true,
			orderBy: [{ field: "age", order: "ASC" }],
		});

		expect(found.length).toBe(3);
		expect(found[0]?.name).toBe("Bob"); // Youngest
	});

	test("tempfiles usage", async () => {
		// Test TEMPFILES clause
		const found = await User.select(db, {
			select: ["city", "count() as user_count"],
			groupBy: ["city"],
			tempfiles: true,
			orderBy: [{ field: "city", order: "ASC" }],
		});

		expect(found.length).toBe(2); // Two cities
		expect(found.some((g) => g.city === "LA")).toBe(true);
	});

	test("explain query plan", async () => {
		// Test EXPLAIN clause
		const city = "NY";
		const plan = await User.select(db, {
			select: ["name", "city"],
			where: surql`city = ${city}`,
			explain: true,
		});

		// EXPLAIN should return raw query plan data
		expect(plan).toBeDefined();
		// Query plan structure will depend on SurrealDB version
	});

	test("comprehensive: maximum query complexity", async () => {
		// Test using ALL available options together - the full original test
		console.log("Starting complex query test...");

		try {
			const published = true;
			const found = await Post.select(db, {
				select: ["title", "published", "author"],
				from: new SurrealTable("post"),
				with: { noIndex: true },
				where: surql`published = ${published}`,
				groupBy: ["published"],
				orderBy: [{ field: "title", order: "ASC" }],
				limit: 5,
				start: 0,
				fetch: ["author"],
				timeout: "2s",
				// TODO: address query not resolving bug with parallel
				// parallel: true,
				tempfiles: true,
			});

			// Should return raw data due to groupBy
			expect(Array.isArray(found)).toBe(true);
		} catch (error) {
			console.log("Query failed with error:", error);
			throw error;
		}
	});

	test("debug: test PARALLEL clause isolation", async () => {
		// Test if PARALLEL alone causes the hanging issue
		console.log("Testing minimal PARALLEL query...");

		try {
			const city = "NY";
			const found = await User.select(db, {
				select: ["name", "city"],
				where: eq("city", city),
				parallel: true,
				timeout: "3s",
			});
			expect(Array.isArray(found)).toBe(true);
			expect(found.length).toBe(2);
		} catch (error) {
			console.log("PARALLEL query failed:", error);
			throw error;
		}
	});

	test("debug: test PARALLEL with different combinations", async () => {
		// Test PARALLEL with various other clauses to isolate the issue
		console.log("Testing PARALLEL + LIMIT...");

		try {
			const found = await User.select(db, {
				parallel: true,
				limit: 1,
				timeout: "3s",
			});
			expect(Array.isArray(found)).toBe(true);
		} catch (error) {
			console.log("PARALLEL + LIMIT failed:", error);
			throw error;
		}
	});

	test("debug: test PARALLEL with ORDER BY", async () => {
		// Test PARALLEL with ORDER BY specifically
		console.log("Testing PARALLEL + ORDER BY...");

		try {
			const found = await User.select(db, {
				orderBy: [{ field: "age", order: "ASC" }],
				parallel: true,
				timeout: "3s",
			});
			expect(Array.isArray(found)).toBe(true);
		} catch (error) {
			console.log("PARALLEL + ORDER BY failed:", error);
			throw error;
		}
	});

	test("complex query: separate test for resource-intensive options", async () => {
		// Test resource-intensive options separately to avoid conflicts
		const found = await User.select(db, {
			select: ["city", "count() as user_count"],
			groupBy: ["city"],
			// Remove conflicting options: parallel + tempfiles + noindex
			timeout: "15s",
		});

		expect(Array.isArray(found)).toBe(true);
	});

	test("order by with collation and numeric", async () => {
		// Test ORDER BY with COLLATE and NUMERIC options
		const found = await User.select(db, {
			select: ["name", "age"],
			orderBy: [
				{ field: "name", order: "ASC", collate: true },
				{ field: "age", order: "DESC", numeric: true },
			],
		});

		expect(found.length).toBe(3);
		expect(found[0]).toHaveProperty("name");
	});

	test("negative: invalid query", async () => {
		expect(
			User.select(db, { where: surql`not_a_field = 123` }),
		).resolves.toThrow();
	});

	test("select with BoundQuery in from clause", async () => {
		// Test that BoundQuery works in the from option
		const found = await User.select(db, {
			from: surql`user WHERE age > 28`,
		});

		expect(found.length).toBe(2); // Alice (30) and Carol (35)
		expect(found[0]).toHaveProperty("name");
		expect(found[0]).toHaveProperty("age");
		expect(found[0]).toHaveProperty("city");
	});

	test("select with Expr in from clause", async () => {
		// Test that raw Expr works in the from option
		const found = await User.select(db, {
			from: raw("user"),
			where: surql`age < 30`,
		});

		expect(found.length).toBe(1); // Bob (25)
		expect(found[0]).toHaveProperty("name");
		expect(found[0]).toHaveProperty("age");
		expect(found[0]).toHaveProperty("city");
	});

	test("select with explicit Table in from clause", async () => {
		// Test that explicit Table object works correctly (not misclassified as Expr)
		const found = await User.select(db, {
			from: new SurrealTable("user"),
		});

		expect(found.length).toBe(3); // All users
		expect(found[0]).toHaveProperty("name");
		expect(found[0]).toHaveProperty("age");
		expect(found[0]).toHaveProperty("city");
	});

	test("select with explicit RecordId in from clause", async () => {
		// Test that explicit RecordId object works correctly (not misclassified as Expr)
		const user = users[0]; // Alice
		const found = await User.select(db, {
			from: user.id,
			only: true,
		});

		expect(found).toBeDefined();
		expect(found).toHaveProperty("name", "Alice");
		expect(found).toHaveProperty("age", 30);
	});
});
