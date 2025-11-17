// Tests for Field.number and its options

import { test, describe, expect, beforeAll, afterAll } from "bun:test";
import { Field, Table, applySchema, generateFullSchemaQl } from "../../src";
import { setupInMemoryDb, teardownDb } from "../utils/dbTestUtils";
import { surql, type Surreal } from "surrealdb";

let db: Surreal;

beforeAll(async () => {
	db = await setupInMemoryDb("number_test", "number_test");
});
afterAll(async () => {
	await teardownDb(db);
});

describe("Field.number - basic", () => {
	class NumberModel extends Table.normal({
		name: "number_model",
		fields: {
			score: Field.number({ default: surql`10` }),
			count: Field.number(),
		},
		schemafull: true,
	}) {}

	test("should generate and apply SurrealQL for number fields", async () => {
		const ddl = generateFullSchemaQl([NumberModel]);
		expect(ddl).toContain(
			"DEFINE FIELD score ON TABLE number_model TYPE number DEFAULT 10",
		);
		expect(ddl).toContain(
			"DEFINE FIELD count ON TABLE number_model TYPE number",
		);
		await applySchema(db, [NumberModel]);
	});

	test("should create record with default value", async () => {
		const record = await NumberModel.create(db, { count: 5 });
		expect(record.score).toBe(10);
		expect(record.count).toBe(5);
	});

	test("should allow setting number", async () => {
		const record = await NumberModel.create(db, { score: 42, count: 7 });
		expect(record.score).toBe(42);
		expect(record.count).toBe(7);
	});
});

describe("Field.number - optional", () => {
	class OptionalNumberModel extends Table.normal({
		name: "optional_number_model",
		fields: {
			value: Field.option(Field.number()),
		},
		schemafull: true,
	}) {}

	test("should generate and apply SurrealQL for optional number", async () => {
		const ddl = generateFullSchemaQl([OptionalNumberModel]);
		expect(ddl).toContain(
			"DEFINE FIELD value ON TABLE optional_number_model TYPE option<number>",
		);
		await applySchema(db, [OptionalNumberModel]);
	});

	test("should allow omitting optional number field", async () => {
		const record = await OptionalNumberModel.create(db, {});
		expect(record.value).toBeUndefined();
	});

	test("should allow setting optional number to undefined", async () => {
		const record = await OptionalNumberModel.create(db, { value: undefined });
		expect(record.value).toBeUndefined();
	});

	test("should allow setting optional number", async () => {
		const record = await OptionalNumberModel.create(db, { value: 123 });
		expect(record.value).toBe(123);
	});
});

describe("Field.number - negative cases", () => {
	class StrictNumberModel extends Table.normal({
		name: "strict_number_model",
		fields: { val: Field.number() },
		schemafull: true,
	}) {}

	test("should generate and apply SurrealQL for strict number", async () => {
		const ddl = generateFullSchemaQl([StrictNumberModel]);
		expect(ddl).toContain(
			"DEFINE FIELD val ON TABLE strict_number_model TYPE number",
		);
		await applySchema(db, [StrictNumberModel]);
	});

	test("should throw when creating with non-number value", async () => {
		let error: unknown;
		try {
			// @ts-expect-error
			await StrictNumberModel.create(db, { val: "notanumber" });
		} catch (e) {
			error = e;
		}
		expect(error).toBeTruthy();
	});

	// Range and assert constraints can be tested here if supported by the ORM
	// For example, if Field.number supports assert: (v) => v > 0
	// Otherwise, skip range/required tests if not enforced in core
});
