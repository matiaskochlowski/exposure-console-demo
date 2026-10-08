import { lazy, Suspense } from 'react';
import { BrowserRouter, Link, Route, Routes } from 'react-router';
import QueuePage from './features/queue/QueuePage.js';
import { AppShell } from './layout/AppShell.js';
import { ErrorBoundary } from './layout/ErrorBoundary.js';
import { QueueSkeleton } from './layout/QueueSkeleton.js';
import { ToastProvider } from './ui/index.js';

// The drawer pulls in the markdown renderer and AI code; load it on first open.
const FindingRoute = lazy(() => import('./features/finding/FindingRoute.js'));

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
