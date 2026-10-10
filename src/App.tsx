import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useParams } from 'react-router';
import ActivityPage from './features/activity/ActivityPage.js';
import { ConceptChatProvider } from './features/chat/ConceptChat.js';
import GlossaryPage from './features/glossary/GlossaryPage.js';
import OverviewPage from './features/overview/OverviewPage.js';
import QueuePage from './features/queue/QueuePage.js';
import { AppShell } from './layout/AppShell.js';
import { ErrorBoundary } from './layout/ErrorBoundary.js';
import { QueueSkeleton } from './layout/QueueSkeleton.js';
import { ToastProvider } from './ui/index.js';

// The drawer pulls in the markdown renderer and AI code; load it on first open.
const FindingRoute = lazy(() => import('./features/finding/FindingRoute.js'));

/**
 * Resets the error boundary when the user moves to another section, so a page that failed doesn't
 * stick after navigating away. Keyed on the first path segment: opening a finding inside /exposures
 * must not remount the queue.
 */
function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const section = useLocation().pathname.split('/')[1] ?? '';
  return <ErrorBoundary key={section}>{children}</ErrorBoundary>;
}

/** Finding links from before the dashboard (`/findings/:id`) keep working. */
function LegacyFindingRedirect() {
  const { id = '' } = useParams();
  const { search } = useLocation();
  return <Navigate replace to={{ pathname: `/exposures/findings/${id}`, search }} />;
}

function NotFound() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <Link to="/exposures" className="mt-2 inline-block text-accent underline">
        Back to the queue
      </Link>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <ConceptChatProvider>
          <AppShell>
            <RouteErrorBoundary>
              <Suspense fallback={<QueueSkeleton />}>
                <Routes>
                  <Route path="/" element={<OverviewPage />} />
                  <Route path="/activity" element={<ActivityPage />} />
                  <Route path="/glossary" element={<GlossaryPage />} />
                  <Route path="/findings/:id" element={<LegacyFindingRedirect />} />
                  <Route path="/exposures" element={<QueuePage />}>
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
            </RouteErrorBoundary>
          </AppShell>
        </ConceptChatProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
