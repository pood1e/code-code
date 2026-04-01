import { Fragment, Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { AgentRunnerListPage } from './pages/agent-runners/AgentRunnerListPage';
import { ProfilesPage } from './pages/profiles/ProfilesPage';
import { ResourceListPage } from './pages/resources/ResourceListPage';
import { Skeleton } from './components/ui/skeleton';
import { AppLayout } from './layout/AppLayout';
import { agentRunnerConfig } from './types/agent-runners';
import { resourceConfigMap, resourceKinds } from './types/resources';

const AgentRunnerEditorPage = lazy(() =>
  import('./pages/agent-runners/AgentRunnerEditorPage').then((module) => ({
    default: module.AgentRunnerEditorPage
  }))
);
const ProfileEditorPage = lazy(() =>
  import('./pages/profiles/ProfileEditorPage').then((module) => ({
    default: module.ProfileEditorPage
  }))
);
const ResourceEditPage = lazy(() =>
  import('./pages/resources/ResourceEditPage').then((module) => ({
    default: module.ResourceEditPage
  }))
);

function RouteFallback() {
  return (
    <div className="min-h-[32rem] rounded-[calc(var(--radius)*1.6)] border border-border/70 bg-card/80 p-6 shadow-[0_20px_60px_-32px_rgba(15,23,42,0.32)] backdrop-blur">
      <div className="space-y-4">
        <Skeleton className="h-4 w-28 rounded-full" />
        <Skeleton className="h-11 w-72 rounded-2xl" />
        <Skeleton className="h-4 w-full rounded-full" />
        <Skeleton className="h-4 w-5/6 rounded-full" />
        <Skeleton className="h-72 rounded-[calc(var(--radius)*1.2)]" />
      </div>
    </div>
  );
}

function LazyRoute({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/skills" replace />} />
        {resourceKinds.map((kind) => (
          <Fragment key={kind}>
            <Route
              path={resourceConfigMap[kind].path}
              element={
                <LazyRoute>
                  <ResourceListPage kind={kind} />
                </LazyRoute>
              }
            />
            <Route
              path={`${resourceConfigMap[kind].path}/new`}
              element={
                <LazyRoute>
                  <ResourceEditPage kind={kind} />
                </LazyRoute>
              }
            />
            <Route
              path={`${resourceConfigMap[kind].path}/:id/edit`}
              element={
                <LazyRoute>
                  <ResourceEditPage kind={kind} />
                </LazyRoute>
              }
            />
          </Fragment>
        ))}
        <Route
          path="/profiles"
          element={
            <LazyRoute>
              <ProfilesPage />
            </LazyRoute>
          }
        />
        <Route
          path="/profiles/:id/edit"
          element={
            <LazyRoute>
              <ProfileEditorPage />
            </LazyRoute>
          }
        />
        <Route
          path={agentRunnerConfig.path}
          element={
            <LazyRoute>
              <AgentRunnerListPage />
            </LazyRoute>
          }
        />
        <Route
          path={`${agentRunnerConfig.path}/new`}
          element={
            <LazyRoute>
              <AgentRunnerEditorPage />
            </LazyRoute>
          }
        />
        <Route
          path={`${agentRunnerConfig.path}/:id/edit`}
          element={
            <LazyRoute>
              <AgentRunnerEditorPage />
            </LazyRoute>
          }
        />
      </Route>
    </Routes>
  );
}
