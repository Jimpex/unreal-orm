import {
	describe,
	it,
	expect,
	beforeAll,
	afterAll,
	beforeEach,
} from "bun:test";
import {
	Table,
	Field,
	applySchema,
	configure,
	clearConfig,
	getDatabase,
	hasDatabase,
	isSurrealLike,
} from "../../src";
import { setupInMemoryDb, teardownDb } from "../utils/dbTestUtils";
import type { Surreal } from "surrealdb";

describe("Implicit Database Configuration", () => {
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

	beforeEach(() => {
		// Clear config before each test to ensure isolation
		clearConfig();
	});

	describe("configure() and clearConfig()", () => {
		it("should configure with a database instance", () => {
			expect(hasDatabase()).toBe(false);
			configure({ database: db });
			expect(hasDatabase()).toBe(true);
		});

		it("should configure with a factory function", () => {
			expect(hasDatabase()).toBe(false);
			configure({ getDatabase: () => db });
			expect(hasDatabase()).toBe(true);
		});

		it("should configure with an async factory function", () => {
			expect(hasDatabase()).toBe(false);
			configure({
				getDatabase: async () => {
					// Simulate async connection
					return db;
				},
			});
			expect(hasDatabase()).toBe(true);
		});

		it("should clear configuration", () => {
			configure({ database: db });
			expect(hasDatabase()).toBe(true);
			clearConfig();
			expect(hasDatabase()).toBe(false);
		});
	});

	describe("getDatabase()", () => {
		it("should return configured database instance", async () => {
			configure({ database: db });
			const result = await getDatabase();
			expect(result).toBe(db);
		});

		it("should call factory and cache result", async () => {
			let callCount = 0;
			configure({
				getDatabase: () => {
					callCount++;
					return db;
				},
			});

			// First call should invoke factory
			const result1 = await getDatabase();
			expect(result1).toBe(db);
			expect(callCount).toBe(1);

			// Second call should use cached value
			const result2 = await getDatabase();
			expect(result2).toBe(db);
			expect(callCount).toBe(1); // Still 1, not 2
		});

		it("should throw error when no database configured", async () => {
			expect(getDatabase()).rejects.toThrow("No database configured");
		});
	});

	describe("isSurrealLike()", () => {
		it("should return true for Surreal instance", () => {
			expect(isSurrealLike(db)).toBe(true);
		});

		it("should return false for null/undefined", () => {
			expect(isSurrealLike(null)).toBe(false);
			expect(isSurrealLike(undefined)).toBe(false);
		});

		it("should return false for plain objects", () => {
			expect(isSurrealLike({})).toBe(false);
			expect(isSurrealLike({ name: "test" })).toBe(false);
		});

		it("should return false for options-like objects", () => {
			// This is important - options objects should not be confused with db
			expect(isSurrealLike({ limit: 10 })).toBe(false);
			expect(isSurrealLike({ where: "x = 1" })).toBe(false);
			expect(isSurrealLike({ name: "John", email: "john@example.com" })).toBe(
				false,
			);
		});

		it("should return true for duck-typed SurrealLike", () => {
			const fakeSurreal = {
				query: () => {},
				select: () => {},
				create: () => {},
				update: () => {},
				delete: () => {},
			};
			expect(isSurrealLike(fakeSurreal)).toBe(true);
		});
	});

	describe("Implicit CRUD - No Config Error", () => {
		it("should throw when calling select() without config", async () => {
			expect(User.select()).rejects.toThrow("No database configured");
		});

		it("should throw when calling select(options) without config", async () => {
			expect(User.select({ limit: 10 })).rejects.toThrow(
				"No database configured",
			);
		});

		it("should throw when calling create() without config", async () => {
			expect(
				User.create({ name: "John", email: "john@example.com", age: 30 }),
			).rejects.toThrow("No database configured");
		});
	});

	describe("Implicit CRUD - With Config", () => {
		beforeEach(() => {
			configure({ database: db });
		});

		it("should select() without explicit db", async () => {
			const users = await User.select();
			expect(Array.isArray(users)).toBe(true);
		});

		it("should select(options) without explicit db", async () => {
			const users = await User.select({ limit: 5 });
			expect(Array.isArray(users)).toBe(true);
		});

		it("should create() without explicit db", async () => {
			const user = await User.create({
				name: "Implicit User",
				email: "implicit@example.com",
				age: 25,
			});
			expect(user).toBeInstanceOf(User);
			expect(user.name).toBe("Implicit User");
		});

		it("should still work with explicit db when configured", async () => {
			// Explicit db should always work, even when config is set
			const users = await User.select(db, { limit: 5 });
			expect(Array.isArray(users)).toBe(true);
		});
	});

	describe("Explicit vs Implicit - Both Patterns", () => {
		it("should distinguish between select(db) and select(options)", async () => {
			configure({ database: db });

			// Both should work
			const result1 = await User.select(db);
			const result2 = await User.select();

			expect(Array.isArray(result1)).toBe(true);
			expect(Array.isArray(result2)).toBe(true);
		});

		it("should distinguish between select(db, options) and select(options)", async () => {
			configure({ database: db });

			// Both should work
			const result1 = await User.select(db, { limit: 5 });
			const result2 = await User.select({ limit: 5 });

			expect(Array.isArray(result1)).toBe(true);
			expect(Array.isArray(result2)).toBe(true);
		});
	});

	describe("Instance Methods - Implicit DB", () => {
		beforeEach(() => {
			configure({ database: db });
		});

		it("should update() instance without explicit db", async () => {
			const user = await User.create({
				name: "Update Test",
				email: "update@example.com",
				age: 20,
			});

			// Update without explicit db
			const updated = await user.update({
				data: { age: 21 },
				mode: "merge",
			});

			expect(updated.age).toBe(21);
		});

		it("should delete() instance without explicit db", async () => {
			const user = await User.create({
				name: "Delete Test",
				email: "delete@example.com",
				age: 30,
			});

			// Delete without explicit db
			await user.delete();

			// Verify deleted
			const found = await User.select({
				from: user.id,
				only: true,
			});
			expect(found).toBeUndefined();
		});
	});

	describe("configure({ getDatabase }) - Factory Pattern", () => {
		it("should work with sync factory for all CRUD operations", async () => {
			configure({ getDatabase: () => db });

			// Create
			const user = await User.create({
				name: "Factory Sync",
				email: "factory-sync@example.com",
				age: 35,
			});
			expect(user.name).toBe("Factory Sync");

			// Select
			const found = await User.select({ from: user.id, only: true });
			expect(found?.email).toBe("factory-sync@example.com");

			// Update
			const updated = await user.update({
				data: { age: 36 },
				mode: "merge",
			});
			expect(updated.age).toBe(36);

			// Delete
			await user.delete();
			const deleted = await User.select({ from: user.id, only: true });
			expect(deleted).toBeUndefined();
		});

		it("should work with async factory for all CRUD operations", async () => {
			configure({
				getDatabase: async () => {
					// Simulate async connection delay
					await new Promise((resolve) => setTimeout(resolve, 10));
					return db;
				},
			});

			// Create
			const user = await User.create({
				name: "Factory Async",
				email: "factory-async@example.com",
				age: 40,
			});
			expect(user.name).toBe("Factory Async");

			// Select
			const found = await User.select({ from: user.id, only: true });
			expect(found?.email).toBe("factory-async@example.com");

			// Update
			const updated = await user.update({
				data: { age: 41 },
				mode: "merge",
			});
			expect(updated.age).toBe(41);

			// Delete
			await user.delete();
		});

		it("should cache factory result across multiple operations", async () => {
			let factoryCalls = 0;
			configure({
				getDatabase: () => {
					factoryCalls++;
					return db;
				},
			});

			// Multiple operations should only call factory once
			await User.create({ name: "Cache1", email: "cache1@test.com", age: 1 });
			await User.select({ limit: 1 });
			await User.select();

			expect(factoryCalls).toBe(1);
		});
	});

	describe("Full CRUD Workflow - Implicit DB", () => {
		beforeEach(() => {
			configure({ database: db });
		});

		it("should perform complete CRUD cycle without explicit db", async () => {
			// CREATE
			const created = await User.create({
				name: "CRUD Test",
				email: "crud@example.com",
				age: 25,
			});
			expect(created).toBeInstanceOf(User);
			expect(created.id).toBeDefined();

			// READ (select by id)
			const read = await User.select({ from: created.id, only: true });
			expect(read).toBeDefined();
			expect(read?.name).toBe("CRUD Test");

			// UPDATE (instance method)
			const updated = await created.update({
				data: { name: "CRUD Updated", age: 26 },
				mode: "merge",
			});
			expect(updated.name).toBe("CRUD Updated");
			expect(updated.age).toBe(26);

			// Verify update persisted
			const verified = await User.select({ from: created.id, only: true });
			expect(verified?.name).toBe("CRUD Updated");

			// DELETE (instance method)
			await created.delete();

			// Verify deletion
			const deleted = await User.select({ from: created.id, only: true });
			expect(deleted).toBeUndefined();
		});

		it("should handle multiple records with implicit db", async () => {
			// Create multiple users
			const user1 = await User.create({
				name: "Multi1",
				email: "multi1@test.com",
				age: 20,
			});
			const user2 = await User.create({
				name: "Multi2",
				email: "multi2@test.com",
				age: 30,
			});

			// Select all
			const all = await User.select();
			expect(all.length).toBeGreaterThanOrEqual(2);

			// Select with filter
			const filtered = await User.select({ limit: 10 });
			expect(Array.isArray(filtered)).toBe(true);

			// Cleanup
			await user1.delete();
			await user2.delete();
		});
	});
});
