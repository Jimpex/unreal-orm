# UnrealORM Design Principles

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
// GOOD: Using SurrealQL's native time::now() function
const User = Table.define({
    createdAt: Field.datetime({ default: 'time::now()' })
});

// BAD: Adding ORM-level computation
const User = Table.define({
    createdAt: Field.datetime({ defaultNow: true }) // Don't add this kind of abstraction
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
    onDelete?: 'cascade' | 'restrict' | 'no action';
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
// GOOD: Direct use of SurrealQL with type-safe parameters
const adults = await User.find(db, {
    where: "age >= $minAge",
    orderBy: [{ field: "age", order: "DESC" }]
}, { minAge: 18 });

// BAD: ORM-specific query abstractions
const adults = await User.where()
    .ageGreaterThan(18)
    .orderByAgeDesc()
    .find();
```

### 4. Schema Definition
- **DO** provide a direct mapping to SurrealDB's schema capabilities
- **DO** expose all SurrealQL field types and options
- **DON'T** add ORM-specific field types
- **DON'T** create schema features that can't be represented in SurrealDB

Example:
```typescript
// GOOD: Direct mapping to SurrealDB field types and options
const Product = Table.define({
    name: Field.string({
        assert: 'string::len($value) > 0',
        value: 'string::trim($value)'
    }),
    price: Field.number({
        assert: '$value >= 0'
    })
});

// BAD: ORM-specific validations or transformations
const Product = Table.define({
    name: Field.string({
        transform: (value) => value.trim(), // Don't add client-side transforms
        validate: (value) => value.length > 0 // Don't add client-side validation
    })
});
```

### 5. Record Links and References
- **DO** use SurrealDB's native record linking capabilities
- **DO** support SurrealDB's reference tracking feature
- **DON'T** implement custom relationship management
- **DON'T** add client-side join operations

Example:
```typescript
// GOOD: Using native record links and references
const Post = Table.define({
    author: Field.record({
        table: User,
        reference: true,
        onDelete: 'cascade'
    })
});

// BAD: Custom relationship handling
const Post = Table.define({
    authorId: Field.string(),
    getAuthor: async () => { /* Don't add custom fetching logic */ }
});
```

### 6. Error Handling
- **DO** pass through SurrealDB's native errors
- **DO** add TypeScript type information to errors
- **DON'T** wrap or transform database errors
- **DON'T** add ORM-specific error types

Example:
```typescript
// GOOD: Pass through native errors with types
try {
    await User.create(db, data);
} catch (error) {
    // Error comes directly from SurrealDB
    throw error;
}

// BAD: Wrapping errors
try {
    await User.create(db, data);
} catch (error) {
    // Don't wrap or transform errors
    throw new ORMError('Failed to create user', error);
}
```

### 7. Query Building and Type Safety
- **DO** provide type-safe query builders that directly mirror SurrealDB's query syntax and capabilities
- **DO** use the same terminology and concepts as SurrealDB's documentation
- **DO** allow raw SurrealQL queries for advanced use cases
- **DON'T** create query abstractions that deviate from SurrealDB's query model
- **DON'T** hide or rename SurrealDB's query capabilities for the sake of "simplification"

Example:
```typescript
// GOOD: Type-safe builder that mirrors SurrealQL syntax
const users = await User.find(db, {
    // Future: Type-safe WHERE builder that uses SurrealQL syntax
    where: where => where.field('age').gte('$minAge'),
    // Future: Type-safe SELECT builder
    select: select => select.fields(['name', 'email']),
    orderBy: [{ field: "age", order: "DESC" }],
    limit: 10
}, { minAge: 18 });

// GOOD: Custom query methods that preserve SurrealQL patterns
class User extends BaseUser {
    static async findByEmail(db: Surreal, email: string) {
        return (await User.find(db, { 
            where: 'email = $email', 
            limit: 1 
        }, { email }))[0];
    }
}

// BAD: Query builder that invents its own syntax
const users = await User.query()
    .whereAge.greaterThan(18) // Don't create custom syntax
    .orderByDesc('age')       // Don't rename SurrealDB concepts
    .find();

// BAD: Hiding SurrealQL capabilities
class User extends BaseUser {
    static async search(db: Surreal, text: string) {
        // Don't hide or abstract away SurrealQL's text search capabilities
        return User.find(db, {
            where: `search::fuzzy(name, "${text}")` 
        });
    }
}
```

When implementing type-safe query builders:
1. Follow SurrealDB's query syntax and naming exactly
2. Expose all SurrealQL capabilities without abstraction
3. Allow falling back to raw SurrealQL when needed
4. Keep the mental model aligned with SurrealDB's documentation
5. Focus on type safety without sacrificing native capabilities

### 8. Class Extension and Custom Methods
- **DO** allow extending generated table classes with custom methods
- **DO** maintain full type inference in extended classes
- **DON'T** create methods that bypass SurrealDB operations
- **DON'T** add complex client-side data transformations

Example:
```typescript
// GOOD: Type-safe extension with custom methods
class User extends BaseUser {
    // Custom query method using native SurrealQL
    static async findAdults(db: Surreal) {
        return User.find(db, {where: 'age >= 18'});
    }

    // Simple computed property
    isAdult(): boolean {
        return (this.age ?? 0) >= 18;
    }
}

// BAD: Methods that bypass or abstract SurrealDB
class User extends BaseUser {
    // Don't implement custom caching
    static async findWithCache(db: Surreal) {
        if (cache.has('users')) return cache.get('users');
        const users = await this.find(db);
        cache.set('users', users);
        return users;
    }

    // Don't add complex client-side transformations
    async updateWithValidation(db: Surreal, data: UserData) {
        // Complex client-side validation and transformation
        const validated = await validateAndTransform(data);
        return this.update(db, validated);
    }
}
```

## Benefits of These Principles

1. **Predictability**: Developers familiar with SurrealDB can easily understand and use the ORM
2. **Performance**: No additional overhead from unnecessary abstractions
3. **Maintainability**: Changes in SurrealDB can be quickly reflected in the ORM
4. **Learning Curve**: Developers learn SurrealDB's concepts directly while using the ORM
5. **Flexibility**: All of SurrealDB's features remain accessible and usable
6. **Type Safety**: Full TypeScript type inference without runtime overhead
7. **Extensibility**: Easy to extend with custom methods while maintaining native capabilities

## When to Break These Principles

These principles should only be broken when:
1. There is a critical type-safety feature that requires additional abstraction
2. SurrealDB has a documented limitation that must be worked around
3. There is a significant developer experience improvement that justifies the abstraction

Any deviation should be:
- Well documented
- Optional (with the direct approach still available)
- Discussed with the community
- Carefully considered against the long-term maintainability of the ORM
