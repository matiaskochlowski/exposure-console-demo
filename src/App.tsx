import { lazy, Suspense } from 'react';
import { BrowserRouter, Link, Route, Routes } from 'react-router';
import QueuePage from './features/queue/QueuePage.tsx';
import { AppShell } from './layout/AppShell.tsx';
import { ErrorBoundary } from './layout/ErrorBoundary.tsx';
import { QueueSkeleton } from './layout/QueueSkeleton.tsx';
import { ToastProvider } from './ui/index.ts';

// The drawer pulls in the markdown renderer and AI code; load it on first open.
const FindingRoute = lazy(() => import('./features/finding/FindingRoute.tsx'));

function NotFound() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <Link to="/" className="mt-2 inline-block text-accent underline">
        Back to the queue
      </Link>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AppShell>
          <ErrorBoundary>
            <Suspense fallback={<QueueSkeleton />}>
              <Routes>
                <Route path="/" element={<QueuePage />}>
                  <Route
                    path="findings/:id"
                    element={
                      <Suspense
                        fallback={
                          <p role="status" className="sr-only">
                            Loading finding…
                          </p>
                        }
                      >
                        <FindingRoute />
                      </Suspense>
                    }
                  />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </AppShell>
      </ToastProvider>
    </BrowserRouter>
  );
}
