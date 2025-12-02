import { describe, expect, test } from "bun:test";
import {
	parseFieldDefinition,
	parseTableDefinition,
	parseIndexDefinition,
} from "unreal-orm";

describe("parseFieldDefinition", () => {
	test("parses basic string field", () => {
		const ql = "DEFINE FIELD name ON TABLE user TYPE string PERMISSIONS FULL";
		const result = parseFieldDefinition(ql);
		expect(result.name).toBe("name");
		expect(result.type).toBe("string");
	});

	test("parses field with dot notation (nested object)", () => {
		const ql =
			"DEFINE FIELD price.amount ON TABLE product TYPE float PERMISSIONS FULL";
		const result = parseFieldDefinition(ql);
		expect(result.name).toBe("price.amount");
		expect(result.type).toBe("float");
	});

	test("parses union type with none", () => {
		const ql =
			"DEFINE FIELD avatar ON TABLE user TYPE none | string PERMISSIONS FULL";
		const result = parseFieldDefinition(ql);
		expect(result.name).toBe("avatar");
		expect(result.type).toBe("none | string");
	});

	test("parses complex union type", () => {
		const ql =
			"DEFINE FIELD status ON TABLE order TYPE string | int | bool PERMISSIONS FULL";
		const result = parseFieldDefinition(ql);
		expect(result.name).toBe("status");
		expect(result.type).toBe("string | int | bool");
	});

	test("parses array type", () => {
		const ql =
			"DEFINE FIELD tags ON TABLE post TYPE array<string> PERMISSIONS FULL";
		const result = parseFieldDefinition(ql);
		expect(result.name).toBe("tags");
		expect(result.type).toBe("array<string>");
	});

	test("parses array of records", () => {
		const ql =
			"DEFINE FIELD participants ON TABLE room TYPE array<record<user>> PERMISSIONS FULL";
		const result = parseFieldDefinition(ql);
		expect(result.name).toBe("participants");
		expect(result.type).toBe("array<record<user>>");
	});

	test("parses option type", () => {
		const ql =
			"DEFINE FIELD email ON TABLE user TYPE option<string> PERMISSIONS FULL";
		const result = parseFieldDefinition(ql);
		expect(result.name).toBe("email");
		expect(result.type).toBe("option<string>");
	});

	test("parses record link", () => {
		const ql =
			"DEFINE FIELD author ON TABLE post TYPE record<user> PERMISSIONS FULL";
		const result = parseFieldDefinition(ql);
		expect(result.name).toBe("author");
		expect(result.type).toBe("record<user>");
	});

	test("parses field with default value", () => {
		const ql =
			"DEFINE FIELD is_active ON TABLE user TYPE bool DEFAULT true PERMISSIONS FULL";
		const result = parseFieldDefinition(ql);
		expect(result.name).toBe("is_active");
		expect(result.type).toBe("bool");
		expect(result.default).toBe("true");
	});

	test("parses field with value (computed)", () => {
		const ql =
			"DEFINE FIELD created_at ON TABLE user TYPE datetime VALUE time::now() PERMISSIONS FULL";
		const result = parseFieldDefinition(ql);
		expect(result.name).toBe("created_at");
		expect(result.type).toBe("datetime");
		expect(result.value).toBe("time::now()");
	});

	test("parses field with assertion", () => {
		const ql =
			"DEFINE FIELD email ON TABLE user TYPE string ASSERT string::is_email($value) PERMISSIONS FULL";
		const result = parseFieldDefinition(ql);
		expect(result.name).toBe("email");
		expect(result.type).toBe("string");
		expect(result.assert).toBe("string::is_email($value)");
	});

	test("parses field with multiple options", () => {
		const ql =
			"DEFINE FIELD username ON TABLE user TYPE string DEFAULT 'anonymous' ASSERT string::len($value) >= 3 PERMISSIONS FULL";
		const result = parseFieldDefinition(ql);
		expect(result.name).toBe("username");
		expect(result.type).toBe("string");
		expect(result.default).toBe("'anonymous'");
		expect(result.assert).toBe("string::len($value) >= 3");
	});

	test("parses geometry type", () => {
		const ql =
			"DEFINE FIELD location ON TABLE place TYPE geometry<point> PERMISSIONS FULL";
		const result = parseFieldDefinition(ql);
		expect(result.name).toBe("location");
		expect(result.type).toBe("geometry<point>");
	});

	test("parses set type", () => {
		const ql =
			"DEFINE FIELD tags ON TABLE post TYPE set<string> PERMISSIONS FULL";
		const result = parseFieldDefinition(ql);
		expect(result.name).toBe("tags");
		expect(result.type).toBe("set<string>");
	});

	test("parses field when field name matches keyword", () => {
		const ql =
			"DEFINE FIELD type ON activity TYPE string ASSERT $value INSIDE ['listen', 'share'] PERMISSIONS FULL";
		const result = parseFieldDefinition(ql);
		expect(result.name).toBe("type");
		expect(result.type).toBe("string");
		expect(result.assert).toBe("$value INSIDE ['listen', 'share']");
	});

	test("parses wildcard field for flexible schemas", () => {
		const ql =
			"DEFINE FIELD family_members.* ON user_subscription TYPE record<user> PERMISSIONS FULL";
		const result = parseFieldDefinition(ql);
		expect(result.name).toBe("family_members.*");
		expect(result.type).toBe("record<user>");
	});
});

describe("parseTableDefinition", () => {
	test("parses normal table", () => {
		const ql = "DEFINE TABLE user SCHEMAFULL PERMISSIONS FULL";
		const result = parseTableDefinition(ql);
		expect(result.name).toBe("user");
		expect(result.type).toBe("NORMAL");
		expect(result.schemafull).toBe(true);
	});

	test("parses relation table", () => {
		const ql =
			"DEFINE TABLE follow TYPE RELATION IN user OUT user SCHEMAFULL PERMISSIONS FULL";
		const result = parseTableDefinition(ql);
		expect(result.name).toBe("follow");
		expect(result.type).toBe("RELATION");
		expect(result.schemafull).toBe(true);
	});

	test("parses view table", () => {
		const ql =
			"DEFINE TABLE active_users AS SELECT * FROM user WHERE is_active = true PERMISSIONS FULL";
		const result = parseTableDefinition(ql);
		expect(result.name).toBe("active_users");
		expect(result.type).toBe("VIEW");
		expect(result.viewQuery).toContain("SELECT * FROM user");
	});

	test("parses schemaless table", () => {
		const ql = "DEFINE TABLE logs SCHEMALESS PERMISSIONS FULL";
		const result = parseTableDefinition(ql);
		expect(result.name).toBe("logs");
		expect(result.schemafull).toBe(false);
	});
});

describe("parseIndexDefinition", () => {
	test("parses basic index", () => {
		const ql = "DEFINE INDEX idx_email ON user FIELDS email";
		const result = parseIndexDefinition(ql);
		expect(result.name).toBe("idx_email");
		expect(result.columns).toEqual(["email"]);
		expect(result.unique).toBe(false);
	});

	test("parses unique index", () => {
		const ql = "DEFINE INDEX idx_username ON user FIELDS username UNIQUE";
		const result = parseIndexDefinition(ql);
		expect(result.name).toBe("idx_username");
		expect(result.columns).toEqual(["username"]);
		expect(result.unique).toBe(true);
	});

	test("parses composite index", () => {
		const ql = "DEFINE INDEX idx_user_post ON post FIELDS user, created_at";
		const result = parseIndexDefinition(ql);
		expect(result.name).toBe("idx_user_post");
		expect(result.columns).toEqual(["user", "created_at"]);
	});

	test("parses index with COLUMNS keyword", () => {
		const ql = "DEFINE INDEX idx_email ON user COLUMNS email";
		const result = parseIndexDefinition(ql);
		expect(result.name).toBe("idx_email");
		expect(result.columns).toEqual(["email"]);
	});
});
