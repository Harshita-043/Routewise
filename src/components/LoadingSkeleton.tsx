import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted/50", className)}
      {...props}
    />
  );
}

export function TransportCardSkeleton() {
  return (
    <div className="bg-card rounded-xl border-2 border-border/20 p-5 space-y-4">
      <div className="flex items-start gap-4">
        <Skeleton className="w-14 h-14 rounded-xl" />
        <div className="flex-1 space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-6 w-1/4" />
          </div>
          <Skeleton className="h-4 w-full" />
          <div className="flex justify-between pt-2">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function TrainCardSkeleton() {
  return (
    <div className="bg-card rounded-2xl border border-border/50 p-6 space-y-6">
      <div className="flex justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
      <div className="grid grid-cols-3 gap-8">
        <div className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-4 w-2/3" /></div>
        <div className="flex flex-col items-center justify-center"><Skeleton className="h-4 w-full" /></div>
        <div className="space-y-2 text-right"><Skeleton className="h-8 w-full ml-auto" /><Skeleton className="h-4 w-2/3 ml-auto" /></div>
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-10 flex-1 rounded-xl" />
        <Skeleton className="h-10 flex-1 rounded-xl" />
        <Skeleton className="h-10 flex-1 rounded-xl" />
      </div>
    </div>
  );
}
