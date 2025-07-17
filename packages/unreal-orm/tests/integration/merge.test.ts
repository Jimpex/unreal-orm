import { RecordId, type Surreal } from "surrealdb";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Table, Field, applySchema } from "../../src";
import { setupInMemoryDb, teardownDb } from "../utils/dbTestUtils";

const User = Table.normal({
	name: "user",
	fields: {
		name: Field.string(),
		age: Field.number(),
		isActive: Field.bool({ default: "true" }),
	},
});

describe("Model.merge()", () => {
	let db: Surreal;

	beforeAll(async () => {
		db = await setupInMemoryDb();
		await applySchema(db, [User]);
	});

	afterAll(() => teardownDb(db));

	it("should partially update a record using the static method", async () => {
		const user = await User.create(db, { name: "John Doe", age: 30 });
		expect(user.age).toBe(30);
		expect(user.isActive).toBe(true);

		const mergedUser = await User.merge(db, user.id, { age: 31 });

		expect(mergedUser.id).toEqual(user.id);
		expect(mergedUser.name).toBe("John Doe"); // Should remain unchanged
		expect(mergedUser.age).toBe(31); // Should be updated
		expect(mergedUser.isActive).toBe(true); // Should remain unchanged
	});

	it("should partially update a record using the instance method", async () => {
		const user = await User.create(db, { name: "Jane Doe", age: 25 });
		expect(user.age).toBe(25);

		const mergedUser = await user.merge(db, { age: 26, isActive: false });

		expect(mergedUser.id).toEqual(user.id);
		expect(mergedUser.name).toBe("Jane Doe");
		expect(mergedUser.age).toBe(26);
		expect(mergedUser.isActive).toBe(false);
	});

	it("should return the merged record with all fields", async () => {
		const user = await User.create(db, { name: "Test Person", age: 50 });
		const mergedUser = await User.merge(db, user.id, { age: 51 });

		const fetchedUser = await User.select(db, { from: user.id, only: true });

		expect(mergedUser).toBeInstanceOf(User);
		expect(mergedUser.name).toBe("Test Person");
		expect(mergedUser.age).toBe(51);
		expect(fetchedUser).toEqual(mergedUser);
	});

	it("should throw when trying to merge a non-existent record", async () => {
		// MERGE in SurrealDB only updates existing records. If the record does not exist,
		// it should not create one and should return an empty result.
		const nonExistentId = new RecordId("user", "non-existent");
		const mergedData = { name: "New User", age: 1 };

		expect(User.merge(db, nonExistentId, mergedData)).rejects.toThrow();

		// Verify that no record was created
		const foundUser = await User.select(db, {
			from: nonExistentId,
			only: true,
		});
		expect(foundUser).toBeUndefined();
	});
});
