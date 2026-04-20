import React, { useState, useMemo } from 'react';
import { X, ExternalLink, Clock, ChevronDown, ChevronRight, User } from 'lucide-react';
import { JiraIssue } from './ItemDistributionWidget';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface StuckTasksModalProps {
  issues: JiraIssue[];
  thresholdHours: number;
  onThresholdChange: (hours: number) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  onClose: () => void;
}

type StuckTask = JiraIssue & { hoursSinceChange: number };

type ParentGroup = {
  parentSummary: string;
  parentUrl: string;
  subTasks: StuckTask[];
};

type AssigneeGroup = {
  assignee: string;
  parents: Record<string, ParentGroup>;
  totalTasks: number;
};

function ParentStoryRow({ parentKey, parentGroup }: { parentKey: string, parentGroup: ParentGroup }) {
  const [expanded, setExpanded] = useState(false);
  
  const isNoParent = parentKey === 'NO_PARENT';
  const maxHours = Math.max(...parentGroup.subTasks.map(t => t.hoursSinceChange));
  
  const getUrgencyBadge = (hours: number) => {
    if (hours >= 168) return 'bg-red-100 text-red-700 border-red-200';
    if (hours >= 72) return 'bg-orange-100 text-orange-700 border-orange-200';
    if (hours >= 24) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const getUrgencyText = (hours: number) => {
    if (hours >= 168) return 'text-red-600';
    if (hours >= 72) return 'text-orange-600';
    if (hours >= 24) return 'text-yellow-600';
    return 'text-slate-600';
  };

  const fmtDays = (hours: number) => `${Math.floor(hours / 24)}d`;

  return (
    <div className="flex flex-col border-b border-slate-100 last:border-0">
      <div 
        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <button className="p-1 text-slate-400 hover:text-slate-600 shrink-0">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          <div className="truncate">
            {isNoParent ? (
              <span className="text-sm font-medium text-slate-500 italic">No Parent Story</span>
            ) : (
              <div className="flex items-center gap-2 truncate">
                <a 
                  href={parentGroup.parentUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm font-mono text-indigo-600 hover:underline shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  {parentKey}
                </a>
                <span className="text-sm font-medium text-slate-800 truncate" title={parentGroup.parentSummary}>
                  {parentGroup.parentSummary}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4">
          <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded-md border border-slate-200">
            {parentGroup.subTasks.length} sub-task{parentGroup.subTasks.length !== 1 ? 's' : ''}
          </span>
          <span className={cn("text-xs font-bold px-2 py-1 rounded-md border", getUrgencyBadge(maxHours))} title={`Max stuck time: ${fmtDays(maxHours)}`}>
            Max: {fmtDays(maxHours)}
          </span>
        </div>
      </div>
      
      {expanded && (
        <div className="bg-slate-50/80 px-4 py-3 border-t border-slate-100 pl-12">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <th className="pb-2 font-semibold">Sub-task</th>
                  <th className="pb-2 font-semibold">Status</th>
                  <th className="pb-2 font-semibold">Time in Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parentGroup.subTasks.sort((a, b) => b.hoursSinceChange - a.hoursSinceChange).map(task => (
                  <tr key={task.id} className="hover:bg-white transition-colors">
                    <td className="py-2 pr-4">
                      <a 
                        href={task.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="group flex flex-col"
                      >
                        <span className="text-xs font-mono text-slate-500 group-hover:text-rose-600 transition-colors">{task.key}</span>
                        <span className="text-sm font-medium text-slate-900 group-hover:text-rose-600 transition-colors flex items-center gap-1 mt-0.5">
                          {task.summary}
                          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </span>
                      </a>
                    </td>
                    <td className="py-2 pr-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-white border border-slate-200 text-slate-700 shadow-sm">
                        {task.status}
                      </span>
                    </td>
                    <td className="py-2">
                      <span className={cn("text-sm font-bold flex items-center gap-1.5", getUrgencyText(task.hoursSinceChange))}>
                        <Clock className="w-4 h-4" />
                        {fmtDays(task.hoursSinceChange)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StuckTasksModal({ issues, thresholdHours, onThresholdChange, statusFilter, onStatusFilterChange, onClose }: StuckTasksModalProps) {
  const stuckTasks = useMemo(() => {
    const now = new Date().getTime();
    return issues.filter(issue => {
      // Only consider sub-tasks that are not done/resolved
      if (issue.type.toLowerCase() !== 'sub-task') return false;
      if (issue.sprintState !== 'active') return false;
      
      const normalizedIssueStatus = issue.status.toLowerCase().replace(/[_-\s]/g, '');
      const normalizedFilterStatus = statusFilter.toLowerCase().replace(/[_-\s]/g, '');
      if (normalizedIssueStatus !== normalizedFilterStatus) return false;
      
      if (!issue.statusChangedDate) return false;
      
      const changedDate = new Date(issue.statusChangedDate).getTime();
      const hoursSinceChange = (now - changedDate) / (1000 * 60 * 60);
      
      return hoursSinceChange >= thresholdHours;
    }).map(issue => {
      const changedDate = new Date(issue.statusChangedDate!).getTime();
      const hoursSinceChange = Math.floor((now - changedDate) / (1000 * 60 * 60));
      return { ...issue, hoursSinceChange };
    }).sort((a, b) => b.hoursSinceChange - a.hoursSinceChange);
  }, [issues, thresholdHours, statusFilter]);

  const groupedTasks = useMemo(() => {
    const groups: Record<string, AssigneeGroup> = {};
    
    stuckTasks.forEach(task => {
      const assignee = task.assignee || 'Unassigned';
      const parentKey = task.parentKey || 'NO_PARENT';
      
      if (!groups[assignee]) {
        groups[assignee] = { assignee, parents: {}, totalTasks: 0 };
      }
      
      if (!groups[assignee].parents[parentKey]) {
        groups[assignee].parents[parentKey] = {
          parentSummary: task.parentSummary || 'No Parent Story',
          parentUrl: task.parentKey ? `https://${new URL(task.url).hostname}/browse/${task.parentKey}` : '',
          subTasks: []
        };
      }
      
      groups[assignee].parents[parentKey].subTasks.push(task);
      groups[assignee].totalTasks++;
    });
    
    // Sort assignees by total tasks descending
    return Object.values(groups).sort((a, b) => b.totalTasks - a.totalTasks);
  }, [stuckTasks]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>
        
        <div className="p-6 pr-16 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Clock className="w-6 h-6 text-rose-500" />
              Stuck Tasks Alert <span className="text-slate-500 font-medium text-lg">({stuckTasks.length})</span>
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Sub-tasks that haven't changed status in a while.
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">Status:</label>
              <select 
                value={statusFilter}
                onChange={(e) => onStatusFilterChange(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-rose-500 focus:border-rose-500 block p-2 outline-none"
              >
                <option value="In Progress">In Progress</option>
                <option value="Waiting for QA deploy">Waiting for QA deploy</option>
                <option value="Waiting For Deploy">Waiting For Deploy</option>
                <option value="Waiting for QA">Waiting for QA</option>
                <option value="Waiting For QA deploy">Waiting For QA deploy</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">Threshold:</label>
              <select 
                value={thresholdHours}
                onChange={(e) => onThresholdChange(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-rose-500 focus:border-rose-500 block p-2 outline-none"
              >
                <option value={24}>1 Day</option>
                <option value={48}>2 Days</option>
                <option value={72}>3 Days</option>
                <option value={120}>5 Days</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto p-6 bg-slate-50 flex-1">
          {stuckTasks.length === 0 ? (
            <div className="flex items-center justify-center py-16 bg-white rounded-xl border border-slate-200">
              <p className="text-slate-500 font-medium">No stuck tasks were found</p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedTasks.map((group) => (
                <div key={group.assignee} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-slate-50/80 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
                        {group.assignee.charAt(0).toUpperCase()}
                      </div>
                      <h3 className="font-semibold text-slate-800">{group.assignee}</h3>
                    </div>
                    <span className="bg-white border border-slate-200 text-slate-600 text-xs px-2.5 py-1 rounded-full font-medium shadow-sm">
                      {group.totalTasks} stuck task{group.totalTasks !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    {Object.entries(group.parents).map(([parentKey, parentGroup]) => (
                      <ParentStoryRow key={parentKey} parentKey={parentKey} parentGroup={parentGroup} />
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
