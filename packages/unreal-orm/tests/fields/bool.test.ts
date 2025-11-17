// Tests for Field.bool and its options

import { test, describe, expect, beforeAll, afterAll } from "bun:test";
import { Field, Table, applySchema, generateFullSchemaQl } from "../../src";
import { setupInMemoryDb, teardownDb } from "../utils/dbTestUtils";
import { surql, type Surreal } from "surrealdb";

let db: Surreal;

beforeAll(async () => {
	db = await setupInMemoryDb("bool_test", "bool_test");
});
afterAll(async () => {
	await teardownDb(db);
});

describe("Field.bool - basic", () => {
	class BoolModel extends Table.normal({
		name: "bool_model",
		fields: {
			isActive: Field.bool({ default: surql`true` }),
			isDeleted: Field.bool(),
		},
		schemafull: true,
	}) {}

	test("should generate and apply SurrealQL for boolean fields", async () => {
		const ddl = generateFullSchemaQl([BoolModel]);
		expect(ddl).toContain(
			"DEFINE FIELD isActive ON TABLE bool_model TYPE bool DEFAULT true",
		);
		expect(ddl).toContain(
			"DEFINE FIELD isDeleted ON TABLE bool_model TYPE bool",
		);
		await applySchema(db, [BoolModel]);
	});

	test("should create record with default true value", async () => {
		const record = await BoolModel.create(db, { isDeleted: false });
		expect(record.isActive).toBe(true);
		expect(record.isDeleted).toBe(false);
	});

	test("should allow setting both true and false", async () => {
		const r1 = await BoolModel.create(db, {
			isActive: false,
			isDeleted: false,
		});
		expect(r1.isActive).toBe(false);
		expect(r1.isDeleted).toBe(false);
		const r2 = await BoolModel.create(db, { isActive: true, isDeleted: true });
		expect(r2.isActive).toBe(true);
		expect(r2.isDeleted).toBe(true);
	});
});

describe("Field.bool - optional", () => {
	class OptionalBoolModel extends Table.normal({
		name: "optional_bool_model",
		fields: {
			flag: Field.option(Field.bool()),
		},
		schemafull: true,
	}) {}

	test("should generate and apply SurrealQL for optional boolean", async () => {
		const ddl = generateFullSchemaQl([OptionalBoolModel]);
		expect(ddl).toContain(
			"DEFINE FIELD flag ON TABLE optional_bool_model TYPE option<bool>",
		);
		await applySchema(db, [OptionalBoolModel]);
	});

	test("should allow omitting optional boolean field", async () => {
		const record = await OptionalBoolModel.create(db, {});
		expect(record.flag).toBeUndefined();
	});

	test("should allow setting optional boolean to undefined", async () => {
		const record = await OptionalBoolModel.create(db, { flag: undefined });
		expect(record.flag).toBeUndefined();
	});

	test("should allow setting optional boolean to true/false", async () => {
		const r1 = await OptionalBoolModel.create(db, { flag: true });
		expect(r1.flag).toBe(true);
		const r2 = await OptionalBoolModel.create(db, { flag: false });
		expect(r2.flag).toBe(false);
	});
});

describe("Field.bool - negative cases", () => {
	class StrictBoolModel extends Table.normal({
		name: "strict_bool_model",
		fields: { flag: Field.bool() },
		schemafull: true,
	}) {}

	test("should generate and apply SurrealQL for strict boolean", async () => {
		const ddl = generateFullSchemaQl([StrictBoolModel]);
		expect(ddl).toContain(
			"DEFINE FIELD flag ON TABLE strict_bool_model TYPE bool",
		);
		await applySchema(db, [StrictBoolModel]);
	});

	test("should throw when creating with non-boolean value", async () => {
		expect(
			// @ts-expect-error
			StrictBoolModel.create(db, { flag: "notabool" }),
		).rejects.toThrow();
	});
});
