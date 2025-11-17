// Tests for Field.datetime and its options

import { test, describe, expect, beforeAll, afterAll } from "bun:test";
import { Field, Table, applySchema, generateFullSchemaQl } from "../../src";
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
		const ddl = generateFullSchemaQl([DateTimeModel]);
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
		// Prevent error from different level of precision
		expect(new Date(record.created).getTime()).toBe(now.getTime());
		expect(new Date(record.updated).getTime()).toBe(now.getTime());
	});

	test("should create record with ISO string", async () => {
		const iso = new Date();
		const record = await DateTimeModel.create(db, {
			created: iso,
			updated: iso,
		});
		// Prevent error from different level of precision
		expect(new Date(record.created).getTime()).toBe(iso.getTime());
		expect(new Date(record.updated).getTime()).toBe(iso.getTime());
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
		const ddl = generateFullSchemaQl([OptionalDateTimeModel]);
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
			expect(new Date(record.expires).getTime()).toBe(now.getTime());
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
		const ddl = generateFullSchemaQl([StrictDateTimeModel]);
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
