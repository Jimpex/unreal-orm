<p align="center">
  <img src="https://raw.githubusercontent.com/jimpex/unreal-orm/main/logo.svg" alt="Unreal ORM Logo" height="100" />
</p>

<div align="center">

[![GitHub Stars](https://img.shields.io/github/stars/Jimpex/unreal-orm?style=social)](https://github.com/Jimpex/unreal-orm)
[![npm version](https://badge.fury.io/js/unreal-orm.svg)](https://www.npmjs.com/package/unreal-orm)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![npm downloads](https://img.shields.io/npm/dm/unreal-orm)](https://www.npmjs.com/package/unreal-orm)
![npm bundle size](https://img.shields.io/bundlephobia/min/unreal-orm)
![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Ko--fi-ff5f5f?logo=ko-fi&logoColor=white)](https://ko-fi.com/jimpex)

</div>

<div align="center">
  <a href="https://unreal-orm.jimpex.dev"><b>Documentation</b></a> •
  <a href="https://unreal-orm.jimpex.dev/guides/unreal-orm-tutorial"><b>Hands-on Tutorial</b></a> •
  <a href="https://github.com/Jimpex/unreal-orm"><b>GitHub</b></a> •
  <a href="https://github.com/Jimpex/unreal-orm/discussions"><b>GitHub Discussions</b></a> •
  <a href="https://ko-fi.com/jimpex"><b>Buy Me a Coffee</b></a>
</div>

<br><br>

# What's UnrealORM?

UnrealORM is a modern, type-safe ORM for SurrealDB that gives you native SurrealDB power, full TypeScript safety, and zero abstraction—no decorators, no magic, just classes and functions. Designed for developers who want direct control, advanced schema features, and a frictionless experience.

**Why UnrealORM?**
I created this package because I wanted something like it for my own projects. Building UnrealORM gave me the perfect excuse to spend more time crafting an even better, reusable solution for the community.

> **Note:** This is UnrealORM 1.0.0 alpha 1, built to support SurrealDB's 2.0 alpha SDK. While the API is stabilizing, please be aware that some changes may still occur before the final 1.0 release.

## Core Philosophy

UnrealORM aims to provide a powerful and intuitive way to interact with SurrealDB in TypeScript projects. Our goal is to leverage TypeScript's type safety and developer ergonomics without abstracting away the underlying power and flexibility of SurrealDB. We believe in a "native first" approach, ensuring that you can always access SurrealDB's full feature set.

## Key Features

- **Native First**: Exposes SurrealDB's native features and SurrealQL directly. No heavy abstractions.
- **Type Safety**: Comprehensive TypeScript types for SurrealDB features, tables, fields, and query results.
- **Modern JavaScript**: Designed with ESNext features and module systems in mind.
- **Schema Definition**: Intuitive API for defining tables, fields, indexes, and relationships that map directly to SurrealDB's schema capabilities.
- **Query Building (Lightweight)**: Supports direct SurrealQL with type-safe parameters.
- **Developer Experience**: Aims to make working with SurrealDB in TypeScript a pleasant and productive experience.
- **SurrealDB Feature Support**: For a detailed breakdown of supported SurrealDB 2.x schema features, please see our [CAPABILITIES.md](https://unreal-orm.jimpex.dev/package/capabilities/) document.

## New Features in UnrealORM 1.0.0 alpha

🔧 **SurrealDB SDK 2 Alpha Support**: Updated to use SurrealDB JavaScript SDK 2 alpha, providing compatibility with both SurrealDB v2 and v3.

🚀 **Client-side Transactions Support**: Execute atomic operations across multiple records and tables.

> **Note:** Client-side transactions are only supported in SurrealDB v3 (alpha).

```ts
// Start a transaction
const tx = await db.beginTransaction();

try {
  // Create user and post in the same transaction
  const user = await User.create(tx, {
    name: "Alice",
    email: "alice@example.com",
  });
  const post = await Post.create(tx, { title: "Hello World", author: user.id });

  // Commit if everything succeeds
  await tx.commit();
} catch (error) {
  // Rollback on any error
  await tx.cancel();
  throw error;
}
```

🎯 **Enhanced Update API**: Explicit update modes for better control and type safety.

```ts
// Full content replacement
await user.update(db, {
  data: { name: "Jane", email: "jane@example.com" },
  mode: "content",
});

// Partial merge (replaces old .merge() method)
await user.update(db, {
  data: { name: "Jane" },
  mode: "merge",
});

// JSON Patch operations
await user.update(db, {
  data: [{ op: "replace", path: "/name", value: "Jane" }],
  mode: "patch",
});
```

✨ **Surql and Expressions**: Functional expressions and surql templates

```ts
import { surql, and, eq, gte } from "surrealdb";

// Field validation with functional expressions
age: Field.number({ assert: and(gte(18), lte(120)) }),

// Dynamic queries
const age = 18;
const users = await User.select(db, {
  // using Expr api
  where: and(eq("active", true), gte("age", age)),
  // using surql template
  where: surql`active = true AND age >= ${age}`,
  // or both!
  where: surql`${eq("active", true)} AND age >= ${age}`,
});
```

📖 **Migration Guide**: Upgrading to UnrealORM 1.0.0 alpha? See our [Migration Guide](https://unreal-orm.jimpex.dev/getting-started/migrating-to-100-alpha) for detailed upgrade instructions.

## unreal-orm vs. surrealdb package

A direct comparison between unreal-orm and the official [surrealdb](https://www.npmjs.com/package/surrealdb) Node.js driver:

|                           | **unreal-orm**                                       | **surrealdb package**                          |
| ------------------------- | ---------------------------------------------------- | ---------------------------------------------- |
| **Type Safety**           | ✅ Strong TypeScript types for models/queries        | ⚠️ Partial (manual, not enforced)              |
| **Schema Sync**           | ✅ Models and schema stay in sync                    | ❌ No schema management                        |
| **Model Logic**           | ✅ Add type-safe instance/static methods to models   | ❌ No model abstraction                        |
| **Migrations**            | ✅ Easy schema DDL/apply from code                   | ❌ Manual DDL, risk of drift                   |
| **Relations**             | ✅ Fully typed, hydrated relations                   | ⚠️ Supported, manual type-safety               |
| **Query Ergonomics**      | ✅ Type-safe, object-oriented, and SurrealQL support | ⚠️ Raw SurrealQL or data objects—not type-safe |
| **Raw SurrealQL Support** | ✅ Use raw SurrealQL when needed                     | ✅ Full SurrealQL access                       |
| **Error Handling**        | ✅ Native SurrealDB errors, no ORM wrappers          | ✅ Native SurrealDB errors                     |

> UnrealORM builds on top of the official surrealdb package, providing a modern TypeScript ORM experience while preserving full access to SurrealDB's native features.

## Installation

Install `unreal-orm` using your favorite package manager:

```bash
# Using pnpm
pnpm add unreal-orm@alpha surrealdb typescript

# Using npm
npm install unreal-orm@alpha surrealdb typescript

# Using yarn
yarn add unreal-orm@alpha surrealdb typescript

# Using bun
bun add unreal-orm@alpha surrealdb typescript
```

_Note: `surrealdb` and `typescript` are peer dependencies._

## Quick Blog API in 30 seconds

```ts
import { Surreal, surql } from "surrealdb";
import { surrealdbNodeEngines } from "@surrealdb/node";
import Table, { Field, Index, applySchema } from "unreal-orm";

// Define a User model
class User extends Table.normal({
  name: "user",
  fields: {
    name: Field.string(),
    email: Field.string({
      assert: surql`$value CONTAINS "@"`,
      default: surql`"unknown@example.com"`,
    }),
  },
}) {
  // Add custom methods directly to the class
  getDisplayName() {
    return `${this.name} <${this.email}>`;
  }
}

// Define a Post model with a relation to User
class Post extends Table.normal({
  name: "post",
  fields: {
    title: Field.string({ default: surql`"Untitled"` }),
    content: Field.string(),
    author: Field.record(() => User), // Link to the User table
  },
}) {}

// Define a unique index on the user's email
const UserEmailIndex = Index.define(() => User, {
  name: "user_email_idx",
  fields: ["email"],
  unique: true,
});

async function main() {
  const db = new Surreal({ engines: surrealdbNodeEngines() });
  await db.connect("mem://");
  await db.use({ namespace: "demo", database: "demo" });

  // Generate and apply schema for all models and indexes
  await applySchema(db, [User, Post, UserEmailIndex]);

  // Create a user and a post
  const alice = await User.create(db, {
    name: "Alice",
    email: "alice@example.com",
  });
  const post = await Post.create(db, {
    title: "Getting Started",
    content: "This is how you use Unreal-ORM!",
    author: alice.id, // Link the post to Alice
  });

  // Fetch the post and its author in one query
  const fetchedPost = await Post.select(db, {
    from: post.id,
    only: true,
    fetch: ["author"], // Hydrate the 'author' field
  });

  // Use the hydrated, type-safe data
  console.log(`Post: "${fetchedPost?.title}"`);
  console.log(`Author: ${fetchedPost?.author.getDisplayName()}`);

  await db.close();
}

main();
```

▶️ For a full step-by-step build (users, posts, comments, relations) read the [Hands-on Tutorial](https://unreal-orm.jimpex.dev/guides/unreal-orm-tutorial).

> See [Capabilities](https://unreal-orm.jimpex.dev/getting-started/capabilities/) for all supported field options, validation, and SurrealDB mappings.

## Documentation

For more detailed information, API reference, and advanced usage, visit the [UnrealORM documentation](https://unreal-orm.jimpex.dev/).

- [Getting Started](https://unreal-orm.jimpex.dev/getting-started/readme/)
- [Capabilities](https://unreal-orm.jimpex.dev/getting-started/capabilities/)
- [Contributing Guide](https://unreal-orm.jimpex.dev/contributing/guide/)
- [Design Principles](https://unreal-orm.jimpex.dev/contributing/design-principles/)
- [API Reference](https://unreal-orm.jimpex.dev/api/)

## Contributing

We welcome contributions of all kinds!  
Please read our [Contributing Guide](https://unreal-orm.jimpex.dev/contributing/guide/) for how to get started, coding standards, and guidelines.

If you have questions, ideas, or want to discuss improvements, join our [GitHub Discussions](https://github.com/Jimpex/unreal-orm/discussions).

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
