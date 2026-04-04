import { useEffect, useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import { isNotFoundApiError } from '@/api/client';
import { getProfile } from '@/api/profiles';
import { listResources } from '@/api/resources';
import { EmptyState } from '@/components/app/EmptyState';
import { PageLoadingSkeleton } from '@/components/app/PageLoadingSkeleton';
import { Button } from '@/components/ui/button';
import { useErrorMessage } from '@/hooks/use-error-message';
import { queryKeys } from '@/query/query-keys';
import { profileConfig } from '@/types/profiles';

import { ProfileEditorContent } from './ProfileEditorContent';

export function ProfileEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const handleError = useErrorMessage();

  useEffect(() => {
    if (!id) {
      void navigate(profileConfig.path, { replace: true });
    }
  }, [id, navigate]);

  const [profileDetailQuery, skillsQuery, mcpsQuery, rulesQuery] = useQueries({
    queries: [
      {
        queryKey: id
          ? queryKeys.profiles.detail(id)
          : queryKeys.profiles.list(),
        queryFn: () => getProfile(id!),
        enabled: Boolean(id)
      },
      {
        queryKey: queryKeys.resources.list('skills'),
        queryFn: () => listResources('skills')
      },
      {
        queryKey: queryKeys.resources.list('mcps'),
        queryFn: () => listResources('mcps')
      },
      {
        queryKey: queryKeys.resources.list('rules'),
        queryFn: () => listResources('rules')
      }
    ]
  });
  const profileNotFound = isNotFoundApiError(profileDetailQuery.error);

  useEffect(() => {
    const queryError =
      skillsQuery.error ??
      mcpsQuery.error ??
      rulesQuery.error ??
      (profileNotFound ? null : profileDetailQuery.error);

    if (!queryError) {
      return;
    }

    handleError(queryError);
    void navigate(profileConfig.path, { replace: true });
  }, [
    handleError,
    mcpsQuery.error,
    navigate,
    profileNotFound,
    profileDetailQuery.error,
    rulesQuery.error,
    skillsQuery.error
  ]);

  const catalog = useMemo(
    () =>
      skillsQuery.data && mcpsQuery.data && rulesQuery.data
        ? {
            skills: skillsQuery.data,
            mcps: mcpsQuery.data,
            rules: rulesQuery.data
          }
        : null,
    [mcpsQuery.data, rulesQuery.data, skillsQuery.data]
  );
  const loading =
    profileDetailQuery.isPending ||
    skillsQuery.isPending ||
    mcpsQuery.isPending ||
    rulesQuery.isPending;

  if (!id) {
    return null;
  }

  if (profileNotFound) {
    return (
      <EmptyState
        title="未找到 Profile"
        description="当前 Profile 不存在或已被删除。"
        action={
          <Button
            variant="outline"
            onClick={() => void navigate(profileConfig.path)}
          >
            <ArrowLeft data-icon="inline-start" />
            返回 Profiles
          </Button>
        }
      />
    );
  }

  if (loading || !profileDetailQuery.data || !catalog) {
    return <PageLoadingSkeleton />;
  }

  return (
    <ProfileEditorContent
      key={`${profileDetailQuery.data.id}:${profileDetailQuery.data.updatedAt}`}
      profileId={id}
      initialDetail={profileDetailQuery.data}
      catalog={catalog}
      onBack={() => {
        void navigate(profileConfig.path);
      }}
    />
  );
}
