import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { RecordId } from "surrealdb";
import { Table, Field, applySchema } from "../../src";
import { setupInMemoryDb, teardownDb } from "../utils/dbTestUtils";
import type { Surreal } from "surrealdb";

describe("Explicit DB required", () => {
	let db: Surreal;

	const User = Table.normal({
		name: "user",
		fields: {
			name: Field.string(),
			email: Field.string(),
			age: Field.number(),
		},
	});

	beforeAll(async () => {
		db = await setupInMemoryDb();
		await applySchema(db, [User]);
	});

	afterAll(() => teardownDb(db));

	it("should throw 'db is required' when calling select() without db", async () => {
		await expect(User.select()).rejects.toThrow("db is required");
	});

	it("should throw 'db is required' when calling create() without db", async () => {
		await expect(
			User.create({ name: "John", email: "john@example.com", age: 30 }),
		).rejects.toThrow("db is required");
	});

	it("should throw 'db is required' when calling insert() without db", async () => {
		await expect(
			User.insert({ data: { name: "John", email: "john@example.com", age: 30 } }),
		).rejects.toThrow("db is required");
	});

	it("should throw 'db is required' when calling update() without db", async () => {
		await expect(
			User.update(new RecordId("user", "x"), { data: { age: 31 }, mode: "merge" }),
		).rejects.toThrow("db is required");
	});

	it("should throw 'db is required' when calling delete() without db", async () => {
		await expect(User.delete(new RecordId("user", "x"))).rejects.toThrow("db is required");
	});

	it("should throw 'db is required' when calling count() without db", async () => {
		await expect(User.count()).rejects.toThrow("db is required");
	});

	it("should throw 'db is required' when calling updateMany() without db", async () => {
		await expect(
			User.updateMany({
				where: "active = false",
				data: { active: true },
				mode: "merge",
			}),
		).rejects.toThrow("db is required");
	});

	it("should throw 'db is required' when calling deleteMany() without db", async () => {
		await expect(User.deleteMany({ where: "active = false" })).rejects.toThrow("db is required");
	});

	it("should throw 'db is required' when calling instance update() without db", async () => {
		const user = await User.create(db, {
			name: "Instance",
			email: "instance@example.com",
			age: 20,
		});
		await expect(
			user.update({ data: { age: 21 }, mode: "merge" }),
		).rejects.toThrow("db is required");
	});

	it("should throw 'db is required' when calling instance delete() without db", async () => {
		const user = await User.create(db, {
			name: "Instance2",
			email: "instance2@example.com",
			age: 20,
		});
		await expect(user.delete()).rejects.toThrow("db is required");
	});
});
