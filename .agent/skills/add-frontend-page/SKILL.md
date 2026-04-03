---
name: add-frontend-page
description: Create a new frontend page with routing, API integration, and TanStack Query hooks
---

# Add Frontend Page

Create a new route-level page under `packages/frontend/src/pages/<domain>/`.

## Steps

### 1. API module (`src/api/<domain>.ts`)

```ts
import type {
  EntitySummary,
  EntityDetail,
  CreateEntityInput
} from '@agent-workbench/shared';
import { apiClient } from './client';

export async function listEntities() {
  const response = await apiClient.get<EntitySummary[]>('/entities');
  return response.data;
}

export async function getEntity(id: string) {
  const response = await apiClient.get<EntityDetail>(`/entities/${id}`);
  return response.data;
}

export async function createEntity(payload: CreateEntityInput) {
  const response = await apiClient.post<EntityDetail>('/entities', payload);
  return response.data;
}
```

### 2. Query keys (`src/query/query-keys.ts`)

```ts
entities: {
  all: ['entities'] as const,
  list: (search?: string) =>
    ['entities', 'list', normalizeSearchValue(search)] as const,
  detail: (id: string) => ['entities', 'detail', id] as const,
},
```

### 3. TanStack Query hooks (`src/features/<domain>/hooks/`)

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../query/query-keys';
import { listEntities, createEntity } from '../../../api/entities';

export function useEntities() {
  return useQuery({
    queryKey: queryKeys.entities.list(),
    queryFn: listEntities
  });
}

export function useCreateEntityMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createEntity,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entities.all });
    }
  });
}
```

### 4. Page component (`src/pages/<domain>/EntityListPage.tsx`)

Every page must handle four states:

```tsx
export function EntityListPage() {
  const { data, isLoading, error } = useEntities();

  if (isLoading) return <RouteFallback />; // loading
  if (error) return <ErrorState error={error} />; // error
  if (!data?.length) return <EmptyState />; // empty

  return <div>{/* success content */}</div>;
}
```

### 5. Route (`src/App.tsx`)

```tsx
const EntityListPage = lazy(() =>
  import('./pages/entities/EntityListPage').then((m) => ({
    default: m.EntityListPage
  }))
);

// Inside <Routes>
<Route
  path="/entities"
  element={
    <LazyRoute>
      <EntityListPage />
    </LazyRoute>
  }
/>;
```

### 6. Sidebar navigation

Add link in `src/layout/AppLayout.tsx`.

### 7. Feature sub-components (if complex)

```
src/features/<domain>/
  components/     reusable business components
  hooks/          domain-specific TanStack Query hooks
  panels/         slide-out or modal panels
```

## Anti-patterns

```ts
// BAD: server data in useState
const [items, setItems] = useState([]);
useEffect(() => {
  fetchItems().then(setItems);
}, []);

// GOOD: server data via TanStack Query
const { data: items } = useEntities();
```

```ts
// BAD: API call in page component
const response = await apiClient.get('/entities');

// GOOD: API call in dedicated module
import { listEntities } from '../api/entities';
```

## Verification

1. `pnpm build` — type-check passes
2. Navigate to the new route in browser
3. Verify loading → data render flow
4. Verify error state (stop backend, reload page)

## Checklist

- [ ] API module in `src/api/`
- [ ] Query keys in `query/query-keys.ts`
- [ ] TanStack Query hooks created
- [ ] Page handles loading / empty / error / success
- [ ] Route in `App.tsx` with lazy loading
- [ ] Sidebar navigation added
