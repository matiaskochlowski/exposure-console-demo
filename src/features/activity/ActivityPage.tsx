import { History } from 'lucide-react';
import { Link } from 'react-router';
import { useActionsState } from '../../actions/store.js';
import { Card, CardHeader } from '../../ui/index.js';
import { ConceptHint } from '../concepts/ConceptHint.js';

const time = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

/** Audit trail of every decided proposal and manual change, newest first. */
export default function ActivityPage() {
  const audit = useActionsState((s) => s.audit);
  const entries = [...audit].reverse();

  return (
    <div className="flex flex-col gap-4 px-4 py-4 pb-24 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold">Activity</h1>
        <p className="text-sm text-muted">
          Every action that changed a finding, and who decided it. The AI analyst only proposes;
          nothing here happened without a person approving it.
        </p>
      </div>
      <Card labelledBy="activity-heading">
        <CardHeader
          id="activity-heading"
          title="Audit trail"
          description={`${entries.length.toLocaleString()} ${entries.length === 1 ? 'entry' : 'entries'}, newest first. Stored in this browser; "Reset demo" clears it.`}
          hint={<ConceptHint id="analyst" />}
        />
        {entries.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
            <History aria-hidden="true" className="size-8 text-muted" />
            <p className="font-semibold">No activity yet</p>
            <p className="max-w-md text-sm text-muted">
              Open a finding from the{' '}
              <Link to="/exposures" className="font-semibold text-accent underline">
                exposure queue
              </Link>
              , ask the AI analyst what to do, and approve or reject its proposal. Decisions show up
              here.
            </p>
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table aria-labelledby="activity-heading" className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-muted">
                  <th scope="col" className="px-5 py-2 font-semibold">
                    When
                  </th>
                  <th scope="col" className="px-5 py-2 font-semibold">
                    Finding
                  </th>
                  <th scope="col" className="px-5 py-2 font-semibold">
                    What happened
                  </th>
                  <th scope="col" className="px-5 py-2 font-semibold">
                    Decided by
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={`${e.at}-${i}`} className="border-b border-row-line align-top">
                    <td className="px-5 py-2.5 whitespace-nowrap text-muted">{time(e.at)}</td>
                    <td className="px-5 py-2.5 whitespace-nowrap">
                      <Link
                        to={`/exposures/findings/${e.findingId}`}
                        className="font-mono font-semibold text-accent underline"
                      >
                        {e.findingId}
                      </Link>
                    </td>
                    <td className="px-5 py-2.5">{e.summary}</td>
                    <td className="px-5 py-2.5 whitespace-nowrap">{e.actor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
