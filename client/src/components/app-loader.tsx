import { Loader2 } from "lucide-react";

export function AppLoader() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-white z-50">
      <div className="flex flex-col items-center space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <h2 className="text-xl font-medium text-gray-700">Loading your dashboard...</h2>
        <p className="text-sm text-gray-500">Please wait while we prepare everything for you</p>
      </div>
    </div>
  );
}