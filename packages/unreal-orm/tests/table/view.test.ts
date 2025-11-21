import { describe, expect, test } from "bun:test";
import { surql } from "surrealdb";
import { Table, Field } from "../../src";
import { generateTableDdl } from "../../src/schema/ddl/table";

describe("Table.view()", () => {
	test("defines a view without fields (just query)", () => {
		class AdultUsers extends Table.view({
			name: "adult_users",
			as: "SELECT * FROM user WHERE age >= 18",
		}) {}

		const ddl = generateTableDdl(AdultUsers);
		expect(ddl).toBe(
			"DEFINE TABLE adult_users TYPE NORMAL AS SELECT * FROM user WHERE age >= 18;",
		);
	});

	test("defines a view with explicit TypeScript inference", () => {
		type AdultUser = { name: string; age: number };

		class AdultUsers extends Table.view<AdultUser>({
			name: "adult_users",
			as: "SELECT name, age FROM user WHERE age >= 18",
		}) {}

		const ddl = generateTableDdl(AdultUsers);
		expect(ddl).toBe(
			"DEFINE TABLE adult_users TYPE NORMAL AS SELECT name, age FROM user WHERE age >= 18;",
		);
	});

	test("defines a view with a BoundQuery", () => {
		class User extends Table.normal({
			name: "user",
			fields: {
				name: Field.string(),
				age: Field.number(),
			},
		}) {}

		class AdultUsers extends Table.view({
			name: "adult_users",
			as: surql`SELECT * FROM ${User} WHERE age >= 18`,
		}) {}

		const ddl = generateTableDdl(AdultUsers);
		expect(ddl).toContain(
			"DEFINE TABLE adult_users TYPE NORMAL AS SELECT * FROM",
		);
		expect(ddl).toContain("WHERE age >= 18;");
	});

	test("defines a view with SCHEMAFULL", () => {
		class AdultUsers extends Table.view({
			name: "adult_users",
			schemafull: true,
			as: "SELECT * FROM user WHERE age >= 18",
		}) {}

		const ddl = generateTableDdl(AdultUsers);
		expect(ddl).toBe(
			"DEFINE TABLE adult_users TYPE NORMAL SCHEMAFULL AS SELECT * FROM user WHERE age >= 18;",
		);
	});

	test("defines a view with permissions", () => {
		class AdultUsers extends Table.view({
			name: "adult_users",
			as: "SELECT * FROM user",
			permissions: {
				select: surql`true`,
			},
		}) {}

		const ddl = generateTableDdl(AdultUsers);
		expect(ddl).toBe(
			"DEFINE TABLE adult_users TYPE NORMAL AS SELECT * FROM user PERMISSIONS FOR select true;",
		);
	});
});
