// Tests for Field.string and its options

import { test, describe, expect, beforeAll, afterAll } from "bun:test";
import { Field, Table, applySchema, generateFullSchemaQl } from "../../src";
import { setupInMemoryDb, teardownDb } from "../utils/dbTestUtils";
import type { Surreal } from "surrealdb";

let db: Surreal;

beforeAll(async () => {
	db = await setupInMemoryDb("string_test", "string_test");
});
afterAll(async () => {
	await teardownDb(db);
});

describe("Field.string - basic", () => {
	class StringModel extends Table.normal({
		name: "string_model",
		fields: {
			name: Field.string({ default: "'anon'" }),
			desc: Field.string(),
		},
		schemafull: true,
	}) {}

	test("should generate and apply SurrealQL for string fields", async () => {
		const ddl = generateFullSchemaQl([StringModel]);
		expect(ddl).toContain(
			"DEFINE FIELD name ON TABLE string_model TYPE string DEFAULT 'anon'",
		);
		expect(ddl).toContain(
			"DEFINE FIELD desc ON TABLE string_model TYPE string",
		);
		await applySchema(db, [StringModel]);
	});

	test("should create record with default value", async () => {
		const record = await StringModel.create(db, { desc: "A" });

		expect(record.name).toBe("anon");
		expect(record.desc).toBe("A");
	});
});

describe("Field.string - optional", () => {
	class OptionalStringModel extends Table.normal({
		name: "optional_string_model",
		fields: {
			tag: Field.option(Field.string()),
		},
		schemafull: true,
	}) {}

	test("should generate and apply SurrealQL for optional string", async () => {
		const ddl = generateFullSchemaQl([OptionalStringModel]);
		expect(ddl).toContain(
			"DEFINE FIELD tag ON TABLE optional_string_model TYPE option<string>",
		);
		await applySchema(db, [OptionalStringModel]);
	});

	test("should allow omitting optional string field", async () => {
		const record = await OptionalStringModel.create(db, {});
		expect(record.tag).toBeUndefined();
	});

	test("should allow setting optional string to undefined", async () => {
		const record = await OptionalStringModel.create(db, { tag: undefined });
		expect(record.tag).toBeUndefined();
	});

	test("should allow setting optional string", async () => {
		const record = await OptionalStringModel.create(db, { tag: "foo" });
		expect(record.tag).toBe("foo");
	});
});

describe("Field.string - negative cases", () => {
	class StrictStringModel extends Table.normal({
		name: "strict_string_model",
		fields: { val: Field.string() },
		schemafull: true,
	}) {}

	test("should generate and apply SurrealQL schema", async () => {
		const ddl = generateFullSchemaQl([StrictStringModel]);
		expect(ddl).toContain(
			"DEFINE FIELD val ON TABLE strict_string_model TYPE string",
		);
		await applySchema(db, [StrictStringModel]);
	});

	test("should throw when creating with non-string value", async () => {
		// @ts-expect-error
		expect(StrictStringModel.create(db, { val: 123 })).rejects.toThrow();
	});

	// TODO: re-implement when types are updated to require "required" fields
	//   test("should throw when required string is missing", async () => {
	//     let error: unknown;
	//     try {
	//       // @ts-expect-error
	//       await StrictStringModel.create(db, {});
	//     } catch (e) {
	//       error = e;
	//     }
	//     expect(error).toBeTruthy();
	//   });
});
