import { Loader2 } from "lucide-react";
import React from "react";

interface ResearchingPillProps {
  fetchLog: string[];
  onStop: () => void;
}

/**
 * A pill/banner rendered between the chat messages and the input bar while the
 * agent is actively fetching web pages. Shows a running list of fetch log
 * entries and a "Stop & Synthesize" button to terminate the retrieval session.
 */
export const ResearchingPill: React.FC<ResearchingPillProps> = ({ fetchLog, onStop }) => {
  return (
    <div className="tw-mx-2 tw-mb-2 tw-rounded-md tw-border tw-border-border tw-bg-secondary tw-p-2 tw-text-sm">
      <div className="tw-flex tw-items-center tw-justify-between">
        <div className="tw-flex tw-items-center tw-gap-1 tw-font-medium tw-text-normal">
          <Loader2 className="tw-size-3 tw-animate-spin" />
          Researching...
        </div>
        <button onClick={onStop} className="tw-text-xs tw-text-muted hover:tw-text-normal">
          Stop &amp; Synthesize
        </button>
      </div>
      {fetchLog.length > 0 && (
        <ul className="tw-mt-1 tw-space-y-0.5 tw-text-xs tw-text-muted">
          {fetchLog.map((entry, i) => (
            <li key={i}>• {entry}</li>
          ))}
        </ul>
      )}
    </div>
  );
};
