---
title: Capabilities
description: Overview of SurrealDB features supported by unreal-orm, including table, field, and index schema support.
---

:::tip
This page summarizes which SurrealDB schema features are supported by unreal-orm. For hands-on examples see the [Quick Blog snippet](../readme/) and the [Tutorial](../guides/unreal-orm-tutorial/).
:::

## Quick Highlights

| 💎 Feature                         | What it gives you                                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Schema-only mode**               | Generate SurrealQL with `generateFullSchemaQl()` without touching the database—perfect for migrations & CI.        |
| **Embedded testing**               | Run SurrealDB fully in-process via `@surrealdb/node` engines (`mem://`) for ultra-fast unit tests.                 |
| **Parameterized queries (`vars`)** | Prevent injection; supported in `select`, `count`, `query`, etc.                                                   |
| **Type-safe `fetch` projection**   | Automatic hydration of related records (`Field.record`) with full TypeScript types.                                |
| **Circular dependency thunk**      | Use `Field.record(() => OtherTable)` to avoid import cycles while keeping types.                                   |
| **Advanced data types**            | Full, type-safe support for `bytes`, `duration`, `uuid`, `decimal`, and specific `geometry` types.                 |
| **Custom Surreal types**           | Define `Field.custom<'left' \| 'right'>('"left" \| "right"')` or any other database type for ultimate flexibility. |

---

## `DEFINE TABLE` Features

| Feature                                   | SurrealDB Syntax Example                              | `unreal-orm` Support | Notes                                                                                                          |
| ----------------------------------------- | ----------------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------- |
| Basic Table Definition                    | `DEFINE TABLE user;`                                  | ✅ **Supported**     | `class User extends Table.normal({ name: 'user', ... })`                                                       |
| `IF NOT EXISTS`                           | `DEFINE TABLE user IF NOT EXISTS;`                    | ✅ **Supported**     | `Table.normal({ ..., method: 'IF NOT EXISTS' })`                                                               |
| `OVERWRITE`                               | `DEFINE TABLE user OVERWRITE;`                        | ✅ **Supported**     | `Table.normal({ ..., method: 'OVERWRITE' })`                                                                   |
| `SCHEMAFULL`                              | `DEFINE TABLE user SCHEMAFULL;`                       | ✅ **Supported**     | `Table.normal({ ..., schemafull: true })` is the standard.                                                     |
| `SCHEMALESS`                              | `DEFINE TABLE user SCHEMALESS;`                       | ✅ **Supported**     | `Table.normal({ ..., schemafull: false })`                                                                     |
| `TYPE NORMAL`                             | `DEFINE TABLE user TYPE NORMAL;`                      | ✅ **Supported**     | This is the default for `Table.normal`.                                                                        |
| `TYPE ANY`                                | `DEFINE TABLE user TYPE ANY;`                         | ✅ **Supported**     | Not directly supported, use `schemafull: false`.                                                               |
| `TYPE RELATION IN ... OUT ...`            | `DEFINE TABLE likes TYPE RELATION IN user OUT post;`  | ✅ **Supported**     | Use `Table.relation({ fields: { in: Field.record(...), out: Field.record(...) } })`. `ENFORCED` not supported. |
| `ENFORCED` (for `TYPE RELATION`)          | `DEFINE TABLE likes TYPE RELATION ... ENFORCED;`      | ❌ **Not Supported** | Tied to full `TYPE RELATION` syntax.                                                                           |
| Table View (`AS SELECT ...`)              | `DEFINE TABLE user_view AS SELECT ... FROM user;`     | ❌ **Not Supported** |                                                                                                                |
| `CHANGEFEED @duration [INCLUDE ORIGINAL]` | `DEFINE TABLE user CHANGEFEED 1h;`                    | ❌ **Not Supported** |                                                                                                                |
| `PERMISSIONS` (Table-level)               | `DEFINE TABLE user PERMISSIONS FOR select WHERE ...;` | ✅ **Supported**     | `Table.define({ ..., permissions: { select: '...' } })`                                                        |
| `COMMENT @string`                         | `DEFINE TABLE user COMMENT 'User accounts';`          | ✅ **Supported**     | `Table.define({ ..., comment: '...' })`                                                                        |
| `DROP` (within `DEFINE TABLE`)            | `DEFINE TABLE user DROP;`                             | ❌ **Not Supported** | `REMOVE TABLE` is a separate operation, not part of `Table.define`.                                            |

## `DEFINE FIELD` Features

| Feature                                 | SurrealDB Syntax Example                                                     | `unreal-orm` Support | Notes                                                                                                                  |
| --------------------------------------- | ---------------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Basic Field Definition                  | `DEFINE FIELD email ON user;`                                                | ✅ **Supported**     | Via `fields` object in `Table.define({ fields: { email: Field.string() } })`.                                          |
| `IF NOT EXISTS` (Field-level)           | `DEFINE FIELD email ON user IF NOT EXISTS;`                                  | ❌ **Not Supported** | ORM regenerates the whole schema.                                                                                      |
| `OVERWRITE` (Field-level)               | `DEFINE FIELD email ON user OVERWRITE;`                                      | ❌ **Not Supported** | ORM regenerates the whole schema.                                                                                      |
| `TYPE @type` (various types)            | `DEFINE FIELD age ON user TYPE number;`                                      | ⚠️ **Partially**     | See "Data Type Support" section below for detailed coverage.                                                           |
| `FLEXIBLE TYPE @type`                   | `DEFINE FIELD meta ON user FLEXIBLE TYPE object;`                            | ✅ **Supported**     | Use `{ flexible: true }` with `Field.object()` or `Field.custom()`. Enables flexible schemas for object/custom fields. |
| `DEFAULT @expression`                   | `DEFINE FIELD role ON user TYPE string DEFAULT 'guest';`                     | ✅ **Supported**     | `Field.string({ default: surql`"guest"` })`. Handles primitives, `time::now()`, functions expressed as SurrealQL.      |
| `DEFAULT ALWAYS @expression`            | `DEFINE FIELD updated_at ON user TYPE datetime DEFAULT ALWAYS time::now();`  | ❌ **Not Supported** | Only standard `DEFAULT` is supported.                                                                                  |
| `VALUE @expression`                     | `DEFINE FIELD created_at ON user VALUE time::now();`                         | ✅ **Supported**     | `Field.string({ value: surql`time::now()` })` or e.g. `Field.string({ value: surql`string::lowercase($value)` })`      |
| `VALUE <future> { @expression }`        | `DEFINE FIELD last_accessed ON user VALUE <future> { time::now() };`         | ❌ **Not Supported** | Only standard VALUE is supported, not VALUE <future>.                                                                  |
| `ASSERT @expression`                    | `DEFINE FIELD email ON user ASSERT string::is::email($value);`               | ✅ **Supported**     | `Field.string({ assert: surql`string::is::email($value)` })`                                                           |
| `READONLY`                              | `DEFINE FIELD id ON user READONLY;`                                          | ✅ **Supported**     | `Field.string({ readonly: true })`                                                                                     |
| `PERMISSIONS` (Field-level)             | `DEFINE FIELD email ON user PERMISSIONS FOR select WHERE...;`                | ✅ **Supported**     | `Field.string({ permissions: { ... } })`                                                                               |
| `COMMENT @string`                       | `DEFINE FIELD email ON user COMMENT 'User email';`                           | ✅ **Supported**     | `Field.string({ comment: '...' })`                                                                                     |
| `REFERENCE` (with `ON DELETE` actions)  | `DEFINE FIELD author ON post TYPE record<user> REFERENCE ON DELETE CASCADE;` | ❌ **Not Supported** |                                                                                                                        |
| Define type for `id` field              | `DEFINE FIELD id ON user TYPE string;`                                       | ✅ **Supported**     | `Table.define({ fields: { id: Field.custom({ type: 'string' }) } })`                                                   |
| Define types for specific array indices | `DEFINE FIELD data[0] ON mytable TYPE string;`                               | ❌ **Not Supported** | `Field.array(Field.string())` defines type for all items.                                                              |

## `DEFINE INDEX` Features

| Feature                              | SurrealDB Syntax Example                                | `unreal-orm` Support | Notes                                                                                    |
| ------------------------------------ | ------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------- |
| Basic Index Definition               | `DEFINE INDEX user_email ON user COLUMNS email;`        | ✅ **Supported**     | `Table.define({ indexes: { user_email: { fields: ['email'] } } })`                       |
| `IF NOT EXISTS` (Index-level)        | `DEFINE INDEX user_email ON user IF NOT EXISTS ...;`    | ❌ **Not Supported** | ORM regenerates the whole schema.                                                        |
| `OVERWRITE` (Index-level)            | `DEFINE INDEX user_email ON user OVERWRITE ...;`        | ❌ **Not Supported** | ORM regenerates the whole schema.                                                        |
| `UNIQUE` Index                       | `DEFINE INDEX user_email ON user COLUMNS email UNIQUE;` | ✅ **Supported**     | `Index.define(() => User, { fields: ['email'], unique: true })`                          |
| `SEARCH ANALYZER` (Full-Text Search) | `DEFINE INDEX ... SEARCH ANALYZER ... BM25 HIGHLIGHTS;` | ✅ **Supported**     | Use the `analyzer` option in `Index.define`. Other keywords like `BM25` are not exposed. |
| Vector Index (`MTREE`, `HNSW`)       | `DEFINE INDEX ... MTREE DIMENSION ...;`                 | ❌ **Not Supported** |                                                                                          |
| `COMMENT @string`                    | `DEFINE INDEX user_email ON user ... COMMENT '...';`    | ✅ **Supported**     | Use the `comment` option in `Index.define`.                                              |
| `CONCURRENTLY`                       | `DEFINE INDEX user_email ON user ... CONCURRENTLY;`     | ❌ **Not Supported** |                                                                                          |

## Other `DEFINE` Statements

`unreal-orm` primarily focuses on schema generation for tables, fields, and indexes. Other `DEFINE` statements are not yet supported by the ORM.

| Feature            | SurrealDB Syntax Example         | `unreal-orm` Support | Notes                                     |
| ------------------ | -------------------------------- | -------------------- | ----------------------------------------- |
| `DEFINE NAMESPACE` | `DEFINE NAMESPACE test;`         | ❌ **Not Supported** | Operates within a given DB/NS connection. |
| `DEFINE DATABASE`  | `DEFINE DATABASE test;`          | ❌ **Not Supported** |                                           |
| `DEFINE USER`      | `DEFINE USER ...;`               | ❌ **Not Supported** |                                           |
| `DEFINE TOKEN`     | `DEFINE TOKEN ...;`              | ❌ **Not Supported** |                                           |
| `DEFINE SCOPE`     | `DEFINE SCOPE ...;`              | ❌ **Not Supported** |                                           |
| `DEFINE ANALYZER`  | `DEFINE ANALYZER ...;`           | ❌ **Not Supported** |                                           |
| `DEFINE EVENT`     | `DEFINE EVENT ... ON TABLE ...;` | ❌ **Not Supported** |                                           |
| `DEFINE FUNCTION`  | `DEFINE FUNCTION fn::abc() ...;` | ❌ **Not Supported** |                                           |
| `DEFINE PARAM`     | `DEFINE PARAM $myparam ...;`     | ❌ **Not Supported** |                                           |

## Data Type Support

### Field Definition Examples

```ts
import { surql } from "surrealdb";
import { Table, Field } from "unreal-orm";

class User extends Table.normal({
  name: "user",
  schemafull: true,
  fields: {
    name: Field.string({ assert: surql`$value.length > 2` }),
    age: Field.number({ assert: surql`$value >= 0`, default: surql`0` }),
    isActive: Field.bool({ default: surql`true` }),
    createdAt: Field.datetime({ default: surql`time::now()` }),
    profile: Field.object({
      bio: Field.string(),
      website: Field.option(Field.string()),
    }),
    tags: Field.array(Field.string(), { max: 10 }),
    posts: Field.array(Field.record(() => Post)),
    nickname: Field.option(Field.string()),
    // Advanced Types
    balance: Field.decimal(),
    apiKey: Field.uuid(),
    lastLogin: Field.duration(),
    avatar: Field.bytes(),
    location: Field.geometry("point"),
    side: Field.custom<"left" | "right">('"left" | "right"'),
  },
}) {}

// Define indexes separately
const UserNameIndex = Index.define(() => User, {
  name: "user_name_idx",
  fields: ["name"],
  unique: true,
});
```
