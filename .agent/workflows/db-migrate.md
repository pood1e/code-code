---
description: Run a Prisma database migration after schema changes
---

# Database Migration

Run after modifying `packages/backend/prisma/schema.prisma`.

// turbo-all

1. Generate and apply migration (provide a descriptive name when prompted, e.g., `add_entity_table`):
```bash
pnpm db:migrate
```

2. Reseed if schema changes affect seed data:
```bash
pnpm db:seed
```

3. For a clean slate (drops DB, re-runs all migrations, re-seeds):
```bash
pnpm --filter @agent-workbench/backend prisma migrate reset --force
```

**Notes:**
- Check generated SQL in `packages/backend/prisma/migrations/` before committing.
- Prisma client is auto-regenerated after migration.
- Running dev server auto-restarts on schema changes.
