<p align="center">
  <img src="https://raw.githubusercontent.com/jimpex/unreal-orm/main/logo.svg" alt="Unreal ORM Logo" height="100" />
</p>

[![npm version](https://badge.fury.io/js/unreal-orm.svg)](https://www.npmjs.com/package/unreal-orm)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Build Status](https://github.com/jimpex/unreal-orm/actions/workflows/ci.yml/badge.svg)](https://github.com/jimpex/unreal-orm/actions/workflows/ci.yml)
[![npm downloads](https://img.shields.io/npm/dm/unreal-orm)](https://www.npmjs.com/package/unreal-orm)
![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript)

# unreal-orm

**unreal-orm** is a modern, type-safe ORM for SurrealDB that gives you native SurrealDB power, full TypeScript safety, and zero abstraction—no decorators, no magic, just classes and functions. Designed for developers who want direct control, advanced schema features, and a frictionless experience.

> **Note:** unreal-orm is not at version 1.0 yet. While the API is stabilizing and major breaking changes are unlikely, please be aware that some changes may still occur before the 1.0 release.

## Core Philosophy

UnrealORM aims to provide a powerful and intuitive way to interact with SurrealDB in TypeScript projects. Our goal is to leverage TypeScript's type safety and developer ergonomics without abstracting away the underlying power and flexibility of SurrealDB. We believe in a "native first" approach, ensuring that you can always access SurrealDB's full feature set.

## Key Features

*   **Native First**: Exposes SurrealDB's native features and SurrealQL directly. No heavy abstractions.
*   **Type Safety**: Comprehensive TypeScript types for SurrealDB features, tables, fields, and query results.
*   **Modern JavaScript**: Designed with ESNext features and module systems in mind.
*   **Schema Definition**: Intuitive API for defining tables, fields, indexes, and relationships that map directly to SurrealDB's schema capabilities.
*   **Query Building (Lightweight)**: Supports direct SurrealQL with type-safe parameters.
*   **Developer Experience**: Aims to make working with SurrealDB in TypeScript a pleasant and productive experience.
*   **SurrealDB Feature Support**: For a detailed breakdown of supported SurrealDB 2.x schema features, please see our [CAPABILITIES.md](https://unreal-orm.jimpex.dev/package/capabilities/) document.

## unreal-orm vs. surrealdb package

A direct comparison between unreal-orm and the official [surrealdb](https://www.npmjs.com/package/surrealdb) Node.js driver:

|                               | **unreal-orm**                                           | **surrealdb package**              |
|-------------------------------|----------------------------------------------------------|------------------------------------|
| **Type Safety**               | ✅ Strong TypeScript types for models/queries             | ⚠️ Partial (manual, not enforced)  |
| **Schema Sync**               | ✅ Models and schema stay in sync                         | ❌ No schema management            |
| **Model Logic**               | ✅ Add type-safe instance/static methods to models        | ❌ No model abstraction            |
| **Migrations**                | ✅ Easy schema DDL/apply from code                        | ❌ Manual DDL, risk of drift       |
| **Relations**                 | ✅ Fully typed, hydrated relations                       | ⚠️ Supported, manual type-safety   |
| **Query Ergonomics**          | ✅ Type-safe, object-oriented, and SurrealQL support      | ⚠️ Raw SurrealQL or data objects—not type-safe |
| **Raw SurrealQL Support**     | ✅ Use raw SurrealQL when needed                          | ✅ Full SurrealQL access           |
| **Error Handling**            | ✅ Native SurrealDB errors, no ORM wrappers               | ✅ Native SurrealDB errors         |

> unreal-orm builds on top of the official surrealdb package, providing a modern TypeScript ORM experience while preserving full access to SurrealDB's native features.

## Installation

Install `unreal-orm` using your favorite package manager:

```bash
# Using pnpm
pnpm add unreal-orm surrealdb typescript

# Using npm
npm install unreal-orm surrealdb typescript

# Using yarn
yarn add unreal-orm surrealdb typescript

# Using bun
bun add unreal-orm surrealdb typescript
```
*Note: `surrealdb` and `typescript` are peer dependencies.*

## Quick Start

### 1. Define a Model

```typescript
import { Table, Field } from 'unreal-orm';

class User extends Table.define({
  name: 'user',
  fields: {
    name: Field.string({ assert: '$value.length > 2' }),
    email: Field.string({ value: 'string::lowercase($value)' }),
    age: Field.option(Field.number()),
  }
}) {
  isAdult() {
    return (this.age ?? 0) >= 18;
  }
}
```

### 2. Create and Query Data

```typescript
import { Surreal } from 'surrealdb';

async function main() {
  const db = new Surreal();
  await db.connect({ ... });
  await db.use({ ns: 'test', db: 'test' });

  // Create a user
  const user = await User.create(db, { name: 'Jane', email: 'Jane@Email.com', age: 30 });

  // Query users
  const users = await User.select(db);
  console.log(users[0].isAdult()); // true

  await db.close();
}
main();
```

> See below for field patterns, relationships, schema generation, and advanced usage.

## Field Patterns & Schema Generation

```typescript
const User = Table.define({
  name: 'user',
  fields: {
    name: Field.string({ assert: '$value.length > 2', comment: 'User name' }),
    tags: Field.array(Field.string(), { max: 10 }),
    posts: Field.array(Field.record((): any => Post)),
    createdAt: Field.datetime({ value: 'time::now()' }),
    customField: Field.custom<number>('duration'),
  }
});

// Generate and apply schema
import { applySchema, generateTableSchemaQl } from 'unreal-orm';
// Generate
const ddl = generateTableSchemaQl(User);
// Or automatically generate & apply
await applySchema(db, [User, Post]);
```
> See [CAPABILITIES.md](./CAPABILITIES.md) for all supported field options, validation, and SurrealDB mappings.


## Documentation

For more detailed information, API reference, and advanced usage, please visit our [full documentation site](https://unreal-orm.jimpex.dev).

## Contributing

Contributions are welcome and appreciated! Please see our [Contributing Guidelines](https://github.com/jimpex/unreal-orm/blob/main/CONTRIBUTING.md) for more details on how to get started.

## Author & Support

unreal-orm is created and maintained by [Jimpex](https://jimpex.dev/). 

If you find this project useful, please consider:

- ⭐ Starring the repository on [GitHub](https://github.com/jimpex/unreal-orm)
- ☕ Supporting the development via [Ko-fi](https://ko-fi.com/jimpex)

Your support helps keep this project active and improving!

## Community & Help

- 💬 **Questions or Ideas?** Join the conversation on our [GitHub Discussions](https://github.com/Jimpex/unreal-orm/discussions)
- 🐛 **Found a bug?** [Open an issue](https://github.com/Jimpex/unreal-orm/issues)
- 🤝 **Want to contribute?** See our [Contributing Guidelines](https://github.com/Jimpex/unreal-orm/blob/main/CONTRIBUTING.md)
- 💡 **Feature requests and feedback are welcome!**
- 📣 **Share your story or project!** Post in [Discussions](https://github.com/Jimpex/unreal-orm/discussions), ping @jimpex on SurrealDB's Discord, or email: contact@jimpex.dev

## License

This project is licensed under the [ISC License](LICENSE).
