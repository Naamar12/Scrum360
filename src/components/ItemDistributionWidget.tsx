import React, { useState, useMemo, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ChevronDown, X, ExternalLink, ArrowUpDown, ArrowUp, ArrowDown, Search, Bug, Bookmark, CheckSquare } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface JiraIssue {
  id: string;
  key: string;
  summary: string;
  type: string;
  status: string;
  fixVersion?: string;
  assignee: string;
  priority: string;
  priorityId: string;
  sprintState: string;
  url: string;
  parentKey?: string;
  parentSummary?: string;
  statusChangedDate?: string;
  createdDate?: string;
}

interface ItemDistributionWidgetProps {
  issues: JiraIssue[];
  nextSprintName?: string;
}

const COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const isCreatedToday = (dateString?: string) => {
  if (!dateString) return false;
  const date = new Date(dateString);
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
};

export default function ItemDistributionWidget({ issues, nextSprintName }: ItemDistributionWidgetProps) {
  const [itemType, setItemType] = useState<'Bugs' | 'Sub-Bugs' | 'User Stories' | 'All Items'>('User Stories');
  const [viewMode, setViewMode] = useState<'current' | 'all'>('current');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: 'status' | 'assignee', direction: 'asc' | 'desc' } | null>(null);
  const [includeDone, setIncludeDone] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const baseIssues = useMemo(() => {
    if (viewMode === 'current') {
      return issues.filter(issue => issue.sprintState === 'active');
    }
    return issues;
  }, [issues, viewMode]);

  // Filter issues based on selected type ONLY (for the chart)
  const typeFilteredIssues = useMemo(() => {
    return baseIssues.filter(issue => {
      const typeLower = issue.type.toLowerCase();
      if (itemType === 'Bugs') {
        return typeLower.includes('bug') && !typeLower.includes('sub');
      } else if (itemType === 'Sub-Bugs') {
        return typeLower.includes('sub') && typeLower.includes('bug');
      } else if (itemType === 'User Stories') {
        return typeLower.includes('story');
      } else if (itemType === 'All Items') {
        return (typeLower.includes('bug') && !typeLower.includes('sub')) || 
               (typeLower.includes('sub') && typeLower.includes('bug')) || 
               typeLower.includes('story');
      }
      return false;
    });
  }, [baseIssues, itemType]);

  const uniqueAssignees = useMemo(() => {
    const assignees = new Set<string>();
    typeFilteredIssues.forEach(issue => {
      const isDone = ['done', 'closed', 'resolved'].includes(issue.status.toLowerCase());
      const statusMatch = includeDone ? true : !isDone;
      
      if (issue.assignee && statusMatch) {
        assignees.add(issue.assignee);
      }
    });
    const sorted = Array.from(assignees).filter(a => a !== 'Unassigned').sort();
    if (assignees.has('Unassigned')) {
      sorted.push('Unassigned');
    }
    return ['All', ...sorted];
  }, [typeFilteredIssues, includeDone]);

  // Reset selected assignee if they are no longer in the filtered list
  useEffect(() => {
    if (selectedAssignee !== 'All' && !uniqueAssignees.includes(selectedAssignee)) {
      setSelectedAssignee('All');
    }
  }, [uniqueAssignees, selectedAssignee]);

  // Filter issues based on selected assignee (for the modal)
  const modalFilteredIssues = useMemo(() => {
    return typeFilteredIssues.filter(issue => {
      const assigneeMatch = selectedAssignee === 'All' || issue.assignee === selectedAssignee;
      const isDone = ['done', 'closed', 'resolved'].includes(issue.status.toLowerCase());
      const statusMatch = includeDone ? true : !isDone;
      const searchMatch = searchQuery === '' || 
        issue.key.toLowerCase().includes(searchQuery.toLowerCase()) || 
        issue.summary.toLowerCase().includes(searchQuery.toLowerCase());
        
      return assigneeMatch && statusMatch && searchMatch;
    });
  }, [typeFilteredIssues, selectedAssignee, includeDone, searchQuery]);

  // Group by status for the Donut chart
  const chartData = useMemo(() => {
    const statusCounts: Record<string, number> = {};
    typeFilteredIssues.forEach(issue => {
      statusCounts[issue.status] = (statusCounts[issue.status] || 0) + 1;
    });
    
    return Object.entries(statusCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [typeFilteredIssues]);

  // Group for modal
  const currentSprintIssues = modalFilteredIssues.filter(i => i.sprintState === 'active');
  const nextSprintIssues = modalFilteredIssues.filter(i => i.sprintState === 'next');
  const backlogIssues = modalFilteredIssues.filter(i => i.sprintState === 'backlog' || i.sprintState === 'future' || !i.sprintState)
    .sort((a, b) => Number(a.priorityId) - Number(b.priorityId)); // Lower ID usually means higher priority in Jira

  const renderTable = (title: string, data: JiraIssue[]) => {
    if (data.length === 0) return null;
    
    const sortedData = [...data];
    if (sortConfig) {
      sortedData.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    const handleSort = (key: 'status' | 'assignee') => {
      if (sortConfig?.key === key) {
        if (sortConfig.direction === 'asc') {
          setSortConfig({ key, direction: 'desc' });
        } else {
          setSortConfig(null);
        }
      } else {
        setSortConfig({ key, direction: 'asc' });
      }
    };
    
    return (
      <div className="mb-8 last:mb-0">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">{title} ({data.length})</h3>
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-medium text-slate-500 whitespace-nowrap">Key</th>
                <th className={cn("px-4 py-3 font-medium text-slate-500", itemType === 'Sub-Bugs' ? "w-1/2" : "w-full")}>Item Name</th>
                {itemType === 'Sub-Bugs' && (
                  <th className="px-4 py-3 font-medium text-slate-500 w-1/2">Parent</th>
                )}
                <th 
                  className="px-4 py-3 font-medium text-slate-500 whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors group select-none"
                  onClick={() => handleSort('assignee')}
                >
                  <div className="flex items-center gap-1">
                    Assignee
                    {sortConfig?.key === 'assignee' ? (
                      sortConfig.direction === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-indigo-600" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 font-medium text-slate-500 whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors group select-none"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-1">
                    Status
                    {sortConfig?.key === 'status' ? (
                      sortConfig.direction === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-indigo-600" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sortedData.map(issue => (
                <tr key={issue.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      {issue.type.toLowerCase().includes('bug') && (
                        <Bug className={cn(
                          "w-3.5 h-3.5 shrink-0",
                          issue.type.toLowerCase().includes('sub') ? "text-blue-500" : "text-red-500"
                        )} />
                      )}
                      {issue.type.toLowerCase().includes('story') && (
                        <Bookmark className="w-3.5 h-3.5 text-green-500 shrink-0 fill-green-500" />
                      )}
                      {issue.type.toLowerCase() === 'task' && (
                        <CheckSquare className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                      )}
                      <span>{issue.key}</span>
                    </div>
                  </td>
                  <td className={cn("px-4 py-3 max-w-0", itemType === 'Sub-Bugs' ? "w-1/2" : "w-full")}>
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isCreatedToday(issue.createdDate) && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">New</span>
                      )}
                      <a
                        href={issue.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline font-medium inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 min-w-0"
                        title={issue.summary}
                      >
                        <span className="truncate">{issue.summary}</span>
                        <ExternalLink className="w-3 h-3 opacity-50 shrink-0" />
                      </a>
                    </div>
                  </td>
                  {itemType === 'Sub-Bugs' && (
                    <td className="px-4 py-3 max-w-0 w-1/2">
                      {issue.parentKey ? (
                        <a 
                          href={issue.url.replace(issue.key, issue.parentKey)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-800 hover:underline font-medium inline-flex items-center gap-1 w-full"
                          title={issue.parentSummary || issue.parentKey}
                        >
                          <span className="truncate">{issue.parentSummary || issue.parentKey}</span>
                          <ExternalLink className="w-3 h-3 opacity-50 shrink-0" />
                        </a>
                      ) : (
                        <span className="text-slate-400 text-xs italic">No Parent</span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button 
                      onClick={() => setSelectedAssignee(selectedAssignee === issue.assignee ? 'All' : issue.assignee)}
                      className="flex items-center gap-2 hover:bg-slate-200/50 p-1 -ml-1 rounded transition-colors text-left w-full"
                    >
                      <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                        {issue.assignee.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-slate-700 truncate max-w-[120px]">{issue.assignee}</span>
                    </button>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
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
    <>
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col h-full">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 mb-3">Item Distribution</h2>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg inline-flex">
              <button
                onClick={() => setViewMode('current')}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  viewMode === 'current' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                Current Sprint
              </button>
              <button
                onClick={() => setViewMode('all')}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  viewMode === 'all' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                All
              </button>
            </div>
          </div>
          
          <div className="relative">
            <select
              value={itemType}
              onChange={(e) => setItemType(e.target.value as any)}
              className="appearance-none bg-slate-50 border border-slate-200 text-sm font-medium rounded-lg py-1.5 pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer text-slate-700"
            >
              <option value="User Stories">User Stories</option>
              <option value="Bugs">Bugs</option>
              <option value="Sub-Bugs">Sub-Bugs</option>
              <option value="All Items">All Items</option>
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        <div className="flex-1 min-h-[200px] w-full relative">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#1e293b', fontWeight: 500 }}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={36} 
                  iconType="circle" 
                  wrapperStyle={{ fontSize: '12px' }} 
                  formatter={(value, entry: any) => <span className="text-slate-700">{value} ({entry.payload.value})</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
              No {itemType.toLowerCase()} found
            </div>
          )}
        </div>

        <button 
          onClick={() => {
            setIsModalOpen(true);
            setIncludeDone(false);
            setSelectedAssignee('All');
            setSortConfig(null);
            setSearchQuery('');
          }}
          className="mt-4 w-full py-2 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
        >
          View All
        </button>
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex flex-col px-6 py-4 border-b border-slate-200 gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">All {itemType}</h2>
                  <p className="text-sm text-slate-500 mt-0.5">Detailed view across all sprints and backlog</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                    <button
                      onClick={() => setItemType(itemType === 'Bugs' ? 'All Items' : 'Bugs')}
                      className={cn(
                        "p-1.5 rounded-md transition-colors",
                        itemType === 'Bugs' ? "bg-white shadow-sm ring-1 ring-slate-200" : "hover:bg-slate-200/50"
                      )}
                      title="Bugs"
                    >
                      <Bug className="w-4 h-4 text-red-500" />
                    </button>
                    <button
                      onClick={() => setItemType(itemType === 'Sub-Bugs' ? 'All Items' : 'Sub-Bugs')}
                      className={cn(
                        "p-1.5 rounded-md transition-colors",
                        itemType === 'Sub-Bugs' ? "bg-white shadow-sm ring-1 ring-slate-200" : "hover:bg-slate-200/50"
                      )}
                      title="Sub-Bugs"
                    >
                      <Bug className="w-4 h-4 text-blue-500" />
                    </button>
                    <button
                      onClick={() => setItemType(itemType === 'User Stories' ? 'All Items' : 'User Stories')}
                      className={cn(
                        "p-1.5 rounded-md transition-colors",
                        itemType === 'User Stories' ? "bg-white shadow-sm ring-1 ring-slate-200" : "hover:bg-slate-200/50"
                      )}
                      title="User Stories"
                    >
                      <Bookmark className="w-4 h-4 text-green-500 fill-green-500" />
                    </button>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search items..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 pr-4 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-64 transition-all"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={includeDone}
                      onChange={(e) => setIncludeDone(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                    />
                    <span className="font-medium">Include Done</span>
                  </label>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              {uniqueAssignees.length > 1 && (
                <div className="flex overflow-x-auto pb-1 -mx-1 px-1 gap-2 scrollbar-hide">
                  {uniqueAssignees.map(assignee => (
                    <button
                      key={assignee}
                      onClick={() => setSelectedAssignee(selectedAssignee === assignee ? 'All' : assignee)}
                      className={cn(
                        "whitespace-nowrap px-3 py-1.5 text-xs font-medium rounded-full transition-colors shrink-0",
                        selectedAssignee === assignee
                          ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
                          : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
                      )}
                    >
                      {assignee}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {currentSprintIssues.length === 0 && nextSprintIssues.length === 0 && backlogIssues.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  No items found for this category.
                </div>
              ) : (
                <>
                  {renderTable("Current Sprint", currentSprintIssues)}
                  
                  {currentSprintIssues.length > 0 && (nextSprintIssues.length > 0 || backlogIssues.length > 0) && (
                    <hr className="border-t border-black my-8" />
                  )}
                  
                  {renderTable(nextSprintName ? `Next Sprint: ${nextSprintName}` : "Next Sprint", nextSprintIssues)}
                  
                  {nextSprintIssues.length > 0 && backlogIssues.length > 0 && (
                    <hr className="border-t border-black my-8" />
                  )}
                  
                  {renderTable("Backlog", backlogIssues)}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
