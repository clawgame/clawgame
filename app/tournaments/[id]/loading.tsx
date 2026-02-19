import { SkeletonCard } from '@/components/ui';

export default function TournamentDetailLoading() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-7xl mx-auto space-y-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}
