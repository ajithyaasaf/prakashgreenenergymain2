import { lazy, Suspense, ComponentType } from 'react';
import { Loader2 } from 'lucide-react';

// Advanced loading fallback with better UX
const ChunkLoadingFallback = ({ message = "Loading..." }: { message?: string }) => (
  <div className="flex items-center justify-center min-h-[40vh] w-full">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground animate-pulse">{message}</p>
    </div>
  </div>
);

// Simplified chunk loading wrapper
export function withChunkLoading(
  importFn: () => Promise<{ default: ComponentType<any> }>,
  fallbackMessage?: string
) {
  const LazyComponent = lazy(importFn);
  
  return function ChunkLoadedComponent(props: any) {
    return (
      <Suspense fallback={<ChunkLoadingFallback message={fallbackMessage} />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

// Preload utility for critical chunks
export function preloadChunk(importFn: () => Promise<any>) {
  // Preload on idle or user interaction
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => importFn());
  } else {
    setTimeout(() => importFn(), 100);
  }
}

// Route-based preloading for better navigation experience
export function preloadRouteChunks() {
  // Preload heavy components after initial page load
  setTimeout(() => {
    // Preload most commonly accessed pages
    preloadChunk(() => import('@/pages/attendance'));
    preloadChunk(() => import('@/pages/customers'));
    preloadChunk(() => import('@/pages/products'));
  }, 2000);
  
  // Preload admin-only pages if user has access
  setTimeout(() => {
    preloadChunk(() => import('@/pages/attendance-management'));
    preloadChunk(() => import('@/pages/payroll-management'));
    preloadChunk(() => import('@/pages/departments'));
  }, 5000);
  
  // Add future large components here based on usage patterns
  // Example: setTimeout(() => preloadChunk(() => import('@/pages/your-new-large-page')), 7000);
}

// Progressive loading utility for large components
export function createProgressiveLoader(
  imports: {
    main: () => Promise<{ default: ComponentType<any> }>;
    fallback?: () => Promise<{ default: ComponentType<any> }>;
  }
) {
  return function ProgressiveComponent(props: any) {
    const MainComponent = lazy(imports.main);
    
    return (
      <Suspense 
        fallback={
          <ChunkLoadingFallback message="Loading advanced features..." />
        }
      >
        <MainComponent {...props} />
      </Suspense>
    );
  };
}