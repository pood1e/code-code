import { Fragment, Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { AgentRunnerListPage } from './pages/agent-runners/AgentRunnerListPage';
import { ProjectListPage } from './pages/projects/ProjectListPage';
import { ProfilesPage } from './pages/profiles/ProfilesPage';
import { ResourceListPage } from './pages/resources/ResourceListPage';
import { Skeleton } from './components/ui/skeleton';
import { AppLayout } from './layout/AppLayout';
import {
  agentRunnerConfig,
  buildAgentRunnerCreatePath,
  buildAgentRunnerEditPath
} from './types/agent-runners';
import { profileConfig, buildProfileEditPath } from './types/profiles';
import { projectRoutePatterns } from './types/projects';
import {
  buildResourceCreatePath,
  buildResourceEditPath,
  resourceConfigMap,
  resourceKinds
} from './types/resources';

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
          path={projectRoutePatterns.config}
          element={
            <LazyRoute>
              <ProjectConfigPage />
            </LazyRoute>
          }
        />
        <Route
          path={projectRoutePatterns.dashboard}
          element={
            <LazyRoute>
              <ProjectDashboardPage />
            </LazyRoute>
          }
        />
        <Route
          path={projectRoutePatterns.sessions}
          element={
            <LazyRoute>
              <ProjectSessionsPage />
            </LazyRoute>
          }
        />
        <Route
          path={projectRoutePatterns.sessionDetail}
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
              path={buildResourceCreatePath(kind)}
              element={
                <LazyRoute>
                  <ResourceEditPage kind={kind} />
                </LazyRoute>
              }
            />
            <Route
              path={buildResourceEditPath(kind, ':id')}
              element={
                <LazyRoute>
                  <ResourceEditPage kind={kind} />
                </LazyRoute>
              }
            />
          </Fragment>
        ))}
        <Route
          path={profileConfig.path}
          element={
            <LazyRoute>
              <ProfilesPage />
            </LazyRoute>
          }
        />
        <Route
          path={buildProfileEditPath(':id')}
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
          path={buildAgentRunnerCreatePath()}
          element={
            <LazyRoute>
              <AgentRunnerEditorPage />
            </LazyRoute>
          }
        />
        <Route
          path={buildAgentRunnerEditPath(':id')}
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
