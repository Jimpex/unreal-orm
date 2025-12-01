# Unreal ORM Monorepo

Welcome to the Unreal ORM monorepo! This repository contains the source code for the Unreal ORM for SurrealDB, as well as documentation and supporting tools.

> **Looking for the ORM package?**
> See [`packages/unreal-orm/README.md`](packages/unreal-orm/README.md) for detailed usage, API, and design docs for the ORM itself.

This repository is organized as a monorepo, making it easy to develop, test, and document the ORM in one place.

---

## Repository Structure

```
/unreal-orm
├── apps/
│   └── docs/           # Documentation site (Astro)
├── packages/
│   ├── unreal-orm/     # The ORM library source code
│   └── unreal-cli/     # CLI tools for schema management
├── CONTRIBUTING.md     # How to contribute
└── ...
```

---

## Documentation

- [UnrealORM Documentation Site](https://unreal-orm.jimpex.dev/): Full docs, guides, and API reference
- [Getting Started](https://unreal-orm.jimpex.dev/getting-started/readme/): Quickstart, installation, and onboarding
- [Capabilities](https://unreal-orm.jimpex.dev/getting-started/capabilities/): Supported SurrealDB features
- [Design Principles](https://unreal-orm.jimpex.dev/contributing/design-principles/): Project philosophy and technical decisions
- [Contributing Guide](https://unreal-orm.jimpex.dev/contributing/guide/): How to contribute, code style, and submitting issues/PRs
- [API Reference](https://unreal-orm.jimpex.dev/api/): Full API documentation

- **Main ORM package:** See [`packages/unreal-orm/README.md`](packages/unreal-orm/README.md) for usage, API, and details.
- **CLI tools:** See [`packages/unreal-cli/README.md`](packages/unreal-cli/README.md) for schema introspection, diffing, and migrations.
- **Documentation site source:** See [`apps/docs/`](apps/docs/) for the Astro-powered docs.

---

## License

This project is ISC licensed. See [`packages/unreal-orm/LICENSE`](packages/unreal-orm/LICENSE) for full details.
