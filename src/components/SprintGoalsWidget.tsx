import React, { useMemo } from 'react';
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { JiraIssue } from './ItemDistributionWidget';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface SprintGoal {
  id: string;
  key: string;
  name: string;
  manualProgress: number | null;
}

export function parseSprintGoals(goalText: string): SprintGoal[] {
  if (!goalText) return [];
  const goals: SprintGoal[] = [];
  
  // Find all KESHET-\d+ occurrences
  const regex = /KESHET-\d+/g;
  const matches = goalText.match(regex);
  
  if (!matches) return [];
  
  // Deduplicate keys
  const uniqueKeys = [...new Set(matches)];
  
  for (const key of uniqueKeys) {
    // Try to find manual progress for this key in the text
    // Look for KESHET-123: 50% or (KESHET-123: 50%)
    const progressRegex = new RegExp(`${key}\\s*:\\s*(\\d+)%`);
    const progressMatch = goalText.match(progressRegex);
    const manualProgress = progressMatch ? parseInt(progressMatch[1], 10) : null;
    
    goals.push({
      id: key,
      key,
      name: key, // Default to key, will be overridden by Jira summary later
      manualProgress
    });
  }
  
  return goals;
}

// Extended interface to include potential epic/parent mapping
interface ExtendedJiraIssue extends JiraIssue {
  epicKey?: string;
  parentKey?: string;
}

interface SprintGoalsWidgetProps {
  goalText?: string;
  issues?: ExtendedJiraIssue[];
  sprintGoalIssues?: Record<string, { summary: string, url: string, fixVersion?: string, status?: string }>;
  activeSprintName?: string;
  team?: string;
  jiraBoardUrl?: string;
}

const TEAM_LOGOS: Record<string, { src: string; cls: string }> = {
  'v1':   { src: '/small_v1_logo.png',   cls: 'h-7 w-auto object-contain' },
  'mako': { src: '/small_mako_logo.png',  cls: 'h-7 w-auto object-contain' },
  'N12':  { src: '/small_n12_logo.png',   cls: 'h-7 w-auto object-contain' },
  '12+':  { src: '/small_12+_logo.png',   cls: 'h-[22px] w-auto object-contain' },
};

export default function SprintGoalsWidget({ goalText = '', issues = [], sprintGoalIssues = {}, activeSprintName, team, jiraBoardUrl }: SprintGoalsWidgetProps) {
  const goals = useMemo(() => parseSprintGoals(goalText), [goalText]);
  const sprintLogoEntry = team ? TEAM_LOGOS[team] : undefined;

  const goalsWithProgress = useMemo(() => {
    return goals.map(goal => {
      // Find issues associated with this goal (Epic or Parent)
      const relatedIssues = issues.filter(
        issue => issue.epicKey === goal.key || issue.parentKey === goal.key
      );

      let progress = 0;
      let hasIssueData = false;

      if (relatedIssues.length > 0) {
        hasIssueData = true;
        const doneIssues = relatedIssues.filter(i => 
          ['done', 'closed', 'resolved'].includes(i.status.toLowerCase())
        );
        progress = Math.round((doneIssues.length / relatedIssues.length) * 100);
      } else if (goal.manualProgress !== null) {
        progress = goal.manualProgress;
      }

      // Override name with Jira summary if available
      const jiraIssueData = sprintGoalIssues[goal.key];
      let displayName = jiraIssueData ? jiraIssueData.summary : goal.name;
      let url = jiraIssueData ? jiraIssueData.url : undefined;
      let fixVersion = jiraIssueData ? jiraIssueData.fixVersion : undefined;
      let status = jiraIssueData ? jiraIssueData.status : undefined;

      // Fallback to issues array (which contains all unresolved issues for the board)
      if (!jiraIssueData) {
        const foundIssue = issues.find(i => i.key === goal.key);
        if (foundIssue) {
          displayName = foundIssue.summary;
          url = foundIssue.url;
          fixVersion = foundIssue.fixVersion;
          status = foundIssue.status;
        }
      }

      return {
        ...goal,
        name: displayName,
        url,
        fixVersion,
        status,
        progress,
        hasIssueData,
        relatedCount: relatedIssues.length
      };
    });
  }, [goals, issues, sprintGoalIssues]);

  if (goals.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-start justify-between mb-6">
          <div>
            {activeSprintName && (
              <div className="flex items-center gap-2 mb-1">
                {sprintLogoEntry && (
                  <img src={sprintLogoEntry.src} alt="" className={sprintLogoEntry.cls} />
                )}
                <h2 className="text-2xl font-bold text-slate-900">
                  {activeSprintName}
                </h2>
              </div>
            )}
            <h3 className="text-base font-semibold text-slate-700">Sprint Strategic Goals</h3>
            <p className="text-sm text-slate-500">Progress tracked via Epics & Issues</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center text-center py-4 gap-3">
          <p className="text-sm font-semibold text-slate-700">🎯 No goals set for this sprint yet</p>
          <div className="text-sm text-slate-500 max-w-xs space-y-1 text-left">
            <p>To track progress, add your goals in Jira:</p>
            <ol className="list-decimal list-inside space-y-1 mt-1">
              <li>Click <span className="font-medium text-slate-600">•••</span> &gt; <span className="font-medium text-slate-600">Edit sprint</span></li>
              <li>Add goals to the <span className="font-medium text-slate-600">Sprint goal</span> field using the format:</li>
            </ol>
          </div>
          <code className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded font-mono border border-slate-200">
            Goal Name (KESHET-123)
          </code>
          {jiraBoardUrl && (
            <a
              href={jiraBoardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Go to Jira
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between mb-6">
        <div>
          {activeSprintName && (
            <div className="flex items-center gap-2 mb-1">
              {sprintLogoEntry && (
                <img src={sprintLogoEntry.src} alt="" className={sprintLogoEntry.cls} />
              )}
              <h2 className="text-2xl font-bold text-slate-900">
                {activeSprintName}
              </h2>
            </div>
          )}
          <h3 className="text-base font-semibold text-slate-700">Sprint Strategic Goals</h3>
          <p className="text-sm text-slate-500">Progress tracked via Epics & Issues</p>
        </div>
      </div>

      <div className="space-y-6">
        {goalsWithProgress.map((goal) => {
          // Determine semantic color based on status
          let colorClass = "bg-slate-500";
          let textClass = "text-slate-700";
          let bgClass = "bg-slate-100";
          
          const statusLower = (goal.status || '').toLowerCase();
          if (['done', 'closed', 'resolved'].includes(statusLower)) {
            colorClass = "bg-emerald-500";
            textClass = "text-emerald-700";
            bgClass = "bg-emerald-50";
          } else if (['in progress', 'active', 'in review'].includes(statusLower)) {
            colorClass = "bg-amber-500";
            textClass = "text-amber-700";
            bgClass = "bg-amber-50";
          } else if (statusLower) {
            colorClass = "bg-blue-500";
            textClass = "text-blue-700";
            bgClass = "bg-blue-50";
          }

          return (
            <div key={goal.id} className="group">
              <div className="flex items-start justify-between mb-2 gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {goal.url ? (
                      <a 
                        href={goal.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 hover:underline truncate" 
                        title={goal.name}
                        dir="auto"
                      >
                        {goal.name}
                      </a>
                    ) : (
                      <span className="text-sm font-semibold text-slate-900 truncate" title={goal.name} dir="auto">
                        {goal.name}
                      </span>
                    )}
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-slate-100 text-slate-600 shrink-0">
                      {goal.key}
                    </span>
                    {goal.fixVersion && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 shrink-0" dir="auto">
                        {goal.fixVersion}
                      </span>
                    )}
                  </div>
                  {goal.hasIssueData ? (
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      Tracking {goal.relatedCount} linked issues
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 italic flex items-center gap-1">
                      Manual progress tracking
                    </p>
                  )}
                </div>
                <div className={cn("text-sm font-bold shrink-0 px-2.5 py-1 rounded-md uppercase tracking-wide", bgClass, textClass)}>
                  {goal.status || 'Unknown'}
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={cn("h-full rounded-full transition-all duration-500 ease-out", colorClass)}
                  style={{ width: `${goal.progress}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
