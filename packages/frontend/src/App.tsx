import { Fragment, Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { AgentRunnerListPage } from './pages/agent-runners/AgentRunnerListPage';
import { ProjectListPage } from './pages/projects/ProjectListPage';
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
const ProjectConfigPage = lazy(() =>
  import('./pages/projects/ProjectConfigPage').then((module) => ({
    default: module.ProjectConfigPage
  }))
);
const ProjectDashboardPage = lazy(() =>
  import('./pages/projects/ProjectDashboardPage').then((module) => ({
    default: module.ProjectDashboardPage
  }))
);
const ProjectSessionsPage = lazy(() =>
  import('./pages/projects/ProjectSessionsPage').then((module) => ({
    default: module.ProjectSessionsPage
  }))
);
const ResourceEditPage = lazy(() =>
  import('./pages/resources/ResourceEditPage').then((module) => ({
    default: module.ResourceEditPage
  }))
);


function RouteFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-64 rounded-2xl" />
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
        <Route index element={<Navigate to="/projects" replace />} />
        <Route
          path="/projects"
          element={
            <LazyRoute>
              <ProjectListPage />
            </LazyRoute>
          }
        />
        <Route
          path="/projects/:id/config"
          element={
            <LazyRoute>
              <ProjectConfigPage />
            </LazyRoute>
          }
        />
        <Route
          path="/projects/:id/dashboard"
          element={
            <LazyRoute>
              <ProjectDashboardPage />
            </LazyRoute>
          }
        />
        <Route
          path="/projects/:id/sessions"
          element={
            <LazyRoute>
              <ProjectSessionsPage />
            </LazyRoute>
          }
        />
        <Route
          path="/projects/:id/sessions/:sessionId"
          element={
            <LazyRoute>
              <ProjectSessionsPage />
            </LazyRoute>
          }
        />
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
