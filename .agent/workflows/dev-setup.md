---
description: Start development servers and reset the database
---

# Dev Setup

// turbo-all

1. Install dependencies:

```bash
pnpm install
```

2. Copy environment file if absent:

```bash
cp -n packages/backend/.env.example packages/backend/.env 2>/dev/null || true
```

3. Reset database with migrations and seed data:

```bash
pnpm --filter @agent-workbench/backend prisma migrate reset --force
```

4. Start all dev servers (frontend + backend + shared in watch mode):

```bash
pnpm dev
```

After startup:

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000/api
- Swagger: http://localhost:3000/api/docs
