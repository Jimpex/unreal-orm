import { test, describe, expect, beforeEach, afterEach } from "bun:test";
import { Field, Table, applySchema } from "../../src";
import { setupInMemoryDb, teardownDb } from "../utils/dbTestUtils";
import { surql, type Surreal } from "surrealdb";

let db: Surreal;

class User extends Table.normal({
	name: "user",
	fields: {
		name: Field.string(),
		age: Field.number(),
		city: Field.string(),
		active: Field.bool(),
	},
	schemafull: true,
}) {}

beforeEach(async () => {
	db = await setupInMemoryDb("bulk_crud", "bulk_crud");
	await applySchema(db, [User], "OVERWRITE");
});

afterEach(async () => {
	await teardownDb(db);
});

describe("Bulk CRUD", () => {
	test("count returns total number of records", async () => {
		await User.create(db, { name: "Alice", age: 30, city: "NY", active: true });
		await User.create(db, { name: "Bob", age: 25, city: "LA", active: false });
		await User.create(db, { name: "Carol", age: 35, city: "NY", active: true });

		const total = await User.count(db);
		expect(total).toBe(3);
	});

	test("count with where filter", async () => {
		await User.create(db, { name: "Alice", age: 30, city: "NY", active: true });
		await User.create(db, { name: "Bob", age: 25, city: "LA", active: false });
		await User.create(db, { name: "Carol", age: 35, city: "NY", active: true });

		const active = await User.count(db, {
			where: surql`active = true`,
		});
		expect(active).toBe(2);
	});

	test("count grouped by field", async () => {
		await User.create(db, { name: "Alice", age: 30, city: "NY", active: true });
		await User.create(db, { name: "Bob", age: 25, city: "LA", active: false });
		await User.create(db, { name: "Carol", age: 35, city: "NY", active: true });

		const byCity = (await User.count(db, { by: ["city"] })) as Array<
			Record<string, unknown>
		>;

		expect(byCity).toHaveLength(2);
		const ny = byCity.find((row) => row.city === "NY");
		const la = byCity.find((row) => row.city === "LA");
		expect(ny?.count).toBe(2);
		expect(la?.count).toBe(1);
	});

	test("updateMany updates all matching records", async () => {
		await User.create(db, { name: "Alice", age: 30, city: "LA", active: false });
		await User.create(db, { name: "Bob", age: 25, city: "LA", active: false });
		await User.create(db, { name: "Carol", age: 35, city: "NY", active: false });

		const updated = await User.updateMany(db, {
			where: surql`city = ${"LA"}`,
			data: { active: true },
			mode: "merge",
		});

		expect(updated).toHaveLength(2);
		expect(updated.every((u) => u.active)).toBe(true);

		const laUsers = await User.select(db, {
			where: surql`city = ${"LA"}`,
		});
		expect(laUsers).toHaveLength(2);
		expect(laUsers.every((u) => u.active)).toBe(true);

		const nyUsers = await User.select(db, {
			where: surql`city = ${"NY"}`,
		});
		expect(nyUsers[0]?.active).toBe(false);
	});

	test("deleteMany removes all matching records", async () => {
		await User.create(db, { name: "Alice", age: 30, city: "NY", active: true });
		await User.create(db, { name: "Bob", age: 25, city: "LA", active: false });
		await User.create(db, { name: "Carol", age: 35, city: "NY", active: true });

		await User.deleteMany(db, { where: surql`active = false` });

		const total = await User.count(db);
		expect(total).toBe(2);

		const remaining = await User.select(db, { orderBy: [{ field: "name", order: "ASC" }] });
		expect(remaining.map((u) => u.name)).toEqual(["Alice", "Carol"]);
	});
});
