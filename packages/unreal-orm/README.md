<p align="center">
  <img src="https://raw.githubusercontent.com/jimpex/unreal-orm/main/logo.svg" alt="Unreal ORM Logo" height="100" />
</p>

<div align="center">

[![GitHub Stars](https://img.shields.io/github/stars/Jimpex/unreal-orm?style=social)](https://github.com/Jimpex/unreal-orm)
[![npm version](https://badge.fury.io/js/unreal-orm.svg)](https://www.npmjs.com/package/unreal-orm)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![npm downloads](https://img.shields.io/npm/dm/unreal-orm)](https://www.npmjs.com/package/unreal-orm)
![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript)

</div>

<div align="center">
  <a href="https://unreal-orm.jimpex.dev"><b>Documentation</b></a> •
  <a href="https://unreal-orm.jimpex.dev/guides/unreal-orm-tutorial"><b>Tutorial</b></a> •
  <a href="https://unreal-orm.jimpex.dev/guides/migrating-to-1.0.0-alpha"><b>Migration Guide</b></a> •
  <a href="https://github.com/Jimpex/unreal-orm/discussions"><b>Discussions</b></a>
</div>

<br>

# UnrealORM

A modern, type-safe ORM for SurrealDB. Native SurrealDB power, full TypeScript safety, zero abstraction—no decorators, no magic, just classes and functions.

UnrealORM builds on top of the official `surrealdb` package, providing a TypeScript ORM experience while preserving full access to SurrealDB's native features. Define your schema once in code, and the ORM handles type inference, DDL generation, and schema synchronization.

> **Note:** UnrealORM 1.0.0-alpha.x requires SurrealDB's 2.0 (alpha) JS SDK. If you're using 1.x of their SDK, install [unreal-orm@0.6.0](https://www.npmjs.com/package/unreal-orm/v/0.6.0) instead. To upgrade, see the [Migration Guide](https://unreal-orm.jimpex.dev/guides/migrating-to-1.0.0-alpha).

## Quick Start

```bash
bunx @unreal-orm/cli init

# Or with other package managers
npx @unreal-orm/cli init
pnpm dlx @unreal-orm/cli init
yarn dlx @unreal-orm/cli init
```

This will:

- Set up your project structure (`unreal/` folder)
- Configure database connection (`surreal.ts`)
- Install dependencies (`unreal-orm`, `surrealdb`, `@unreal-orm/cli`)
- Optionally generate sample tables or import from existing database

<details>
<summary>Manual installation</summary>

```bash
# Using bun
bun add unreal-orm@latest surrealdb@alpha
bun add -D @unreal-orm/cli@latest

# Using pnpm
pnpm add unreal-orm@latest surrealdb@alpha
pnpm add -D @unreal-orm/cli@latest

# Using npm
npm install unreal-orm@latest surrealdb@alpha
npm install -D @unreal-orm/cli@latest

# Using yarn
yarn add unreal-orm@latest surrealdb@alpha
yarn add -D @unreal-orm/cli@latest
```

</details>

## Features

- **Type-safe models** — Define tables as classes with full TypeScript inference for fields, queries, and results
- **Schema sync** — Generate DDL from code with `applySchema()`, or generate code from database with `unreal pull`
- **Relations** — Typed record links with automatic hydration via `fetch`
- **Native SurrealQL** — Use `surql` templates and functional expressions directly in queries and field definitions
- **Indexes** — Define unique, composite, and search indexes with full type safety
- **Custom methods** — Add instance and static methods to your models
- **CLI tools** — `init`, `pull`, `push`, `diff`, `mermaid` for schema management

## Example

```ts
import { Surreal, surql } from "surrealdb";
import Table, { Field, Index, applySchema } from "unreal-orm";

// Define a User model with validation and custom methods
class User extends Table.normal({
  name: "user",
  fields: {
    name: Field.string(),
    email: Field.string({ assert: surql`$value CONTAINS "@"` }),
    createdAt: Field.datetime({ default: surql`time::now()` }),
  },
}) {
  getDisplayName() {
    return `${this.name} <${this.email}>`;
  }
}

// Define a unique index
const idx_user_email = Index.define(() => User, {
  name: "idx_user_email",
  fields: ["email"],
  unique: true,
});

// Define a Post with a relation to User
class Post extends Table.normal({
  name: "post",
  fields: {
    title: Field.string(),
    content: Field.string(),
    author: Field.record(() => User),
  },
}) {}

async function main() {
  const db = new Surreal();
  await db.connect("ws://localhost:8000");
  await db.signin({ username: "root", password: "root" });
  await db.use({ namespace: "test", database: "test" });

  // Apply schema to database
  await applySchema(db, [User, idx_user_email, Post]);

  // Create records
  const user = await User.create(db, {
    name: "Alice",
    email: "alice@example.com",
  });
  const post = await Post.create(db, {
    title: "Hello",
    content: "World",
    author: user.id,
  });

  // Query with hydrated relations
  const result = await Post.select(db, {
    from: post.id,
    only: true,
    fetch: ["author"],
  });
  console.log(result.author.getDisplayName()); // "Alice <alice@example.com>"

  // Update with explicit mode
  await user.update(db, { data: { name: "Alice Smith" }, mode: "merge" });

  await db.close();
}
```

See the [Hands-on Tutorial](https://unreal-orm.jimpex.dev/guides/unreal-orm-tutorial) for a complete walkthrough building a blog API with users, posts, comments, and relations.

## CLI

The CLI helps manage schema synchronization between your code and database:

```bash
unreal init     # Initialize project with connection and sample tables
unreal pull     # Generate TypeScript models from database schema
unreal push     # Apply TypeScript schema to database
unreal diff     # Compare code vs database schema
unreal mermaid  # Generate ERD diagram
unreal view     # Interactive TUI for browsing/editing records
```

After `init`, the CLI is installed as a dev dependency and can be run via `bunx unreal` or `npx unreal`.

## Documentation

- [Getting Started](https://unreal-orm.jimpex.dev/getting-started/readme/) — Installation and setup
- [Hands-on Tutorial](https://unreal-orm.jimpex.dev/guides/unreal-orm-tutorial) — Build a blog API step-by-step
- [Capabilities](https://unreal-orm.jimpex.dev/getting-started/capabilities/) — Supported SurrealDB features
- [API Reference](https://unreal-orm.jimpex.dev/api/) — Full API documentation
- [Migration Guide](https://unreal-orm.jimpex.dev/guides/migrating-to-1.0.0-alpha) — Upgrading from 0.x

## Community

- 💬 [GitHub Discussions](https://github.com/Jimpex/unreal-orm/discussions) — Questions & ideas
- 🐛 [Issues](https://github.com/Jimpex/unreal-orm/issues) — Bug reports
- 🤝 [Contributing](https://unreal-orm.jimpex.dev/contributing/guide/) — How to contribute
- ⭐ [Star on GitHub](https://github.com/jimpex/unreal-orm) — Show support
- ☕ [Ko-fi](https://ko-fi.com/jimpex) — Buy me a coffee

## Author

UnrealORM is created and maintained by [Jimpex](https://jimpex.dev/).

## License

[ISC License](LICENSE)
