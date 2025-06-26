import type { Surreal } from 'surrealdb';
import type { AnyModelClass, FieldDefinition, FieldOptions } from './types'; // FieldOptions replaces BaseFieldOptions

export type SchemaApplicationMethod = "IF NOT EXISTS" | "OVERWRITE" | "error";

/**
 * Generates SurrealQL DDL statements for a single table model, including all fields, indexes, and permissions.
 *
 * @param modelClass The model class (output of Table.normal)
 * @param method How to apply the schema (e.g., 'IF NOT EXISTS', 'DROP', etc.)
 * @returns A string containing SurrealQL DDL statements for the table
 *
 * @example
 *   import { Table, Field, generateTableSchemaQl } from 'unreal-orm';
 *   const User = Table.normal({
 *     name: 'user',
 *     fields: { name: Field.string() }
 *   });
 *   const ddl = generateTableSchemaQl(User);
 *   // Pass `ddl` to SurrealDB for schema migration
 */
export function generateTableSchemaQl(
  modelClass: AnyModelClass,
  method: SchemaApplicationMethod = "IF NOT EXISTS"
): string {
  const tableName = modelClass._tableName;
  const fields = modelClass._fields;
  const options = modelClass._options;

  const allStatements: string[] = [];

  // 1. DEFINE TABLE statement
  let defineTableStatement = 'DEFINE TABLE';
  if (method !== "error") {
    defineTableStatement += ` ${method}`;
  }
  defineTableStatement += ` ${tableName}`;

  const schemafullOpt = options.schemafull;
  // const typeOpt = options.type; // Assuming 'type' might be an option for table type like 'NORMAL', 'ANY'
  const hasFields = Object.keys(fields).length > 0;
  // let typeKeyword: string | undefined = undefined;

  // if (typeof typeOpt === 'string') {
  //   typeKeyword = typeOpt;
  // } else if (typeof typeOpt === 'object' && typeOpt !== null && 'kind' in typeOpt && typeof (typeOpt as { kind: unknown }).kind === 'string') {
  //   typeKeyword = (typeOpt as { kind: string }).kind;
  // }

  if (schemafullOpt === true) {
    defineTableStatement += ' SCHEMAFULL';
  } 
  // else if (typeKeyword === 'normal') {
  //   defineTableStatement += ' TYPE NORMAL';
  // } else if (typeKeyword === 'any') {
  //   defineTableStatement += ' TYPE ANY';
  // } else if (typeKeyword === 'schemaless') {
  //   defineTableStatement += ' TYPE SCHEMALESS';
  // }
  else if (schemafullOpt === undefined /*&& typeKeyword === undefined*/ && hasFields) {
    // Default to SCHEMAFULL if no explicit 'schemafull: true' and no recognized 'type' is set, and fields exist.
    defineTableStatement += ' SCHEMAFULL';
  }

  if (options.permissions) {
    const { permissions } = options;
    const permissionsClauses: string[] = [];
    if (permissions.select) permissionsClauses.push(`FOR select ${permissions.select}`);
    if (permissions.create) permissionsClauses.push(`FOR create ${permissions.create}`);
    if (permissions.update) permissionsClauses.push(`FOR update ${permissions.update}`);
    if (permissions.delete) permissionsClauses.push(`FOR delete ${permissions.delete}`);
    if (permissionsClauses.length > 0) {
      defineTableStatement += ` PERMISSIONS ${permissionsClauses.join(' ')}`;
    }
  }

  // if (options.comment) { // Assuming 'comment' might be an option
  //   defineTableStatement += ` COMMENT '${options.comment}'`;
  // }
  allStatements.push(`${defineTableStatement};`);

  // 2. DEFINE FIELD statements (recursive function to handle nested objects)
  function defineFields(fieldObject: Record<string, FieldDefinition<unknown>>, prefix = '') {
    for (const [fieldName, fieldDef] of Object.entries(fieldObject)) {
      const fullFieldName = prefix ? `${prefix}.${fieldName}` : fieldName;

      // First, define the current field (which could be an object itself)
      let fieldStatement = `DEFINE FIELD ${fullFieldName} ON TABLE ${tableName}`;

      // Emit FLEXIBLE before TYPE if requested (for object or custom fields)
      if (fieldDef.flexible === true) {
        fieldStatement += ' FLEXIBLE';
      }
      fieldStatement += ` TYPE ${fieldDef.type}`;

      if (fieldDef.assert) {
        fieldStatement += ` ASSERT ${fieldDef.assert}`;
      }
      if (fieldDef.value) {
        fieldStatement += ` VALUE ${fieldDef.value}`;
      }

      // If a string is provided for 'default', use it directly as the SurrealQL default value.
      if (fieldDef.default) {
        fieldStatement += ` DEFAULT ${fieldDef.default}`;
      }

      if (fieldDef.readonly) {
        fieldStatement += ' READONLY';
      }

      if (fieldDef.permissions) {
        const permParts: string[] = [];
        if (typeof fieldDef.permissions === 'string') {
          permParts.push(fieldDef.permissions);
        } else {
          if (fieldDef.permissions.select) permParts.push(`FOR select ${fieldDef.permissions.select}`);
          if (fieldDef.permissions.create) permParts.push(`FOR create ${fieldDef.permissions.create}`);
          if (fieldDef.permissions.update) permParts.push(`FOR update ${fieldDef.permissions.update}`);
          if (fieldDef.permissions.delete) permParts.push(`FOR delete ${fieldDef.permissions.delete}`);
        }
        if (permParts.length > 0) {
          fieldStatement += ` PERMISSIONS ${permParts.join(' ')}`;
        }
      }

      if (fieldDef.comment) {
        fieldStatement += ` COMMENT '${fieldDef.comment.replace(/'/g, "''")}'`; // Ensure quotes in comments are escaped
      }

      allStatements.push(`${fieldStatement};`);

      // If the current field is an object and has a schema, then recurse for its children
      if (fieldDef.type === 'object' && fieldDef.objectSchema) {
        defineFields(fieldDef.objectSchema, fullFieldName);
      }
    }
  }

  // Initial call to define fields
  defineFields(fields);

  // 3. DEFINE INDEX statements
  if (options.indexes && Array.isArray(options.indexes)) {
    for (const indexDef of options.indexes) {
      let indexStatement = `DEFINE INDEX ${indexDef.name} ON TABLE ${tableName} FIELDS ${indexDef.fields.join(", ")}`;
      if (indexDef.unique) {
        indexStatement += ' UNIQUE'; // No interpolation
      }
      if (indexDef.analyzer) {
        indexStatement += ` ANALYZER ${indexDef.analyzer}`;
      }
      if (indexDef.comment) {
        indexStatement += ` COMMENT '${indexDef.comment.replace(/'/g, "''")}'`;
      }
      allStatements.push(`${indexStatement};`);
    }
  }

  return allStatements.join('\n');
}

/**
 * Generates SurrealQL DDL statements for multiple model classes (tables).
 * Useful for initializing or migrating the full database schema.
 *
 * @param modelClasses Array of model classes (output of Table.normal)
 * @param method How to apply the schema (e.g., 'IF NOT EXISTS', 'DROP', etc.)
 * @returns A string containing SurrealQL DDL statements for all tables
 *
 * @example
 *   import { Table, Field, generateFullSchemaQl } from 'unreal-orm';
 *   const User = Table.normal({ ... });
 *   const Post = Table.normal({ ... });
 *   const ddl = generateFullSchemaQl([User, Post]);
 *   // Pass `ddl` to SurrealDB for schema migration
 */
export function generateFullSchemaQl(
  modelClasses: AnyModelClass[],
  method: SchemaApplicationMethod = "IF NOT EXISTS"
): string {
  const schema = modelClasses.map(mc => generateTableSchemaQl(mc, method)).join('\n\n');
  console.debug("[ORM DEBUG]:\n", schema)

  return schema;
}

/**
 * Applies the generated SurrealQL schema to the database by executing DDL statements.
 *
 * @param db The SurrealDB client instance
 * @param modelClasses Array of model classes (output of Table.normal)
 * @param method How to apply the schema (e.g., 'IF NOT EXISTS')
 * @returns Promise<void> (resolves when schema has been applied)
 *
 * @example
 *   import { applySchema, Table, Field } from 'unreal-orm';
 *   const User = Table.normal({ ... });
 *   const Post = Table.normal({ ... });
 *   await applySchema(db, [User, Post]);
 */
export async function applySchema(
  db: Surreal,
  modelClasses: AnyModelClass[],
  method: SchemaApplicationMethod = "IF NOT EXISTS"
): Promise<void> {
  const schemaQl = generateFullSchemaQl(modelClasses, method);
  if (schemaQl.trim() !== '') {
    await db.query(schemaQl);
  }
}
