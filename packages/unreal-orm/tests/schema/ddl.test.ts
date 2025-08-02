// Tests for SurrealQL DDL generation, schemafull, permissions, indexes

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
	Field,
	Index,
	Table,
	applySchema,
	generateFullSchemaQl,
} from "../../src";
import type Surreal from "surrealdb";
import { setupInMemoryDb, teardownDb } from "../utils/dbTestUtils";

let db: Surreal;

beforeAll(async () => {
	db = await setupInMemoryDb("relation_hydration", "relation_hydration");
});
afterAll(async () => {
	await teardownDb(db);
});

describe("DDL Generation", () => {
	test("generates and applies schemafull normal table DDL", async () => {
		class User extends Table.normal({
			name: "userddl",
			fields: {
				name: Field.string(),
				age: Field.number(),
				email: Field.string(),
			},
			schemafull: true,
			permissions: {
				select: "FULL",
				create: "FULL",
				update: "NONE",
				delete: "NONE",
			},
		}) {}
		const UserEmailIndex = Index.define(() => User, {
			name: "idx_userddl_email",
			fields: ["email"],
			unique: true,
		});
		const UserNameAgeIndex = Index.define(() => User, {
			name: "idx_userddl_name_age",
			fields: ["name", "age"],
		});

		const ddl = generateFullSchemaQl([User, UserEmailIndex, UserNameAgeIndex]);
		expect(ddl).toContain("DEFINE TABLE userddl SCHEMAFULL");
		expect(ddl).toContain("DEFINE FIELD name ON TABLE userddl TYPE string");
		expect(ddl).toContain("DEFINE FIELD age ON TABLE userddl TYPE number");
		expect(ddl).toContain(
			"PERMISSIONS FOR select FULL, FOR create FULL, FOR update NONE, FOR delete NONE",
		);
		expect(ddl).toContain("DEFINE INDEX idx_userddl_email");
		expect(ddl).toContain("UNIQUE");
		expect(ddl).toContain("DEFINE INDEX idx_userddl_name_age");

		await applySchema(db, [User, UserEmailIndex, UserNameAgeIndex]);
	});

	test("generates and applies schemaflex table DDL", async () => {
		class Flex extends Table.normal({
			name: "flexddl",
			fields: { foo: Field.string() },
			schemafull: false,
		}) {}
		const ddl = generateFullSchemaQl([Flex]);
		expect(ddl).toContain("DEFINE TABLE flexddl SCHEMALESS");
		expect(ddl).toContain("DEFINE FIELD foo ON TABLE flexddl TYPE string");
		await applySchema(db, [Flex]);
	});

	test("generates and applies relation table DDL", async () => {
		class User extends Table.normal({
			name: "userrel",
			fields: { name: Field.string() },
			schemafull: true,
		}) {}
		class Post extends Table.normal({
			name: "postrel",
			fields: { title: Field.string() },
			schemafull: true,
		}) {}
		class Authored extends Table.relation({
			name: "authoredrel",
			fields: {
				in: Field.record(() => User),
				out: Field.record(() => Post),
				since: Field.datetime(),
			},
			schemafull: true,
		}) {}
		const ddl = generateFullSchemaQl([Authored]);
		expect(ddl).toContain("DEFINE TABLE authoredrel SCHEMAFULL");
		expect(ddl).toContain(
			"DEFINE FIELD in ON TABLE authoredrel TYPE record<userrel>",
		);
		expect(ddl).toContain(
			"DEFINE FIELD out ON TABLE authoredrel TYPE record<postrel>",
		);
		expect(ddl).toContain(
			"DEFINE FIELD since ON TABLE authoredrel TYPE datetime",
		);
		await applySchema(db, [User, Post, Authored]);
	});

	test("generates DDL with OVERWRITE method for table, fields, and indexes", () => {
		class User extends Table.normal({
			name: "user_overwrite",
			fields: {
				name: Field.string(),
				email: Field.string(),
			},
			schemafull: true,
		}) {}

		const UserEmailIndex = Index.define(() => User, {
			name: "idx_user_email_overwrite",
			fields: ["email"],
			unique: true,
		});

		const ddl = generateFullSchemaQl([User, UserEmailIndex], "OVERWRITE");
		expect(ddl).toContain("DEFINE TABLE OVERWRITE user_overwrite");
		expect(ddl).toContain("DEFINE FIELD OVERWRITE name ON TABLE user_overwrite TYPE string");
		expect(ddl).toContain("DEFINE FIELD OVERWRITE email ON TABLE user_overwrite TYPE string");
		expect(ddl).toContain("DEFINE INDEX OVERWRITE idx_user_email_overwrite ON TABLE user_overwrite FIELDS email UNIQUE");
	});

	test("generates DDL with IF NOT EXISTS method for table, fields, and indexes", () => {
		class Product extends Table.normal({
			name: "product_exists",
			fields: {
				name: Field.string(),
				price: Field.number(),
			},
			schemafull: true,
		}) {}

		const ProductNameIndex = Index.define(() => Product, {
			name: "idx_product_name_exists",
			fields: ["name"],
		});

		const ddl = generateFullSchemaQl([Product, ProductNameIndex], "IF NOT EXISTS");
		expect(ddl).toContain("DEFINE TABLE IF NOT EXISTS product_exists");
		expect(ddl).toContain("DEFINE FIELD IF NOT EXISTS name ON TABLE product_exists TYPE string");
		expect(ddl).toContain("DEFINE FIELD IF NOT EXISTS price ON TABLE product_exists TYPE number");
		expect(ddl).toContain("DEFINE INDEX IF NOT EXISTS idx_product_name_exists ON TABLE product_exists FIELDS name");
	});
});
