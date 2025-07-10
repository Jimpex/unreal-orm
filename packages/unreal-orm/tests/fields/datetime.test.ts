// Tests for Field.datetime and its options

import { test, describe, expect, beforeAll, afterAll } from "bun:test";
import { Field } from "../../src/fields";
import Table from "../../src/define";
import { applySchema, generateTableSchemaQl } from "../../src/schemaGenerator";
import { setupInMemoryDb, teardownDb } from "../utils/dbTestUtils";
import type { Surreal } from "surrealdb";

let db: Surreal;

beforeAll(async () => {
	db = await setupInMemoryDb("datetime_test", "datetime_test");
});
afterAll(async () => {
	await teardownDb(db);
});

describe("Field.datetime - basic", () => {
	class DateTimeModel extends Table.normal({
		name: "datetime_model",
		fields: {
			created: Field.datetime(),
			updated: Field.datetime(),
		},
		schemafull: true,
	}) {}

	test("should generate and apply SurrealQL for datetime fields", async () => {
		const ddl = generateTableSchemaQl(DateTimeModel);
		expect(ddl).toContain(
			"DEFINE FIELD created ON TABLE datetime_model TYPE datetime",
		);
		expect(ddl).toContain(
			"DEFINE FIELD updated ON TABLE datetime_model TYPE datetime",
		);
		await applySchema(db, [DateTimeModel]);
	});

	test("should create record with Date object", async () => {
		const now = new Date();
		const record = await DateTimeModel.create(db, {
			created: now,
			updated: now,
		});
		expect(record.created.toString()).toBe(now.toString());
		expect(record.updated.toString()).toBe(now.toString());
	});

	test("should create record with ISO string", async () => {
		const iso = new Date();
		const record = await DateTimeModel.create(db, {
			created: iso,
			updated: iso,
		});
		expect(record.created.toString()).toBe(iso.toString());
		expect(record.updated.toString()).toBe(iso.toString());
	});
});

describe("Field.datetime - optional", () => {
	class OptionalDateTimeModel extends Table.normal({
		name: "optional_datetime_model",
		fields: {
			expires: Field.option(Field.datetime()),
		},
		schemafull: true,
	}) {}

	test("should generate and apply SurrealQL for optional datetime", async () => {
		const ddl = generateTableSchemaQl(OptionalDateTimeModel);
		expect(ddl).toContain(
			"DEFINE FIELD expires ON TABLE optional_datetime_model TYPE option<datetime>",
		);
		await applySchema(db, [OptionalDateTimeModel]);
	});

	test("should allow omitting optional datetime field", async () => {
		const record = await OptionalDateTimeModel.create(db, {});
		expect(record.expires).toBeUndefined();
	});

	test("should allow setting optional datetime to undefined", async () => {
		const record = await OptionalDateTimeModel.create(db, {
			expires: undefined,
		});
		expect(record.expires).toBeUndefined();
	});

	test("should allow setting optional datetime", async () => {
		const now = new Date();
		const record = await OptionalDateTimeModel.create(db, { expires: now });
		expect(record.expires).toBeDefined();
		if (record.expires) {
			expect(record.expires.toString()).toBe(now.toString());
		}
	});
});

describe("Field.datetime - negative cases", () => {
	class StrictDateTimeModel extends Table.normal({
		name: "strict_datetime_model",
		fields: { val: Field.datetime() },
		schemafull: true,
	}) {}

	test("should generate and apply SurrealQL for strict datetime", async () => {
		const ddl = generateTableSchemaQl(StrictDateTimeModel);
		expect(ddl).toContain(
			"DEFINE FIELD val ON TABLE strict_datetime_model TYPE datetime",
		);
		await applySchema(db, [StrictDateTimeModel]);
	});

	test("should throw when creating with non-date value", async () => {
		// @ts-expect-error
		expect(StrictDateTimeModel.create(db, { val: 123 })).rejects.toThrow();
	});
});
