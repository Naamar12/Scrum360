import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Reorder, AnimatePresence, motion } from 'motion/react';
import { GripVertical, Layers, ExternalLink, ChevronDown, ChevronUp, Search, CheckCircle2, Bug, Bookmark, CheckSquare } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { JiraIssue } from './ItemDistributionWidget';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const isCreatedToday = (dateString?: string) => {
  if (!dateString) return false;
  const date = new Date(dateString);
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
};

interface ReleaseCubesWidgetProps {
  issues: JiraIssue[];
  deployedMessages?: { timestamp: string; text: string }[];
  highlightVersion?: string;
}

const VERSION_RE = /\b(\d+\.\d+(?:\.\d+)?)\b/g;

function extractVersions(text: string): string[] {
  return [...new Set(Array.from(text.matchAll(VERSION_RE), m => m[1]))];
}

function formatDeployDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
}

export default function ReleaseCubesWidget({ issues, deployedMessages, highlightVersion }: ReleaseCubesWidgetProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedReleases, setExpandedReleases] = useState<Record<string, boolean>>({});

  // Group issues by fixVersion
  const releases = useMemo(() => {
    const groups: Record<string, JiraIssue[]> = {};
    issues.filter(issue => issue.sprintState === 'active').forEach(issue => {
      const versionStr = issue.fixVersion || 'no fix version';
      const versions = versionStr.split(',').map(v => v.trim()).filter(v => v !== 'no fix version' && v !== '');
      
      if (versions.length === 0) return;

      versions.forEach(v => {
        if (!groups[v]) {
          groups[v] = [];
        }
        groups[v].push(issue);
      });
    });
    return groups;
  }, [issues]);

  const [orderedReleases, setOrderedReleases] = useState<string[]>([]);
  const [sprintGoals, setSprintGoals] = useState<Record<string, boolean>>({});
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Map from version string -> latest deployment timestamp from Slack
  const deployedVersionMap = useMemo(() => {
    if (!deployedMessages?.length) return {} as Record<string, string>;
    const map: Record<string, string> = {};
    for (const msg of deployedMessages) {
      for (const v of extractVersions(msg.text)) {
        if (!map[v] || msg.timestamp > map[v]) map[v] = msg.timestamp;
      }
    }
    return map;
  }, [deployedMessages]);

  // Initialize order when releases change
  useEffect(() => {
    const newReleases = Object.keys(releases);
    setOrderedReleases(prev => {
      const prevSet = new Set(prev);
      const newSet = new Set(newReleases);
      
      if (prevSet.size === newSet.size && [...prevSet].every(x => newSet.has(x))) {
        return prev;
      }
      
      const updatedOrder = prev.filter(r => newSet.has(r));
      const added = newReleases.filter(r => !prevSet.has(r));
      return [...updatedOrder, ...added];
    });
  }, [releases]);

  useEffect(() => {
    if (!highlightVersion || !orderedReleases.length) return;
    const match = orderedReleases.find(r => extractVersions(r).includes(highlightVersion));
    if (!match) return;
    setExpandedReleases(prev => ({ ...prev, [match]: true }));
    setTimeout(() => itemRefs.current[match]?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
  }, [highlightVersion, orderedReleases]);

  const toggleSprintGoal = (e: React.MouseEvent, releaseName: string) => {
    e.stopPropagation();
    setSprintGoals(prev => ({
      ...prev,
      [releaseName]: !prev[releaseName]
    }));
  };

  const toggleExpand = (releaseName: string) => {
    setExpandedReleases(prev => ({
      ...prev,
      [releaseName]: !prev[releaseName]
    }));
  };

  const filteredReleases = orderedReleases.filter(r => r.toLowerCase().includes(searchQuery.toLowerCase()));

  if (orderedReleases.length === 0) {
    return null;
  }

  // Helper to get domain from an issue url
  const getJiraDomain = () => {
    if (issues.length > 0 && issues[0].url) {
      try {
        const urlObj = new URL(issues[0].url);
        return urlObj.origin;
      } catch (e) {
        return '';
      }
    }
    return '';
  };
  const jiraDomain = getJiraDomain();

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('done') || s.includes('resolved') || s.includes('closed')) return 'bg-emerald-500';
    if (s.includes('to do') || s.includes('open') || s.includes('backlog') || s.includes('new')) return 'bg-cyan-400';
    return 'bg-teal-600';
  };

  const getStatusCategory = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('done') || s.includes('resolved') || s.includes('closed')) return 'done';
    if (s.includes('to do') || s.includes('open') || s.includes('backlog') || s.includes('new')) return 'todo';
    return 'inprogress';
  };

  const isDone = (status: string) => {
    const s = status.toLowerCase();
    return s.includes('done') || s.includes('resolved') || s.includes('closed');
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Release Priorities <span className="text-slate-500 font-normal">({orderedReleases.length} Release versions)</span>
          </h2>
          <p className="text-sm text-slate-500">Drag to reorder. Click to expand. Mark as Sprint Goal to highlight.</p>
        </div>
        <div className="bg-indigo-50 p-2 rounded-lg">
          <Layers className="w-5 h-5 text-indigo-600" />
        </div>
      </div>

      <div className="relative mb-4 shrink-0">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-slate-400" />
        </div>
        <input
          type="text"
          placeholder="Filter releases by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
        />
      </div>

      <div className="overflow-y-auto flex-1 pr-1 min-h-0">
        <Reorder.Group 
          axis="y" 
          values={filteredReleases} 
          onReorder={(newOrder) => {
            // Only update the order of the filtered items within the main list
            const newFullOrder = [...orderedReleases];
            let filteredIndex = 0;
            for (let i = 0; i < newFullOrder.length; i++) {
              if (filteredReleases.includes(newFullOrder[i])) {
                newFullOrder[i] = newOrder[filteredIndex];
                filteredIndex++;
              }
            }
            setOrderedReleases(newFullOrder);
          }}
          className="space-y-3"
        >
          {filteredReleases.map((releaseName) => {
            const releaseIssues = releases[releaseName] || [];
            const isSprintGoal = sprintGoals[releaseName];
            const isExpanded = expandedReleases[releaseName];

            const todoCount = releaseIssues.filter(i => getStatusCategory(i.status) === 'todo').length;
            const doneCount = releaseIssues.filter(i => getStatusCategory(i.status) === 'done').length;
            const inProgressCount = releaseIssues.length - todoCount - doneCount;

            const total = releaseIssues.length || 1;
            const todoPercent = (todoCount / total) * 100;
            const inProgressPercent = (inProgressCount / total) * 100;
            const donePercent = (doneCount / total) * 100;

            const releaseUrl = jiraDomain ? `${jiraDomain}/issues/?jql=fixVersion="${encodeURIComponent(releaseName)}"` : '#';

            // Deployed badge
            const releaseVersions = extractVersions(releaseName);
            const deployedTimestamp = releaseVersions.map(v => deployedVersionMap[v]).filter(Boolean).sort().pop();
            const isDeployed = !!deployedTimestamp;

            // Highlight when version tag was clicked in DeployedMessagesWidget
            const isHighlighted = !!highlightVersion && releaseVersions.includes(highlightVersion);

            return (
              <Reorder.Item
                key={releaseName}
                value={releaseName}
                className={cn(
                  "bg-white rounded-lg shadow-sm overflow-hidden flex flex-col transition-all",
                  isHighlighted ? "border-2 border-amber-400 ring-2 ring-amber-100" :
                  isSprintGoal ? "border-2 border-indigo-400 bg-indigo-50/30" : "border border-slate-200"
                )}
              >
                <div ref={el => { itemRefs.current[releaseName] = el; }} />
                {/* Header (Accordion Toggle) */}
                <div
                  className={cn(
                    "px-4 py-3 flex items-center justify-between cursor-pointer transition-colors group",
                    isHighlighted ? "bg-amber-50/50" : isSprintGoal ? "bg-indigo-50/50" : "hover:bg-slate-50"
                  )}
                  onClick={() => toggleExpand(releaseName)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-slate-400 hover:text-slate-600 shrink-0" onClick={e => e.stopPropagation()}>
                      <GripVertical className="w-5 h-5" />
                    </div>
                    
                    <div className="flex items-center justify-between w-full gap-4">
                      {/* Title */}
                      <div className="min-w-[150px] max-w-[280px] flex flex-col gap-0.5">
                        <a
                          href={releaseUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className={cn(
                            "text-base font-bold truncate hover:underline flex items-center gap-1",
                            isHighlighted ? "text-amber-700" : isSprintGoal ? "text-indigo-700" : "text-slate-800"
                          )}
                          title="Open release in Jira"
                        >
                          <span className="truncate">{releaseName}</span>
                          <ExternalLink className="w-3.5 h-3.5 opacity-50 shrink-0" />
                        </a>
                      </div>
                      
                      {/* Items, Progress Bar, Checkbox with equal spacing */}
                      <div className="flex items-center justify-between flex-1 ml-4 gap-4">
                        {/* Items */}
                        <div className="flex-1 flex justify-center">
                          <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
                            {releaseIssues.length} items
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="flex-[2] flex justify-center">
                          <div className="flex flex-col w-full max-w-[200px]">
                            <div className="flex justify-between text-[10px] font-medium text-slate-600 mb-1 px-0.5">
                              <span className="w-1/3 text-left">{todoCount}</span>
                              <span className="w-1/3 text-center">{inProgressCount}</span>
                              <span className="w-1/3 text-right">{doneCount}</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden flex">
                              <div className="h-full bg-cyan-400 transition-all duration-500" style={{ width: `${todoPercent}%` }} />
                              <div className="h-full bg-teal-600 transition-all duration-500" style={{ width: `${inProgressPercent}%` }} />
                              <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${donePercent}%` }} />
                            </div>
                            <div className="flex justify-between text-[10px] font-medium mt-1 px-0.5">
                              <span className="w-1/3 text-left text-cyan-600">To do</span>
                              <span className="w-1/3 text-center text-teal-700">In progress</span>
                              <span className="w-1/3 text-right text-emerald-600">Done</span>
                            </div>
                          </div>
                        </div>

                        {/* Checkbox */}
                        <div className="flex-1 flex justify-end">
                          <label 
                            className="flex items-center gap-1.5 cursor-pointer"
                            onClick={e => e.stopPropagation()}
                          >
                            <input 
                              type="checkbox" 
                              checked={!!isSprintGoal}
                              onChange={(e) => toggleSprintGoal(e as any, releaseName)}
                              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                            />
                            <span className={cn(
                              "text-xs font-semibold select-none whitespace-nowrap",
                              isSprintGoal ? "text-indigo-700" : "text-slate-500"
                            )}>Sprint Goal</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center ml-4 shrink-0">
                    <div className="text-slate-400">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </div>

                {/* Content - Issues List */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-slate-100"
                    >
                      <div className="p-4 bg-white max-h-60 overflow-y-auto">
                        <ul className="space-y-2.5">
                          {releaseIssues.map(issue => (
                            <li key={issue.id} className="flex items-start gap-2 text-sm group/item">
                              <div className="mt-1.5 shrink-0">
                                <div className={cn("w-2 h-2 rounded-full", getStatusColor(issue.status))} title={issue.status} />
                              </div>
                              <div className="mt-0.5 shrink-0">
                                {issue.type.toLowerCase().includes('bug') ? (
                                  <Bug className={cn("w-3.5 h-3.5", issue.type.toLowerCase().includes('sub') ? "text-blue-500" : "text-red-500")} />
                                ) : issue.type.toLowerCase().includes('story') ? (
                                  <Bookmark className="w-3.5 h-3.5 text-green-500 fill-green-500" />
                                ) : issue.type.toLowerCase() === 'task' ? (
                                  <CheckSquare className="w-3.5 h-3.5 text-purple-500" />
                                ) : null}
                              </div>
                              <span className="font-mono text-xs text-slate-500 mt-0.5 shrink-0">{issue.key}</span>
                              <span className="text-slate-400 mt-0.5 shrink-0">·</span>
                              <div className="flex-1 min-w-0 flex items-start gap-1.5">
                                {isCreatedToday(issue.createdDate) && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0 mt-0.5">New</span>
                                )}
                                <a
                                  href={issue.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-slate-700 hover:text-indigo-600 hover:underline line-clamp-2 relative"
                                  title={`Assignee: ${issue.assignee}`}
                                >
                                  {issue.summary}
                                </a>
                              </div>
                              <span className="text-slate-400 mt-0.5 shrink-0">·</span>
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 shrink-0 whitespace-nowrap mt-0.5">
                                {issue.status}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Reorder.Item>
            );
          })}
        </Reorder.Group>
      </div>
    </div>
  );
}
