export function SkeletonBar({ w = '100%', h = '14px' }: { w?: string; h?: string }) {
  return <div className="animate-pulse bg-gray-200 rounded" style={{ width: w, height: h }} />;
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="p-4 space-y-3">
      <div className="flex gap-4 pb-3 border-b border-gray-100">
        {[40, 120, 80, 80, 80, 60].map((w, i) => <SkeletonBar key={i} w={`${w}px`} h="12px" />)}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 py-1" style={{ opacity: 1 - i * 0.08 }}>
          {[40, 120, 80, 80, 80, 60].map((w, j) => <SkeletonBar key={j} w={`${w}px`} h="14px" />)}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-${Math.min(count, 4)} gap-4 p-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
          <SkeletonBar w="60%" h="12px" />
          <SkeletonBar w="80%" h="24px" />
        </div>
      ))}
    </div>
  );
}
