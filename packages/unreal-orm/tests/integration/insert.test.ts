import { test, describe, expect, beforeAll, afterAll } from "bun:test";
import { Field, Table, applySchema } from "../../src";
import { setupInMemoryDb, teardownDb } from "../utils/dbTestUtils";
import type { Surreal } from "surrealdb";
import { surql } from "surrealdb";

let db: Surreal;

beforeAll(async () => {
	db = await setupInMemoryDb("insert_test", "insert_test");
});
afterAll(async () => {
	await teardownDb(db);
});

describe("INSERT statement integration", () => {
	class User extends Table.normal({
		name: "user_insert",
		fields: {
			name: Field.string(),
			email: Field.string(),
			visits: Field.number({ default: surql`0` }),
		},
		schemafull: true,
	}) {}

	test("apply schema", async () => {
		await applySchema(db, [User]);
	});

	test("basic single insert", async () => {
		const user = await User.insert(db, {
			data: { name: "Alice", email: "alice@example.com" },
		});
		expect(user).toBeTruthy();
		expect(user?.name).toBe("Alice");
		expect(user?.email).toBe("alice@example.com");
		expect(user?.id.toString()).toMatch(/^user_insert:/);
	});

	test("bulk insert", async () => {
		const users = await User.insert(db, {
			data: [
				{ name: "Bob", email: "bob@example.com" },
				{ name: "Carol", email: "carol@example.com" },
				{ name: "David", email: "david@example.com" },
			],
		});
		expect(Array.isArray(users)).toBe(true);
		expect(users.length).toBe(3);
		expect(users[0]?.name).toBe("Bob");
		expect(users[1]?.name).toBe("Carol");
		expect(users[2]?.name).toBe("David");
	});

	test("insert with RETURN NONE", async () => {
		const result = await User.insert(db, {
			data: { name: "Eve", email: "eve@example.com" },
			return: "NONE",
		});
		expect(result).toBeUndefined();

		// Verify the record was actually created
		const eve = await User.select(db, {
			where: surql`name = "Eve"`,
		});
		expect(eve.length).toBe(1);
	});

	test("insert with IGNORE (skip duplicates)", async () => {
		// First insert a user with a specific ID
		const [first] = await User.insert(db, {
			data: [{ name: "Frank", email: "frank@example.com" }],
		});
		expect(first).toBeTruthy();

		const frankId = first.id;

		// Try to insert the same ID again with IGNORE - should not throw
		const result = await User.insert(db, {
			data: {
				id: frankId,
				name: "Frank Updated",
				email: "frank-updated@example.com",
			},
			ignore: true,
		});
		// Should return the original record since duplicate was ignored
		// Note: The result might be empty or the original record depending on SurrealDB behavior

		// Verify Frank wasn't updated
		const frankAfter = await User.select(db, { from: frankId, only: true });
		expect(frankAfter?.name).toBe("Frank"); // Original name preserved
	});

	test("insert with ON DUPLICATE KEY UPDATE", async () => {
		// Insert user
		const [grace] = await User.insert(db, {
			data: [{ name: "Grace", email: "grace@example.com", visits: 1 }],
		});
		expect(grace).toBeTruthy();

		// Insert same ID with ON DUPLICATE KEY UPDATE
		const result = await User.insert(db, {
			data: {
				id: grace.id,
				name: "Grace New",
				email: "grace-new@example.com",
				visits: 999,
			},
			onDuplicate: surql`visits += 1`,
		});

		// Check the visits were incremented
		const graceAfter = await User.select(db, { from: grace.id, only: true });
		expect(graceAfter?.visits).toBe(2); // 1 + 1 from the ON DUPLICATE KEY UPDATE
		expect(graceAfter?.name).toBe("Grace"); // Name shouldn't have changed
	});

	test("insert with RETURN specific fields", async () => {
		const result = (await User.insert(db, {
			data: { name: "Henry", email: "henry@example.com" },
			return: ["name", "email"],
		})) as { name: string; email: string };
		expect(result).toBeTruthy();
		// Result should have name and email but be raw data (not hydrated)
		expect(result?.name).toBe("Henry");
		expect(result?.email).toBe("henry@example.com");
	});

	test("insert with RETURN VALUE", async () => {
		const result = (await User.insert(db, {
			data: { name: "Ivy", email: "ivy@example.com" },
			return: { value: "name" },
		})) as unknown as string;
		// Should return only the name value
		expect(result).toBe("Ivy");
	});

	test("insert with RETURN surql expression (native)", async () => {
		// Using native SurrealQL expression for RETURN - following Native First principle
		const result = (await User.insert(db, {
			data: { name: "Jack", email: "jack@example.com" },
			return: surql`id, name, email`,
		})) as { id: unknown; name: string; email: string };
		expect(result).toBeTruthy();
		expect(result?.name).toBe("Jack");
		expect(result?.email).toBe("jack@example.com");
	});
});

describe("INSERT RELATION integration", () => {
	// Need entities for the relation first
	class Person extends Table.normal({
		name: "person_insert",
		fields: {
			name: Field.string(),
		},
		schemafull: true,
	}) {}

	// Define a relation table for testing - must have in/out fields
	class Follows extends Table.relation({
		name: "follows_insert",
		fields: {
			in: Field.record(() => Person),
			out: Field.record(() => Person),
			createdAt: Field.datetime({ default: surql`time::now()` }),
		},
		schemafull: true,
	}) {}

	test("apply relation schema", async () => {
		await applySchema(db, [Person, Follows], "OVERWRITE");
	});

	test("insert relation with in/out RecordIds", async () => {
		// Create two people first
		const alice = await Person.create(db, { name: "Alice" });
		const bob = await Person.create(db, { name: "Bob" });

		// Insert a follows relation
		const follows = await Follows.insert(db, {
			data: {
				in: alice.id,
				out: bob.id,
			},
		});

		expect(follows).toBeTruthy();
		expect(follows?.id.toString()).toMatch(/^follows_insert:/);
	});

	test("bulk insert relations", async () => {
		// Create people for relations
		const carol = await Person.create(db, { name: "Carol" });
		const dave = await Person.create(db, { name: "Dave" });
		const eve = await Person.create(db, { name: "Eve" });

		// Bulk insert relations
		const relations = await Follows.insert(db, {
			data: [
				{ in: carol.id, out: dave.id },
				{ in: carol.id, out: eve.id },
				{ in: dave.id, out: eve.id },
			],
		});

		expect(Array.isArray(relations)).toBe(true);
		expect(relations.length).toBe(3);
	});

	test("insert relation throws without in/out at runtime", async () => {
		// The type system prevents this at compile time (in/out are required)
		// But we still have runtime validation as a safety net
		// This test verifies the runtime validation works
		// biome-ignore lint/suspicious/noExplicitAny: Intentionally bypassing types to test runtime validation
		const fakeData = { createdAt: new Date() } as any;

		await expect(
			Follows.insert(db, {
				data: fakeData,
			}),
		).rejects.toThrow("Relation tables require 'in' and 'out' properties");
	});
});
