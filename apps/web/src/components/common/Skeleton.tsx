interface SkeletonProps {
  className?: string;
  rows?: number;
  type?: 'table' | 'card' | 'text';
}

function SkeletonBar({ w = '100%', h = '14px', className = '' }: { w?: string; h?: string; className?: string }) {
  return (
    <div
      className={`animate-pulse bg-gray-200 rounded ${className}`}
      style={{ width: w, height: h }}
    />
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="flex gap-4 pb-3 border-b border-gray-100">
        {[40, 120, 80, 80, 80, 60].map((w, i) => (
          <SkeletonBar key={i} w={`${w}px`} h="12px" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 py-1" style={{ opacity: 1 - i * 0.08 }}>
          {[40, 120, 80, 80, 80, 60].map((w, j) => (
            <SkeletonBar key={j} w={`${w}px`} h="14px" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
          <SkeletonBar w="60%" h="12px" />
          <SkeletonBar w="80%" h="24px" />
        </div>
      ))}
    </div>
  );
}

export default function Skeleton({ rows = 8, type = 'table' }: SkeletonProps) {
  if (type === 'card') return <CardSkeleton count={rows} />;
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <CardSkeleton count={4} />
      <TableSkeleton rows={rows} />
    </div>
  );
}
