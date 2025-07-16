// Tests for Field.object and flexible/custom fields

import { test, describe, expect, beforeAll, afterAll } from "bun:test";
import { Field, Table, applySchema, generateFullSchemaQl } from "../../src";
import { setupInMemoryDb, teardownDb } from "../utils/dbTestUtils";
import type { Surreal } from "surrealdb";

let db: Surreal;

beforeAll(async () => {
	db = await setupInMemoryDb("object_test", "object_test");
});
afterAll(async () => {
	await teardownDb(db);
});

describe("Field.object - basic", () => {
	class ProfileModel extends Table.normal({
		name: "profile_model",
		fields: {
			profile: Field.object({
				displayName: Field.string(),
				age: Field.number(),
				verified: Field.bool({ default: "false" }),
			}),
		},
		schemafull: true,
	}) {}

	test("should generate and apply SurrealQL for object field", async () => {
		const ddl = generateFullSchemaQl([ProfileModel]);
		expect(ddl).toContain(
			"DEFINE FIELD profile ON TABLE profile_model TYPE object",
		);
		await applySchema(db, [ProfileModel]);
	});

	test("should create and fetch a record with nested object field", async () => {
		const data = {
			profile: { displayName: "Alice", age: 30, verified: false },
		};
		const record = await ProfileModel.create(db, data);
		expect(record.profile.displayName).toBe("Alice");
		expect(record.profile.age).toBe(30);
		expect(record.profile.verified).toBe(false);
		const fetched = await ProfileModel.select(db, {
			from: record.id,
			only: true,
		});
		expect(fetched?.profile.displayName).toBe("Alice");
		expect(fetched?.profile.age).toBe(30);
		expect(fetched?.profile.verified).toBe(false);
	});
});

describe("Field.object - optional", () => {
	class OptionalObjModel extends Table.normal({
		name: "optional_obj_model",
		fields: {
			meta: Field.option(Field.object({ foo: Field.string() })),
		},
		schemafull: true,
	}) {}

	test("should generate and apply SurrealQL for optional object", async () => {
		const ddl = generateFullSchemaQl([OptionalObjModel]);
		expect(ddl).toContain(
			"DEFINE FIELD meta ON TABLE optional_obj_model TYPE option<object>",
		);
		await applySchema(db, [OptionalObjModel]);
	});

	test("should allow omitting optional object field", async () => {
		const record = await OptionalObjModel.create(db, {});
		expect(record.meta).toBeUndefined();
	});

	test("should allow setting optional object to undefined", async () => {
		const record = await OptionalObjModel.create(db, { meta: undefined });
		expect(record.meta).toBeUndefined();
	});

	test("should allow setting optional object", async () => {
		const record = await OptionalObjModel.create(db, { meta: { foo: "bar" } });
		console.log(record);
		expect(record.meta?.foo).toBe("bar");
	});
});

describe("Field.object - nested array and record", () => {
	class User extends Table.normal({
		name: "user_obj",
		fields: { name: Field.string() },
		schemafull: true,
	}) {}
	class ComplexModel extends Table.normal({
		name: "complex_obj_model",
		fields: {
			data: Field.object({
				tags: Field.array(Field.string()),
				owner: Field.record(() => User),
			}),
		},
		schemafull: true,
	}) {}

	test("should generate and apply SurrealQL for nested object field", async () => {
		const ddl = generateFullSchemaQl([ComplexModel]);
		expect(ddl).toContain(
			"DEFINE FIELD data ON TABLE complex_obj_model TYPE object",
		);
		await applySchema(db, [User, ComplexModel]);
	});

	test("should store and retrieve object with nested array and record", async () => {
		const user = await User.create(db, { name: "Bob" });
		const data = { data: { tags: ["a", "b"], owner: user.id } };
		const record = await ComplexModel.create(db, data);
		expect(record.data.tags).toEqual(["a", "b"]);
		expect(record.data.owner.toString()).toBe(user.id.toString());
		const fetched = await ComplexModel.select(db, {
			from: record.id,
			only: true,
			fetch: ["data.owner"],
		});
		expect(fetched?.data.tags).toEqual(["a", "b"]);
		expect(fetched?.data.owner).toBeInstanceOf(User);
		expect((fetched?.data.owner as User).name).toBe("Bob");
	});
});

describe("Field.object - negative cases", () => {
	class StrictObjModel extends Table.normal({
		name: "strict_obj_model",
		fields: { meta: Field.object({ foo: Field.string() }) },
		schemafull: true,
	}) {}

	test("should generate and apply SurrealQL for strict object", async () => {
		const ddl = generateFullSchemaQl([StrictObjModel]);
		expect(ddl).toContain(
			"DEFINE FIELD meta ON TABLE strict_obj_model TYPE object",
		);
		await applySchema(db, [StrictObjModel]);
	});

	test("should throw when creating with non-object value", async () => {
		// @ts-expect-error
		expect(StrictObjModel.create(db, { meta: 123 })).rejects.toThrow();
	});
});
