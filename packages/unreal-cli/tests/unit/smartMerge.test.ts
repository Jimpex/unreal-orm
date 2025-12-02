import { describe, test, expect } from "bun:test";
import { smartMergeTableCode } from "../../src/codegen/smartMerge";
import type { TableAST } from "unreal-orm";

describe("Smart Merge", () => {
	const baseCodeTable: TableAST = {
		name: "user",
		type: "NORMAL",
		drop: false,
		schemafull: true,
		permissions: {},
		fields: [
			{ name: "email", type: "string", flex: false, permissions: {} },
			{ name: "username", type: "string", flex: false, permissions: {} },
		],
		indexes: [],
		events: [],
	};

	test("should return unchanged content when schemas are identical", () => {
		const existingCode = `import { Table, Field, Index } from 'unreal-orm';

export class User extends Table.normal({
  name: "user",
  schemafull: true,
  fields: {
    email: Field.string(),
    username: Field.string(),
  },
}) {}

export const UserDefinitions = [User];
`;

		const result = smartMergeTableCode(
			existingCode,
			baseCodeTable,
			baseCodeTable,
		);

		expect(result.content).toBe(existingCode);
		expect(result.addedFields).toEqual([]);
		expect(result.addedIndexes).toEqual([]);
	});

	test("should add new field from database", () => {
		const existingCode = `import { Table, Field, Index } from 'unreal-orm';

/**
 * User table with custom comments
 */
export class User extends Table.normal({
  name: "user",
  schemafull: true,
  fields: {
    email: Field.string(),
    username: Field.string(),
  },
}) {
  // Custom method preserved
  getDisplayName() {
    return this.username;
  }
}

export const UserDefinitions = [User];
`;

		const dbTable: TableAST = {
			...baseCodeTable,
			fields: [
				...baseCodeTable.fields,
				{ name: "avatar_url", type: "string", flex: false, permissions: {} },
			],
		};

		const result = smartMergeTableCode(existingCode, dbTable, baseCodeTable);

		expect(result.addedFields).toContain("avatar_url");
		expect(result.content).toContain("avatar_url: Field.string()");
		expect(result.content).toContain("// Added from database");
		// Preserve custom method
		expect(result.content).toContain("getDisplayName()");
		// Preserve comments
		expect(result.content).toContain("User table with custom comments");
	});

	test("should add new index from database", () => {
		const existingCode = `import { Table, Field, Index } from 'unreal-orm';

export class User extends Table.normal({
  name: "user",
  schemafull: true,
  fields: {
    email: Field.string(),
    username: Field.string(),
  },
}) {}

export const UserDefinitions = [User];
`;

		const dbTable: TableAST = {
			...baseCodeTable,
			indexes: [{ name: "idx_user_email", columns: ["email"], unique: true }],
		};

		const result = smartMergeTableCode(existingCode, dbTable, baseCodeTable);

		expect(result.addedIndexes).toContain("idx_user_email");
		expect(result.content).toContain("idx_user_email");
		expect(result.content).toContain('fields: ["email"]');
		expect(result.content).toContain("unique: true");
	});

	test("should comment out removed fields", () => {
		const existingCode = `import { Table, Field, Index } from 'unreal-orm';

export class User extends Table.normal({
  name: "user",
  fields: {
    email: Field.string(),
    username: Field.string(),
    old_field: Field.string(),
  },
}) {}

export const UserDefinitions = [User];
`;

		const codeTable: TableAST = {
			...baseCodeTable,
			fields: [
				...baseCodeTable.fields,
				{ name: "old_field", type: "string", flex: false, permissions: {} },
			],
		};

		// DB doesn't have old_field
		const result = smartMergeTableCode(existingCode, baseCodeTable, codeTable);

		expect(result.removedFields).toContain("old_field");
		// Field should be commented out
		expect(result.content).toContain("// Removed from database");
		expect(result.content).toContain("// old_field: Field.string()");
		// Other fields should remain
		expect(result.content).toContain("email: Field.string()");
		expect(result.content).toContain("username: Field.string()");
	});

	test("should comment out multi-line field definitions", () => {
		const existingCode = `import { Table, Field, Index } from 'unreal-orm';
import { surql } from 'surrealdb';

export class User extends Table.normal({
  name: "user",
  fields: {
    email: Field.string(),
    // This is a complex multi-line field
    profile: Field.object({
      bio: Field.string(),
      avatar: Field.string(),
      settings: Field.object({
        theme: Field.string(),
        notifications: Field.bool(),
      }),
    }, {
      default: surql\`{}\`,
    }),
    username: Field.string(),
  },
}) {}

export const UserDefinitions = [User];
`;

		const codeTable: TableAST = {
			...baseCodeTable,
			fields: [
				{ name: "email", type: "string", flex: false, permissions: {} },
				{ name: "profile", type: "object", flex: false, permissions: {} },
				{ name: "username", type: "string", flex: false, permissions: {} },
			],
		};

		// DB doesn't have profile field
		const dbTable: TableAST = {
			...baseCodeTable,
			fields: [
				{ name: "email", type: "string", flex: false, permissions: {} },
				{ name: "username", type: "string", flex: false, permissions: {} },
			],
		};

		const result = smartMergeTableCode(existingCode, dbTable, codeTable);

		expect(result.removedFields).toContain("profile");
		// All lines of the multi-line field should be commented
		expect(result.content).toContain("// Removed from database");
		expect(result.content).toContain("// profile: Field.object({");
		// Indentation should be preserved - "// " inserted after the whitespace
		expect(result.content).toContain("      // bio: Field.string()");
		expect(result.content).toContain("    // }),");
		// Other fields should remain uncommented
		expect(result.content).toContain("email: Field.string()");
		expect(result.content).toContain("username: Field.string()");
		// The comment before the field should be preserved (not commented out)
		expect(result.content).toContain("// This is a complex multi-line field");
	});

	test("should handle field with options", () => {
		const existingCode = `import { Table, Field, Index } from 'unreal-orm';

export class User extends Table.normal({
  name: "user",
  fields: {
    email: Field.string(),
  },
}) {}

export const UserDefinitions = [User];
`;

		const dbTable: TableAST = {
			name: "user",
			type: "NORMAL",
			drop: false,
			schemafull: true,
			permissions: {},
			fields: [
				{ name: "email", type: "string", flex: false, permissions: {} },
				{
					name: "created_at",
					type: "datetime",
					flex: false,
					value: "time::now()",
					permissions: {},
				},
			],
			indexes: [],
			events: [],
		};

		const codeTable: TableAST = {
			name: "user",
			type: "NORMAL",
			drop: false,
			schemafull: true,
			permissions: {},
			fields: [{ name: "email", type: "string", flex: false, permissions: {} }],
			indexes: [],
			events: [],
		};

		const result = smartMergeTableCode(existingCode, dbTable, codeTable);

		expect(result.addedFields).toContain("created_at");
		expect(result.content).toContain("created_at: Field.datetime");
		expect(result.content).toContain("time::now()");
	});

	test("should comment out removed indexes", () => {
		const existingCode = `import { Table, Field, Index } from 'unreal-orm';

export class User extends Table.normal({
  name: "user",
  fields: {
    email: Field.string(),
  },
}) {}

export const idx_user_email = Index.define(() => User, {
  name: "idx_user_email",
  fields: ["email"],
  unique: true,
});

export const UserDefinitions = [User, idx_user_email];
`;

		const codeTable: TableAST = {
			...baseCodeTable,
			fields: [{ name: "email", type: "string", flex: false, permissions: {} }],
			indexes: [{ name: "idx_user_email", columns: ["email"], unique: true }],
		};

		// DB doesn't have the index
		const dbTable: TableAST = {
			...baseCodeTable,
			fields: [{ name: "email", type: "string", flex: false, permissions: {} }],
			indexes: [],
		};

		const result = smartMergeTableCode(existingCode, dbTable, codeTable);

		expect(result.removedIndexes).toContain("idx_user_email");
		// Index should be commented out
		expect(result.content).toContain("// Removed from database");
		expect(result.content).toContain("// export const idx_user_email");
	});
});
