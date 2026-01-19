# SvelteKit + Supabase Template

A scalable project structure for SvelteKit applications with Supabase, organized into domain-driven "apps" similar to Django's app pattern.

## Quick Start

```bash
npm install
npm run dev      # Start dev server
npm run build    # Production build
npm run check    # TypeScript checking
```

## Documentation

- **[CLAUDE.md](./CLAUDE.md)** — Complete architecture guide, patterns, and examples
- **[docs/PERMISSIONS.md](./docs/PERMISSIONS.md)** — Route permissions pattern for auditable authorization

## Project Structure

```
src/
├── lib/
│   ├── apps/           # Domain modules (schema → entity → service pattern)
│   ├── components/ui/  # shadcn-svelte UI primitives
│   ├── shared/         # Cross-cutting utilities and components
│   └── db/             # Supabase client + auto-generated types
├── routes/             # SvelteKit routes (thin orchestration layer)
└── app.d.ts            # Global type declarations
```

See `src/lib/apps/_example/` for a complete reference implementation.

## When to Create a New App

**Create a new app when:**
- Entities have independent lifecycles (users exist without puzzles)
- The domain could conceptually be a separate product
- Different team members would own the code
- You want to enforce boundaries between domains

**Keep entities in the same app when:**
- They're tightly coupled (checkins require puzzles)
- They share business rules
- They're always queried together
