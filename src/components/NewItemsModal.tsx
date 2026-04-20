import React, { useMemo } from 'react';
import { X, ExternalLink, Sparkles, Bug, Bookmark, CheckSquare } from 'lucide-react';
import { JiraIssue } from './ItemDistributionWidget';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface NewItemsModalProps {
  issues: JiraIssue[];
  onClose: () => void;
}

const isCreatedToday = (dateString?: string) => {
  if (!dateString) return false;
  const date = new Date(dateString);
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
};

export default function NewItemsModal({ issues, onClose }: NewItemsModalProps) {
  const newItems = useMemo(() => {
    return issues.filter(issue => isCreatedToday(issue.createdDate));
  }, [issues]);

  const groupedItems = useMemo(() => {
    const stories: JiraIssue[] = [];
    const bugs: JiraIssue[] = [];
    const subBugs: JiraIssue[] = [];
    const tasks: JiraIssue[] = [];

    newItems.forEach(issue => {
      const typeLower = issue.type.toLowerCase();
      if (typeLower.includes('sub') && typeLower.includes('bug')) {
        subBugs.push(issue);
      } else if (typeLower.includes('bug')) {
        bugs.push(issue);
      } else if (typeLower.includes('story')) {
        stories.push(issue);
      } else if (typeLower.includes('task')) {
        tasks.push(issue);
      } else {
        stories.push(issue);
      }
    });

    return { stories, bugs, subBugs, tasks };
  }, [newItems]);

  const renderTable = (title: string, data: JiraIssue[], icon: React.ReactNode) => {
    if (data.length === 0) return null;

    return (
      <div className="mb-8 last:mb-0">
        <div className="flex items-center gap-2 mb-4">
          {icon}
          <h3 className="text-lg font-semibold text-slate-900">{title} ({data.length})</h3>
        </div>
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-medium text-slate-500 whitespace-nowrap">Key</th>
                <th className="px-4 py-3 font-medium text-slate-500 w-full">Item Name</th>
                <th className="px-4 py-3 font-medium text-slate-500 whitespace-nowrap">Assignee</th>
                <th className="px-4 py-3 font-medium text-slate-500 whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.map(issue => (
                <tr key={issue.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">
                    {issue.key}
                  </td>
                  <td className="px-4 py-3 max-w-0 w-full">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">New</span>
                      <a
                        href={issue.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:text-indigo-800 hover:underline font-medium inline-flex items-center gap-1 min-w-0"
                        title={issue.summary}
                      >
                        <span className="truncate">{issue.summary}</span>
                        <ExternalLink className="w-3 h-3 opacity-50 shrink-0" />
                      </a>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-medium">
                        {issue.assignee.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-slate-700 truncate max-w-[120px]" title={issue.assignee}>
                        {issue.assignee}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
                      {issue.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>
        
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-amber-100 p-2 rounded-lg">
              <Sparkles className="w-5 h-5 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">New Items Created Today</h2>
          </div>
          <p className="text-slate-500">
            Overview of all items that were created in Jira today.
          </p>
        </div>

        <div className="overflow-y-auto p-6 bg-slate-50 flex-1">
          {newItems.length === 0 ? (
            <div className="flex items-center justify-center py-16 bg-white rounded-xl border border-slate-200">
              <p className="text-slate-500 font-medium">No new items were created today</p>
            </div>
          ) : (
            <div className="space-y-6">
              {renderTable("Stories", groupedItems.stories, <Bookmark className="w-5 h-5 text-green-500 fill-green-500" />)}
              {renderTable("Tasks", groupedItems.tasks, <CheckSquare className="w-5 h-5 text-purple-500" />)}
              {renderTable("Bugs", groupedItems.bugs, <Bug className="w-5 h-5 text-red-500" />)}
              {renderTable("Sub-Bugs", groupedItems.subBugs, <Bug className="w-5 h-5 text-blue-500" />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
