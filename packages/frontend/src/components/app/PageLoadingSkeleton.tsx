import { Skeleton } from '@/components/ui/skeleton';

type PageLoadingSkeletonProps = {
  /** 'fullscreen' centers vertically in viewport; 'inline' renders in flow */
  variant?: 'fullscreen' | 'inline';
};

export function PageLoadingSkeleton({
  variant = 'inline'
}: PageLoadingSkeletonProps) {
  const content = (
    <div className="space-y-4 w-64">
      <Skeleton className="h-6 rounded-xl" />
      <Skeleton className="h-4 rounded-xl" />
      <Skeleton className="h-4 rounded-xl w-3/4" />
    </div>
  );

  if (variant === 'fullscreen') {
    return (
      <div className="flex h-screen items-center justify-center">{content}</div>
    );
  }

  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-40 rounded-xl" />
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}
