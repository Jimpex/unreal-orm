// Tests for SurrealDB transaction support with feature flag checking

import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { Field, Table, applySchema } from "../../src";
import { setupInMemoryDb, teardownDb } from "../utils/dbTestUtils";
import { Features, RecordId, surql, type Surreal } from "surrealdb";

let db: Surreal;

beforeAll(async () => {
	db = await setupInMemoryDb("transactions", "transactions");
});

afterAll(async () => {
	await teardownDb(db);
});

// Only run transaction tests if supported
describe("transactions", () => {
	class Person extends Table.normal({
		name: "person",
		fields: {
			name: Field.string(),
			email: Field.string(),
		},
		schemafull: true,
	}) {}

	test("transaction support check", async () => {
		const isSupported = db.isFeatureSupported(Features.Transactions);
		if (!isSupported) {
			console.log(
				"Skipping transaction tests - not supported by this SurrealDB version",
			);
			return;
		}
		expect(isSupported).toBe(true);
	});

	test("apply schema", async () => {
		await applySchema(db, [Person], "OVERWRITE");
	});

	test("committed transaction with ORM", async () => {
		// Skip if transactions not supported
		if (!db.isFeatureSupported(Features.Transactions)) {
			console.warn("Skipping test - client-side transactions not supported");
			return;
		}

		// Start transaction
		const txn = await db.beginTransaction();

		// Create record within transaction
		const created = await Person.create(txn, {
			name: "John Doe",
			email: "john@example.com",
		});

		expect(created.name).toBe("John Doe");
		expect(created.email).toBe("john@example.com");

		// Record should not be visible outside transaction yet
		let selected = await Person.select(db, { from: created.id, only: true });
		expect(selected).toBeUndefined();

		// Commit transaction
		await txn.commit();

		// Now record should be visible
		selected = await Person.select(db, { from: created.id, only: true });
		expect(selected?.name).toBe("John Doe");
		expect(selected?.email).toBe("john@example.com");
	});

	test("cancelled transaction with ORM", async () => {
		// Skip if transactions not supported
		if (!db.isFeatureSupported(Features.Transactions)) {
			console.log("Skipping test - transactions not supported");
			return;
		}

		// Start transaction
		const txn = await db.beginTransaction();

		// Create record within transaction
		const created = await Person.create(txn, {
			name: "Jane Doe",
			email: "jane@example.com",
		});

		expect(created.name).toBe("Jane Doe");
		expect(created.email).toBe("jane@example.com");

		// Record should not be visible outside transaction
		let selected = await Person.select(db, { from: created.id, only: true });
		expect(selected).toBeUndefined();

		// Cancel transaction
		await txn.cancel();

		// Record should still not be visible
		selected = await Person.select(db, { from: created.id, only: true });
		expect(selected).toBeUndefined();
	});

	test("update within transaction", async () => {
		// Skip if transactions not supported
		if (!db.isFeatureSupported(Features.Transactions)) {
			console.log("Skipping test - transactions not supported");
			return;
		}

		// Create initial record
		const person = await Person.create(db, {
			name: "Alice",
			email: "alice@example.com",
		});

		// Start transaction
		const txn = await db.beginTransaction();

		// Update within transaction
		const updated = await person.update(txn, {
			mode: "merge",
			data: { name: "Alice Smith" },
		});

		expect(updated.name).toBe("Alice Smith");

		// Original record should be unchanged outside transaction
		let selected = await Person.select(db, { from: person.id, only: true });
		expect(selected?.name).toBe("Alice");

		// Commit transaction
		await txn.commit();

		// Now record should be updated
		selected = await Person.select(db, { from: person.id, only: true });
		expect(selected?.name).toBe("Alice Smith");
	});

	test("delete within transaction", async () => {
		// Skip if transactions not supported
		if (!db.isFeatureSupported(Features.Transactions)) {
			console.log("Skipping test - transactions not supported");
			return;
		}

		// Create initial record
		const person = await Person.create(db, {
			name: "Bob",
			email: "bob@example.com",
		});

		// Start transaction
		const txn = await db.beginTransaction();

		// Delete within transaction
		await person.delete(txn);

		// Record should still exist outside transaction
		let selected = await Person.select(db, { from: person.id, only: true });
		expect(selected).toBeDefined();

		// Commit transaction
		await txn.commit();

		// Now record should be deleted
		selected = await Person.select(db, { from: person.id, only: true });
		expect(selected).toBeUndefined();
	});

	test("query within transaction", async () => {
		// Skip if transactions not supported
		if (!db.isFeatureSupported(Features.Transactions)) {
			console.log("Skipping test - transactions not supported");
			return;
		}

		// Create initial records
		await Person.create(db, { name: "Charlie", email: "charlie@example.com" });
		await Person.create(db, { name: "Diana", email: "diana@example.com" });

		// Start transaction
		const txn = await db.beginTransaction();

		// Create additional record within transaction
		await Person.create(txn, { name: "Eve", email: "eve@example.com" });

		// Query within transaction should see all records
		const txnResults = await Person.select(txn);
		expect(txnResults).toHaveLength(3);

		// Query outside transaction should only see original records
		const dbResults = await Person.select(db);
		expect(dbResults).toHaveLength(2);

		// Commit transaction
		await txn.commit();

		// Now both should see all records
		const finalResults = await Person.select(db);
		expect(finalResults).toHaveLength(3);
	});
});

describe("transaction compatibility", () => {
	test("should handle non-transactional databases gracefully", async () => {
		// This test ensures the ORM works with databases that don't support transactions
		// It should always pass, even when transactions aren't supported

		class SimpleUser extends Table.normal({
			name: "simple_user",
			fields: {
				name: Field.string(),
			},
			schemafull: true,
		}) {}

		await applySchema(db, [SimpleUser], "OVERWRITE");

		// Regular operations should work
		const user = await SimpleUser.create(db, { name: "Test User" });
		expect(user.name).toBe("Test User");

		const selected = await SimpleUser.select(db, { from: user.id, only: true });
		expect(selected?.name).toBe("Test User");
	});
});
