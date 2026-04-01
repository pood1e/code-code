import { Fragment, Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Skeleton } from 'antd';

import { AppLayout } from './layout/AppLayout';
import { resourceConfigMap, resourceKinds } from './types/resources';

const ProfilesPage = lazy(() =>
  import('./pages/profiles/ProfilesPage').then((module) => ({
    default: module.ProfilesPage
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
const ResourceListPage = lazy(() =>
  import('./pages/resources/ResourceListPage').then((module) => ({
    default: module.ResourceListPage
  }))
);

function RouteFallback() {
  return (
    <div className="json-editor-fallback">
      <Skeleton active paragraph={{ rows: 6 }} />
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
      </Route>
    </Routes>
  );
}
