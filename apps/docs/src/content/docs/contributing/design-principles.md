---
title: Design Principles
description: Guiding philosophy and design rules for the unreal-orm codebase and API.
---

:::tip
Follow these principles to ensure your usage and contributions align with the project's goals.
:::

## Core Philosophy

UnrealORM is designed to provide a type-safe interface to SurrealDB while staying as close as possible to SurrealDB's native capabilities. Our goal is to enhance the developer experience through TypeScript types and builder patterns without abstracting away from SurrealDB's powerful features.

## Key Principles

### 1. Native First

- **DO** expose SurrealDB's native features directly
- **DO** use SurrealQL expressions for computations and mutations
- **DON'T** create abstractions that hide or replace SurrealDB's native capabilities
- **DON'T** add computed fields or transformations at the ORM level

Example:

```typescript
import { surql } from "surrealdb";

// GOOD: Using SurrealQL's native time::now() function
const User = Table.normal({
  createdAt: Field.datetime({ default: surql`time::now()` }),
});

// BAD: Adding ORM-level computation
const User = Table.normal({
  createdAt: Field.datetime({ defaultNow: true }), // Don't add this kind of abstraction
});
```

### 2. Type Safety Without Overhead

- **DO** provide TypeScript types for all SurrealDB features
- **DO** use type inference to improve developer experience
- **DON'T** add runtime type checking or validation
- **DON'T** create complex type hierarchies that don't map to SurrealDB concepts

Example:

```typescript
// GOOD: Types that directly map to SurrealDB concepts
interface RecordLinkOptions {
  table: typeof Table;
  reference?: boolean;
  onDelete?: "cascade" | "restrict" | "no action";
}

// BAD: Complex abstractions that don't map to SurrealDB
interface ComputedFieldOptions {
  compute: (record: any) => any; // Don't add client-side computation
}
```

### 3. Query Building

- **DO** allow direct use of SurrealQL in queries
- **DO** provide type-safe parameters for queries
- **DON'T** create a query builder that abstracts away SurrealQL
- **DON'T** add ORM-specific query operations

Example:

```typescript
import { surql, gte } from "surrealdb";

// GOOD: Direct use of SurrealQL with type-safe parameters
const adults = await User.select(db, {
  where: surql`age >= ${18}`,
  // or using expressions
  where: gte("age", 18),
  order: [{ field: "age", direction: "DESC" }],
});

// BAD: ORM-specific query abstractions
const adults = await User.where().ageGreaterThan(18).orderByAgeDesc().find();
```

### 4. Schema Definition

- **DO** provide a direct mapping to SurrealDB's schema capabilities
- **DO** expose all SurrealQL field types and options
- **DON'T** add ORM-specific field types
- **DON'T** create schema features that can't be represented in SurrealDB

Example:

```typescript
import { surql } from "surrealdb";

// GOOD: Direct mapping to SurrealDB field types and options
const Product = Table.normal({
  name: Field.string({
    assert: surql`string::len($value) > 0`,
    value: surql`string::trim($value)`,
  }),
  price: Field.number({
    assert: surql`$value >= 0`,
  }),
});

// BAD: ORM-specific validations or transformations
const Product = Table.normal({
  name: Field.string({
    transform: (value) => value.trim(), // Don't add client-side transforms
    validate: (value) => value.length > 0, // Don't add client-side validation
  }),
});
```

### 5. Record Links and References

- **DO** use SurrealDB's native record linking capabilities
- **DO** support SurrealDB's reference tracking feature
