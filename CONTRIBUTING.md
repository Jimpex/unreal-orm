# Contributing to unreal-orm

Thank you for your interest in contributing to unreal-orm! This document provides guidelines and instructions to make the contribution process smooth and effective.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Project Philosophy](#project-philosophy)
- [Development Environment Setup](#development-environment-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)
- [Coding Guidelines](#coding-guidelines)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

Please be respectful and considerate of others when contributing to this project. We are committed to providing a welcoming and inclusive environment for everyone.

## Project Philosophy

unreal-orm is designed to provide a type-safe interface to SurrealDB while staying as close as possible to SurrealDB's native capabilities. Before contributing, please read our [Design Principles](./packages/unreal-orm/src/DESIGN_PRINCIPLES.md) to understand the project's approach and goals.

Key principles include:
- **Native First**: Expose SurrealDB features directly, don't abstract them away
- **Type Safety Without Overhead**: Use TypeScript for developer experience, not runtime checks
- **Query Building**: Allow direct SurrealQL usage with type safety
- **Schema Definition**: Direct mapping to SurrealDB's schema capabilities

## Development Environment Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [pnpm](https://pnpm.io/) (v8 or higher)
- [Bun](https://bun.sh/) (for testing)
- [SurrealDB](https://surrealdb.com/) (for integration tests)

### Installation

1. Fork and clone the repository
   ```bash
   git clone https://github.com/jimpex/unreal-orm.git
   cd unreal-orm
   ```

2. Install dependencies
   ```bash
   pnpm install
   ```

3. Build the project
   ```bash
   pnpm run build
   ```

4. Run tests (bun required)
   ```bash
   pnpm run test
   ```

## Project Structure

unreal-orm is organized as a pnpm monorepo with the following structure:

```
unreal-orm/
├── apps/                  # Applications
│   └── docs/              # Documentation site (Astro + Starlight)
├── packages/              # Packages
│   └── unreal-orm/        # Main library package
│       ├── src/           # Source code
│       └── tests/         # Tests
```

## Development Workflow

1. Create a new branch for your feature/fix
   ```bash
   git checkout -b feature/your-feature-name
   ```
   
2. Make your changes and ensure tests pass
   ```bash
   pnpm run test
   ```

3. Update documentation as needed

4. Commit your changes with a descriptive message
   ```bash
   git commit -m "feat: add new feature" 
   ```

5. Push to your fork and submit a pull request

## Pull Request Process

1. Ensure your PR addresses a specific issue or has a clear purpose
2. Update relevant documentation
3. Add or update tests as needed
4. Follow the coding guidelines
5. Make sure all tests pass
6. Request review from maintainers

### Commit Message Format

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

Common types:
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code changes that neither fix bugs nor add features
- `test`: Adding or updating tests
- `chore`: Changes to the build process or auxiliary tools

## Coding Guidelines

### Code Style

- Use TypeScript for all source files
- Follow the established code style (enforced by the project's linter)
- Write clear, descriptive variable and function names
- Use JSDoc comments for public APIs

### Type Safety

- Prioritize type-safety and avoid `any` types when possible
- Use TypeScript's type inference where appropriate
- Document complex types with JSDoc comments

### API Design

- Follow the project's design principles
- Keep APIs consistent with existing patterns
- Prioritize developer experience without abstractions

## Testing

- All new features should include tests
- Run tests with `pnpm run test`
- Integration tests should use the embedded SurrealDB instance
- Ensure tests are deterministic and don't rely on external services

## Documentation

- Update documentation for any changed functionality
- Document public APIs with JSDoc comments
- Include examples for new features
- Keep the [CAPABILITIES.md](./packages/unreal-orm/CAPABILITIES.md) document up to date

Thank you for contributing to unreal-orm!
