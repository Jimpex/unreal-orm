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

> **Note:** UnrealORM is not at version 1.0 yet. While the API is stabilizing and major breaking changes are unlikely, please be aware that some changes may still occur before the 1.0 release.

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

> UnrealORM builds on top of the official surrealdb package, providing a modern TypeScript ORM experience while preserving full access to SurrealDB's native features.

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

## Quick Blog API in 30 seconds

```ts
import { Surreal } from 'surrealdb';
import { surrealdbNodeEngines } from '@surrealdb/node';
import Table, { Field, applySchema } from 'unreal-orm';

class Post extends Table.normal({
  name: 'post',
  fields: {
    title: Field.string({ default: "'Untitled'", assert: '$value.length > 3' }),
    content: Field.string({ comment: 'Markdown allowed' }),
  },
}) {
  summary() {
    return `${this.title}: ${this.content.slice(0, 30)}…`;
  }
}

class Comment extends Table.normal({
  name: 'comment',
  fields: {
    post: Field.record(() => Post),
    body: Field.string({ assert: '$value.length > 1' }),
  },
}) {}

async function main() {
  const db = new Surreal({ engines: surrealdbNodeEngines() });
  await db.connect('mem://');
  await db.use({ namespace: 'demo', database: 'demo' });

  await applySchema(db, [Post, Comment]);
  const post = await Post.create(db, { title: 'Hello World', content: 'My first post' });
  await Comment.create(db, { post: post.id, body: 'Great read!' });
  const comments = await Comment.select(db, { fetch: ['post'] });
  console.log(comments[0].post.summary()); // hydrated post in comment
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
