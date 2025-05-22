import { Skeleton } from "@/features/ui/components/skeleton";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/features/ui/components/card";

export default function DashboardSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <CardHeader className="p-4 pb-2 space-y-2">
            <div className="flex items-start justify-between">
              <Skeleton className="w-20 h-5" />
              <Skeleton className="w-8 h-8 rounded-full" />
            </div>
            <Skeleton className="w-3/4 h-6" />
            <Skeleton className="w-1/2 h-4" />
          </CardHeader>

          <CardContent className="p-4 pt-0">
            <div className="mt-2 space-y-2">
              <div className="flex justify-between">
                <Skeleton className="w-16 h-4" />
                <Skeleton className="w-8 h-4" />
              </div>
              <Skeleton className="w-full h-2" />
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4">
              <Skeleton className="w-full h-4" />
              <Skeleton className="w-full h-4" />
            </div>
          </CardContent>

          <CardFooter className="p-4 pt-0">
            <Skeleton className="w-full h-9" />
          </CardFooter>
        </Card>
      ))}
    </>
  );
}
