import { test, describe, expect, beforeAll, afterAll } from "bun:test";
import { Field } from "../../src/fields";
import Table from "../../src/define";
import { setupInMemoryDb, teardownDb } from "../utils/dbTestUtils";
import type { Surreal } from "surrealdb";
import { applySchema } from "../../src";

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
		const found = await User.select(db, {
			where: "city = $city",
			vars: { city: "NY" },
		});
		expect(found.length).toBe(2);
		expect(found.map((u) => u.name).sort()).toEqual(["Alice", "Carol"]);
	});

	test("filter: users age > 28", async () => {
		const found = await User.select(db, {
			where: "age > $age",
			vars: { age: 28 },
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
		const found = await User.select(db, {
			select: ["name"],
			where: "city = $city",
			vars: { city: "NY" },
		});
		expect(found.length).toBe(2);
		expect(found[0]).toHaveProperty("name");
		expect(found[0]).not.toHaveProperty("age");
	});

	// TODO: Group by test
	// test("group by city", async () => {
	//   // Example: group by city and count users
	//   const found = await User.select(db, { groupBy: ["city"], select: ["city", { count: "*" }] });
	//   expect(found.some(g => g.city === "NY" && g.count === 2)).toBe(true);
	// });

	test("negative: invalid query", async () => {
		expect(User.select(db, { where: "not_a_field = 123" })).resolves.toThrow();
	});
});
