import { Skeleton } from "@/components/ui/skeleton";

function Tile({ className = "" }: { className?: string }) {
  return (
    <div className={`bento-tile p-5 ${className}`}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-8 w-32" />
      <Skeleton className="mt-3 h-2 w-16" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile />
        <Tile />
        <Tile />
        <Tile />
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-6">
        <div className="bento-tile p-6 lg:col-span-4">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="mt-2 h-6 w-48" />
          <Skeleton className="mt-6 h-64 w-full" />
        </div>
        <div className="lg:col-span-2 space-y-3">
          <Tile />
          <Tile />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="bento-tile p-6 lg:col-span-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="mt-2 h-6 w-40" />
          <Skeleton className="mt-6 h-48 w-full" />
        </div>
        <div className="bento-tile p-6">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-2 h-6 w-40" />
          <div className="mt-5 space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
