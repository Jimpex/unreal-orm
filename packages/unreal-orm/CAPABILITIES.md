# Unreal-ORM SurrealDB 2.x Feature Support

This document outlines the support status of various SurrealDB 2.x schema definition features within the `unreal-orm` library. The ORM aims to provide a type-safe way to define and generate SurrealDB schemas.

## `DEFINE TABLE` Features

| Feature                                      | SurrealDB Syntax Example                                  | `unreal-orm` Support | Notes                                                                                                                               |
| -------------------------------------------- | --------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Basic Table Definition                       | `DEFINE TABLE user;`                                      | ✅ **Supported**     | `Table.define({ name: 'user', ... })`                                                                                             |
| `IF NOT EXISTS`                              | `DEFINE TABLE user IF NOT EXISTS;`                        | ✅ **Supported**     | `Table.define({ ..., method: 'IF NOT EXISTS' })`                                                                                  |
| `OVERWRITE`                                  | `DEFINE TABLE user OVERWRITE;`                            | ✅ **Supported**     | `Table.define({ ..., method: 'OVERWRITE' })`                                                                                      |
| `SCHEMAFULL`                                 | `DEFINE TABLE user SCHEMAFULL;`                           | ✅ **Supported**     | `Table.define({ ..., schemafull: true })` or implicit if fields defined & no other type.                                          |
| `SCHEMALESS`                                 | `DEFINE TABLE user SCHEMALESS;`                           | ✅ **Supported**     | `Table.define({ ..., type: 'schemaless' })`                                                                                       |
| `TYPE NORMAL`                                | `DEFINE TABLE user TYPE NORMAL;`                          | ✅ **Supported**     | `Table.define({ ..., type: 'normal' })`                                                                                           |
| `TYPE ANY`                                   | `DEFINE TABLE user TYPE ANY;`                             | ✅ **Supported**     | `Table.define({ ..., type: 'any' })`                                                                                              |
| `TYPE RELATION IN ... OUT ...`               | `DEFINE TABLE likes TYPE RELATION IN user OUT post;`      | ⚠️ **Partially**    | No direct `type: 'relation'` option. Define `in`/`out` fields as `Field.record()`. `ENFORCED` not supported.                       |
| `ENFORCED` (for `TYPE RELATION`)             | `DEFINE TABLE likes TYPE RELATION ... ENFORCED;`          | ❌ **Not Supported** | Tied to full `TYPE RELATION` syntax.                                                                                              |
| Table View (`AS SELECT ...`)                 | `DEFINE TABLE user_view AS SELECT ... FROM user;`         | ❌ **Not Supported** |                                                                                                                                     |
| `CHANGEFEED @duration [INCLUDE ORIGINAL]`    | `DEFINE TABLE user CHANGEFEED 1h;`                        | ❌ **Not Supported** |                                                                                                                                     |
| `PERMISSIONS` (Table-level)                | `DEFINE TABLE user PERMISSIONS FOR select WHERE ...;`     | ✅ **Supported**     | `Table.define({ ..., permissions: { select: '...' } })`                                                                           |
| `COMMENT @string`                            | `DEFINE TABLE user COMMENT 'User accounts';`              | ✅ **Supported**     | `Table.define({ ..., comment: '...' })`                                                                                           |
| `DROP` (within `DEFINE TABLE`)               | `DEFINE TABLE user DROP;`                                 | ❌ **Not Supported** | `REMOVE TABLE` is a separate operation, not part of `Table.define`.                                                               |

## `DEFINE FIELD` Features

| Feature                                      | SurrealDB Syntax Example                                     | `unreal-orm` Support | Notes                                                                                                                            |
| -------------------------------------------- | ------------------------------------------------------------ | -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Basic Field Definition                       | `DEFINE FIELD email ON user;`                                | ✅ **Supported**     | Via `fields` object in `Table.define({ fields: { email: Field.string() } })`.                                                    |
| `IF NOT EXISTS` (Field-level)                | `DEFINE FIELD email ON user IF NOT EXISTS;`                  | ❌ **Not Supported** | ORM regenerates the whole schema.                                                                                                  |
| `OVERWRITE` (Field-level)                    | `DEFINE FIELD email ON user OVERWRITE;`                      | ❌ **Not Supported** | ORM regenerates the whole schema.                                                                                                  |
| `TYPE @type` (various types)                 | `DEFINE FIELD age ON user TYPE number;`                      | ⚠️ **Partially**     | See "Data Type Support" section below for detailed coverage. |
| `FLEXIBLE TYPE @type`                        | `DEFINE FIELD meta ON user FLEXIBLE TYPE object;`            | ✅ **Supported**     | Use `{ flexible: true }` with `Field.object()` or `Field.custom()`. Enables flexible schemas for object/custom fields.           |
| `DEFAULT @expression`                        | `DEFINE FIELD role ON user TYPE string DEFAULT 'guest';`      | ✅ **Supported**     | `Field.string({ default: 'guest' })`. Handles primitives, `time::now()`, functions.                                            |
| `DEFAULT ALWAYS @expression`                 | `DEFINE FIELD updated_at ON user TYPE datetime DEFAULT ALWAYS time::now();` | ❌ **Not Supported** | Only standard `DEFAULT` is supported.                                                                                            |
| `VALUE @expression`                          | `DEFINE FIELD created_at ON user VALUE time::now();`         | ✅ **Supported**     | `Field.string({ value: 'time::now()' })` or e.g. `Field.string({ value: 'string::lowercase($value)' })`                           |
| `VALUE <future> { @expression }`             | `DEFINE FIELD last_accessed ON user VALUE <future> { time::now() };` | ❌ **Not Supported** | Only standard VALUE is supported, not VALUE <future>.                                              |
| `ASSERT @expression`                         | `DEFINE FIELD email ON user ASSERT string::is::email($value);` | ✅ **Supported**     | `Field.string({ assert: 'string::is::email($value)' })`                                                                          |
| `READONLY`                                   | `DEFINE FIELD id ON user READONLY;`                          | ✅ **Supported**     | `Field.string({ readonly: true })`                                                                                                 |
| `PERMISSIONS` (Field-level)                  | `DEFINE FIELD email ON user PERMISSIONS FOR select WHERE...;`  | ✅ **Supported**     | `Field.string({ permissions: { ... } })`                                                                                         |
| `COMMENT @string`                            | `DEFINE FIELD email ON user COMMENT 'User email';`           | ✅ **Supported**     | `Field.string({ comment: '...' })`                                                                                               |
| `REFERENCE` (with `ON DELETE` actions)       | `DEFINE FIELD author ON post TYPE record<user> REFERENCE ON DELETE CASCADE;` | ❌ **Not Supported** |                                                                                                                                  |
| Define type for `id` field                   | `DEFINE FIELD id ON user TYPE string;`                       | ✅ **Supported**     | `Table.define({ fields: { id: Field.custom({ type: 'string' }) } })`                                                             |
| Define types for specific array indices      | `DEFINE FIELD data[0] ON mytable TYPE string;`               | ❌ **Not Supported** | `Field.array(Field.string())` defines type for all items.                                                                        |

## `DEFINE INDEX` Features

| Feature                                      | SurrealDB Syntax Example                                     | `unreal-orm` Support | Notes                                                                                                                            |
| -------------------------------------------- | ------------------------------------------------------------ | -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Basic Index Definition                       | `DEFINE INDEX user_email ON user COLUMNS email;`             | ✅ **Supported**     | `Table.define({ indexes: { user_email: { fields: ['email'] } } })`                                                               |
| `IF NOT EXISTS` (Index-level)                | `DEFINE INDEX user_email ON user IF NOT EXISTS ...;`         | ❌ **Not Supported** | ORM regenerates the whole schema.                                                                                                  |
| `OVERWRITE` (Index-level)                    | `DEFINE INDEX user_email ON user OVERWRITE ...;`             | ❌ **Not Supported** | ORM regenerates the whole schema.                                                                                                  |
| `UNIQUE` Index                               | `DEFINE INDEX user_email ON user COLUMNS email UNIQUE;`      | ✅ **Supported**     | `Table.define({ indexes: { user_email: { fields: ['email'], unique: true } } })`                                                  |
| `SEARCH ANALYZER` (Full-Text Search)         | `DEFINE INDEX ... SEARCH ANALYZER ... BM25 HIGHLIGHTS;`      | ⚠️ **Partially**    | Basic index definition is supported. Specific FTS keywords (`SEARCH ANALYZER`, `BM25`) require manual setup or are not exposed. |
| Vector Index (`MTREE`, `HNSW`)               | `DEFINE INDEX ... MTREE DIMENSION ...;`                       | ❌ **Not Supported** |                                                                                                                                  |
| `COMMENT @string`                            | `DEFINE INDEX user_email ON user ... COMMENT '...';`          | ✅ **Supported**     | `Table.define({ indexes: { user_email: { ..., comment: '...' } } })`                                                             |
| `CONCURRENTLY`                               | `DEFINE INDEX user_email ON user ... CONCURRENTLY;`          | ❌ **Not Supported** |                                                                                                                                  |

## Other `DEFINE` Statements

`unreal-orm` primarily focuses on schema generation for tables, fields, and indexes. Other `DEFINE` statements are not yet supported by the ORM.

| Feature             | SurrealDB Syntax Example        | `unreal-orm` Support | Notes                                           |
| ------------------- | ------------------------------- | -------------------- | ----------------------------------------------- |
| `DEFINE NAMESPACE`  | `DEFINE NAMESPACE test;`        | ❌ **Not Supported** | Operates within a given DB/NS connection.       |
| `DEFINE DATABASE`   | `DEFINE DATABASE test;`         | ❌ **Not Supported** |                                                 |
| `DEFINE USER`       | `DEFINE USER ...;`              | ❌ **Not Supported** |                                                 |
| `DEFINE TOKEN`      | `DEFINE TOKEN ...;`             | ❌ **Not Supported** |                                                 |
| `DEFINE SCOPE`      | `DEFINE SCOPE ...;`             | ❌ **Not Supported** |                                                 |
| `DEFINE ANALYZER`   | `DEFINE ANALYZER ...;`          | ❌ **Not Supported** |                                                 |
| `DEFINE EVENT`      | `DEFINE EVENT ... ON TABLE ...;`| ❌ **Not Supported** |                                                 |
| `DEFINE FUNCTION`   | `DEFINE FUNCTION fn::abc() ...;`| ❌ **Not Supported** |                                                 |
| `DEFINE PARAM`      | `DEFINE PARAM $myparam ...;`    | ❌ **Not Supported** |                                                 |

## Data Type Support

### Field Definition Examples

```ts
import { Table, Field } from 'unreal-orm';

const User = Table.define({
  name: 'user',
  fields: {
    name: Field.string({ assert: '$value.length > 2', comment: 'User name' }),
    age: Field.number({ assert: '$value >= 0', default: '0' }),
    isActive: Field.bool({ default: 'true' }),
    createdAt: Field.datetime({ default: 'time::now()' }),
    profile: Field.object({
      bio: Field.string(),
      website: Field.option(Field.string()),
    }),
    tags: Field.array(Field.string(), { max: 10 }),
    posts: Field.array(Field.record((): any => Post), { max: 100 }),
    author: Field.record((): any => User),
    nickname: Field.option(Field.string()),
    customField: Field.custom<number>('duration'),
  },
  indexes: [
    { name: 'user_name_idx', fields: ['name'], unique: true },
  ],
});

// Add instance/static methods directly in the class body
class UserWithMethods extends User {
  getDisplayName(): string {
    return this.name.toUpperCase();
  }
  static async findByName(db, name: string) {
    return this.select(db, { where: `name = $name`, vars: { name }, only: true });
  }
}
```

### Schema Generation & Application

```ts
import { applySchema, generateTableSchemaQl } from 'unreal-orm';

// Generate SurrealQL DDL for a single model
const ddl = generateTableSchemaQl(User);
// Generate DDL for multiple models
generateFullSchemaQl([User, Post]);
// Apply schema to the database
await applySchema(db, [User, Post]);
```

### Field Options Structure
- All field helpers accept a single `FieldOptions` object for options like `assert`, `default`, `permissions`, `comment`, etc.
- Only `Field.array` and `Field.record` accept extra options (`max` for arrays, reference options for records).
- There are no longer redundant option interfaces for each field type.

### Validation & Min/Max
- Use the `assert` option for validation, e.g. `Field.number({ assert: '$value >= 0' })` for min, or `Field.string({ assert: '$value.length < 20' })` for max length.
- For arrays, use the `max` option: `Field.array(Field.string(), { max: 10 })`.

---

SurrealDB supports a wide variety of data types. Below is the mapping between SurrealDB data types and unreal-orm field factories:

| SurrealDB Type | SurrealDB Syntax | `unreal-orm` Support | ORM Usage |
| -------------- | --------------- | -------------------- | --------- |
| `any` | `TYPE any` | ✅ **Supported** | `Field.any()` |
| `array` | `TYPE array` | ✅ **Supported** | `Field.array(itemDef)` |
| `array` with type | `TYPE array<string>` | ✅ **Supported** | `Field.array(Field.string())` |
| `array` with max length | `TYPE array<string, 10>` | ✅ **Supported** | Use `Field.array(Field.string(), { max: 10 })` |
| `bool` | `TYPE bool` | ✅ **Supported** | `Field.boolean()` |
| `bytes` | `TYPE bytes` | ❌ **Not Supported** | Use `Field.custom({ type: 'bytes' })` |
| `datetime` | `TYPE datetime` | ✅ **Supported** | `Field.datetime()` |
| `decimal` | `TYPE decimal` | ❌ **Not Supported** | Use `Field.custom({ type: 'decimal' })` |
| `duration` | `TYPE duration` | ❌ **Not Supported** | Use `Field.custom({ type: 'duration' })` |
| `float` | `TYPE float` | ❌ **Not Supported** | Use `Field.custom({ type: 'float' })` or `Field.number()` |
| `geometry` | `TYPE geometry` | ❌ **Not Supported** | Use `Field.custom({ type: 'geometry' })` |
| `geometry` with subtype | `TYPE geometry<point>` | ❌ **Not Supported** | Use `Field.custom({ type: 'geometry<point>' })` |
| `int` | `TYPE int` | ❌ **Not Supported** | Use `Field.custom({ type: 'int' })` or `Field.number()` |
| `number` | `TYPE number` | ✅ **Supported** | `Field.number()` |
| `object` | `TYPE object` | ✅ **Supported** | `Field.object({ ... })` |
| `option` | `TYPE option<T>` | ✅ **Supported** | `Field.option(innerTypeDef)` |
| `range` | `TYPE range` | ❌ **Not Supported** | Use `Field.custom({ type: 'range' })` |
| `record` | `TYPE record` | ✅ **Supported** | `Field.record((): any => Model)` |
| `record` with table | `TYPE record<user>` | ✅ **Supported** | `Field.record((): any => User)` |
| `regex` | `TYPE regex` | ❌ **Not Supported** | Use `Field.custom({ type: 'regex' })` |
| `set` | `TYPE set` | ❌ **Not Supported** | Use `Field.custom({ type: 'set' })` or `Field.array()` |
| `string` | `TYPE string` | ✅ **Supported** | `Field.string()` |
| `literal` | e.g., `"a" \| "b"` | ❌ **Not Supported** | No direct support for union types |

Note on Type Coverage:

1. The `Field.custom()` method can be used as a workaround for any data type not directly supported.
2. The ORM primarily focuses on the most common data types while allowing advanced types to be used via `custom()`.
3. Field options like `min` and `max` for numbers are not provided directly as SurrealDB doesn't support them—use the `assert` option for validation.

---

## Best Practices
- Always define instance and static methods directly in your model class body (never via options).
- Use the `assert` field option for all validation logic (min/max, regex, etc.).
- Use `Field.option(...)` for nullable/optional fields.
- Use `Field.record((): any => Model)` for relations, and `Field.array(Field.record(...))` for arrays of relations.
- Use `Field.custom(typeString)` for any SurrealDB type not natively supported by a Field helper.
- Use `applySchema` or `generateTableSchemaQl` to generate/apply schemas to your SurrealDB instance.
- Keep your model and schema definitions in sync for type safety and maintainability.

This list is based on SurrealDB 2.x documentation and the features implemented in `unreal-orm` as of the last update. As SurrealDB and `unreal-orm` evolve, this document will be updated.
