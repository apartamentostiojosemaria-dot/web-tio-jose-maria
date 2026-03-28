const Skeleton = ({ className = '' }) => (
    <div className={`animate-pulse bg-rural-100 rounded-2xl ${className}`} />
);

export const HomePageSkeleton = () => (
    <div className="min-h-screen bg-rural-50">
        {/* Hero skeleton */}
        <Skeleton className="h-screen w-full rounded-none" />

        {/* Intro skeleton */}
        <div className="max-w-7xl mx-auto px-6 py-24 grid md:grid-cols-2 gap-12">
            <Skeleton className="h-80" />
            <div className="space-y-4">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-10 w-3/4" />
                <Skeleton className="h-24 w-full" />
            </div>
        </div>

        {/* Apartments skeleton */}
        <div className="max-w-7xl mx-auto px-6 py-16">
            <div className="text-center mb-16 space-y-3">
                <Skeleton className="h-4 w-40 mx-auto" />
                <Skeleton className="h-10 w-64 mx-auto" />
            </div>
            <div className="grid md:grid-cols-2 gap-10">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm">
                        <Skeleton className="h-72 rounded-none" />
                        <div className="p-8 space-y-3">
                            <Skeleton className="h-6 w-1/3" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-2/3" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

export default Skeleton;
