import React, { useState, useEffect } from 'react';
import { X, ExternalLink, Clock, AlertCircle, Loader2 } from 'lucide-react';

interface StuckItem {
  key: string;
  summary: string;
  assignee: string;
  assigneeAvatarUrl: string | null;
  hoursSinceChange: number;
  url: string;
  type: string;
}

interface StuckGroup {
  status: string;
  threshold85th: number;
  items: StuckItem[];
}

interface InsightsData {
  stuckGroups: StuckGroup[];
  totalStuck: number;
}

interface SprintInsightsModalProps {
  team: string;
  onClose: () => void;
}

function formatDuration(hours: number): string {
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const remainingDays = days % 7;

  if (weeks > 0 && remainingDays > 0) return `${weeks}w ${remainingDays}d`;
  if (weeks > 0) return `${weeks}w`;
  if (days > 0) return `${days}d`;
  return `${hours}h`;
}

function AssigneeAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const [imgError, setImgError] = useState(false);
  const initial = name.charAt(0).toUpperCase();

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className="w-7 h-7 rounded-full shrink-0 border border-slate-200"
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0 border border-indigo-200">
      {initial}
    </div>
  );
}

export default function SprintInsightsModal({ team, onClose }: SprintInsightsModalProps) {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/jira/sprint-insights?team=${encodeURIComponent(team)}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [team]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 pr-16 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Clock className="w-6 h-6 text-rose-500" />
            Sprint Insights — Stuck Work Items
            {data && (
              <span className="text-slate-500 font-medium text-lg">({data.totalStuck})</span>
            )}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Active sprint items that have exceeded the 85th percentile of historical time in their current status.
          </p>
        </div>

        <div className="overflow-y-auto p-6 bg-slate-50 flex-1">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              <span className="ml-3 text-slate-500">Fetching sprint insights from Jira…</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {data && data.stuckGroups.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-slate-200 gap-3">
              <span className="text-4xl">🎉</span>
              <p className="text-slate-700 font-medium">No stuck work items found!</p>
              <p className="text-slate-400 text-sm">All active items are progressing within expected timeframes.</p>
            </div>
          )}

          {data && data.stuckGroups.length > 0 && (
            <div className="space-y-5">
              {data.stuckGroups.map((group) => (
                <div key={group.status} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  {/* Status group header */}
                  <div className="px-5 py-4 border-b border-slate-100 bg-rose-50/60">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-100 text-rose-700 border border-rose-200">
                            {group.status}
                          </span>
                          <span className="text-sm font-semibold text-slate-800">
                            {group.items.length} stuck item{group.items.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          {group.items.length} work item{group.items.length !== 1 ? 's are' : ' is'} stuck.{' '}
                          85% of the time, work items have moved out of this status by now.
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs text-slate-400 block">85th percentile</span>
                        <span className="text-sm font-semibold text-slate-600">{formatDuration(group.threshold85th)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Items list */}
                  <div className="divide-y divide-slate-100">
                    {group.items.map((item) => (
                      <div
                        key={item.key}
                        className="px-5 py-3.5 flex items-center gap-4 hover:bg-slate-50 transition-colors"
                      >
                        {/* Issue key + summary */}
                        <div className="flex-1 min-w-0">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex items-baseline gap-2"
                          >
                            <span className="text-xs font-mono font-semibold text-indigo-600 group-hover:underline shrink-0">
                              {item.key}
                            </span>
                            <span className="text-sm text-slate-800 truncate group-hover:text-indigo-700 transition-colors">
                              {item.summary}
                            </span>
                            <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-indigo-400 transition-colors shrink-0" />
                          </a>
                        </div>

                        {/* Assignee */}
                        <div className="flex items-center gap-2 shrink-0">
                          <AssigneeAvatar name={item.assignee} avatarUrl={item.assigneeAvatarUrl} />
                          <span
                            className="text-xs text-slate-600 hidden sm:block max-w-[110px] truncate"
                            title={item.assignee}
                          >
                            {item.assignee}
                          </span>
                        </div>

                        {/* Stuck for badge */}
                        <div className="shrink-0">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 border border-rose-200 whitespace-nowrap">
                            <Clock className="w-3 h-3" />
                            Stuck for {formatDuration(item.hoursSinceChange)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
