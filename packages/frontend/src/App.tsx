import { Fragment } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { AppLayout } from './layout/AppLayout';
import { ProfilesPage } from './pages/profiles/ProfilesPage';
import { ResourceEditPage } from './pages/resources/ResourceEditPage';
import { ResourceListPage } from './pages/resources/ResourceListPage';
import { resourceConfigMap, resourceKinds } from './types/resources';

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/skills" replace />} />
        {resourceKinds.map((kind) => (
          <Fragment key={kind}>
            <Route
              path={resourceConfigMap[kind].path}
              element={<ResourceListPage kind={kind} />}
            />
            <Route
              path={`${resourceConfigMap[kind].path}/new`}
              element={<ResourceEditPage kind={kind} />}
            />
            <Route
              path={`${resourceConfigMap[kind].path}/:id/edit`}
              element={<ResourceEditPage kind={kind} />}
            />
          </Fragment>
        ))}
        <Route path="/profiles" element={<ProfilesPage />} />
      </Route>
    </Routes>
  );
}
