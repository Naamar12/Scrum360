import React, { useState, useEffect, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Legend, AreaChart, Area
} from 'recharts';
import { 
  Shield, AlertTriangle, CheckCircle2, Clock, MessageSquare, 
  Activity, Server, Calendar, Users, Bug, LayoutDashboard, Loader2, Layers, X, Sparkles
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import ItemDistributionWidget, { JiraIssue } from './components/ItemDistributionWidget';
import SprintGoalsWidget from './components/SprintGoalsWidget';
import ReleaseCubesWidget from './components/ReleaseCubesWidget';
import StuckTasksModal from './components/StuckTasksModal';
import NewItemsModal from './components/NewItemsModal';
import MasterPrompt from './components/MasterPrompt';
import DeployedMessagesWidget from './components/DeployedMessagesWidget';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- MOCK DATA FALLBACKS ---
const defaultBurndownData = [
  { day: 'Day 1', ideal: 100, actual: 100 },
  { day: 'Day 2', ideal: 90, actual: 95 },
  { day: 'Day 3', ideal: 80, actual: 85 },
  { day: 'Day 4', ideal: 70, actual: 70 },
  { day: 'Day 5', ideal: 60, actual: 65 },
  { day: 'Day 6', ideal: 50, actual: 45 },
  { day: 'Day 7', ideal: 40, actual: null },
  { day: 'Day 8', ideal: 30, actual: null },
  { day: 'Day 9', ideal: 20, actual: null },
  { day: 'Day 10', ideal: 0, actual: null },
];

const velocityData = [
  { sprint: 'Sprint 41', completed: 85, committed: 90 },
  { sprint: 'Sprint 42', completed: 92, committed: 95 },
  { sprint: 'Sprint 43', completed: 78, committed: 85 },
  { sprint: 'Sprint 44', completed: 95, committed: 90 },
  { sprint: 'Sprint 45', completed: 88, committed: 95 },
];

const topCrashes = [
  { id: 'CR-892', title: 'NullReferenceException in AuthFlow', users: 142, trend: '+12%' },
  { id: 'CR-895', title: 'Timeout on Video Player Init', users: 89, trend: '-5%' },
  { id: 'CR-901', title: 'Memory Leak in FeedList', users: 45, trend: '+2%' },
];

const slackMentions = [
  { time: '10:15 AM', user: 'David (Backend)', msg: 'Blocker: Waiting for DB schema approval to proceed with the API.', channel: '#dev-backend' },
  { time: '09:30 AM', user: 'Sarah (QA)', msg: 'Urgent: The staging environment is down again, cannot test the new release.', channel: '#qa-team' },
  { time: 'Yesterday', user: 'Mike (iOS)', msg: 'Blocker: Need the updated design assets for the onboarding screen.', channel: '#design-sync' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'master'>('dashboard');
  const [filter, setFilter] = useState('v1');
  const [burndownData, setBurndownData] = useState(defaultBurndownData);
  const [issues, setIssues] = useState<JiraIssue[]>([]);
  const [sprintGoalText, setSprintGoalText] = useState<string>('');
  const [sprintGoalIssues, setSprintGoalIssues] = useState<Record<string, { summary: string, url: string, fixVersion?: string, status?: string }>>({});
  const [activeSprintName, setActiveSprintName] = useState<string | undefined>();
  const [nextSprintName, setNextSprintName] = useState<string | undefined>();
  const [sprintDay, setSprintDay] = useState<string>("Day X of 10");
  const [sprintDaysRemaining, setSprintDaysRemaining] = useState<string>("X days remaining");
  const [jiraStatus, setJiraStatus] = useState<{loading: boolean, configured: boolean, message: string}>({
    loading: true,
    configured: false,
    message: 'Connecting to backend...'
  });
  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false);
  const [isStuckTasksModalOpen, setIsStuckTasksModalOpen] = useState(false);
  const [isNewItemsModalOpen, setIsNewItemsModalOpen] = useState(false);
  const [stuckTasksThreshold, setStuckTasksThreshold] = useState<number>(72);
  const [stuckTasksStatus, setStuckTasksStatus] = useState<string>('In Progress');

  const releaseVersionsCount = useMemo(() => {
    const versions = new Set<string>();
    issues.filter(issue => issue.sprintState === 'active').forEach(issue => {
      const versionStr = issue.fixVersion || 'no fix version';
      versionStr.split(',').map(v => v.trim()).filter(v => v !== 'no fix version' && v !== '').forEach(v => versions.add(v));
    });
    return versions.size;
  }, [issues]);

  const stuckTasksCount = useMemo(() => {
    const now = new Date().getTime();
    return issues.filter(issue => {
      if (issue.type.toLowerCase() !== 'sub-task') return false;
      if (issue.sprintState !== 'active') return false;
      
      const normalizedIssueStatus = issue.status.toLowerCase().replace(/[_-\s]/g, '');
      const normalizedFilterStatus = stuckTasksStatus.toLowerCase().replace(/[_-\s]/g, '');
      if (normalizedIssueStatus !== normalizedFilterStatus) return false;
      
      if (!issue.statusChangedDate) return false;
      
      const changedDate = new Date(issue.statusChangedDate).getTime();
      const hoursSinceChange = (now - changedDate) / (1000 * 60 * 60);
      return hoursSinceChange >= stuckTasksThreshold;
    }).length;
  }, [issues, stuckTasksThreshold, stuckTasksStatus]);

  const newItemsCount = useMemo(() => {
    const today = new Date();
    return issues.filter(issue => {
      if (!issue.createdDate) return false;
      const date = new Date(issue.createdDate);
      return date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear();
    }).length;
  }, [issues]);

  // Fetch Jira data from our secure backend
  useEffect(() => {
    async function fetchJiraData() {
      setJiraStatus(prev => ({ ...prev, loading: true }));
      try {
        const res = await fetch(`/api/jira/sprint?team=${encodeURIComponent(filter)}`);
        
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Backend API error');
        }
        
        const data = await res.json();
        setJiraStatus({
          loading: false,
          configured: data.configured,
          message: data.message
        });
        
        if (data.burndown) {
          setBurndownData(data.burndown);
        }
        
        if (data.issues) {
          setIssues(data.issues);
        } else {
          setIssues([]);
        }
        
        if (data.activeSprintName) {
          setActiveSprintName(data.activeSprintName);
        } else {
          setActiveSprintName(undefined);
        }

        if (data.nextSprintName) {
          setNextSprintName(data.nextSprintName);
        } else {
          setNextSprintName(undefined);
        }

        if (data.sprintDay) {
          setSprintDay(data.sprintDay);
        }
        if (data.sprintDaysRemaining) {
          setSprintDaysRemaining(data.sprintDaysRemaining);
        }

        setSprintGoalText(data.sprintGoal || '');
        setSprintGoalIssues(data.sprintGoalIssues || {});
      } catch (err: any) {
        console.error("Failed to fetch from backend:", err);
        setJiraStatus({
          loading: false,
          configured: false,
          message: err.message || 'Failed to connect to backend API. Showing mock data.'
        });
      }
    }

    fetchJiraData();
  }, [filter]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-12">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-2 rounded-lg">
                <LayoutDashboard className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">Scrum360</h1>
            </div>
            
            <nav className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <button 
                onClick={() => setActiveTab('dashboard')}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-colors", 
                  activeTab === 'dashboard' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                Dashboard
              </button>
              <button 
                onClick={() => setActiveTab('master')}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-colors", 
                  activeTab === 'master' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                Master Prompt
              </button>
            </nav>
          </div>
          
          <div className="flex items-center gap-4">
            <label htmlFor="global-filter" className="text-sm font-medium text-slate-500">
              Global Filter:
            </label>
            <select
              id="global-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-slate-100 border-none text-sm font-medium rounded-md py-2 pl-3 pr-8 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="v1">v1</option>
              <option value="mako">mako</option>
              <option value="N12">N12</option>
              <option value="12+">12+</option>
            </select>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {activeTab === 'dashboard' ? (
          <>
            {/* SECURITY & ARCHITECTURE BANNER */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-4">
          <div className="bg-emerald-100 p-2 rounded-full shrink-0">
            <Shield className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-emerald-900">Secure Backend Architecture Active</h3>
            <p className="text-sm text-emerald-800 mt-1 leading-relaxed">
              <strong>Zero-Client Exposure:</strong> All API keys for Jira, Firebase, and Slack/Microsoft are securely managed on the Node.js backend via <code className="bg-emerald-200 px-1 rounded text-xs">.env</code>. The frontend only receives aggregated, sanitized JSON payloads through an internal authenticated API layer. No direct external calls are made from the browser.
            </p>
          </div>
        </div>

        {/* JIRA CONNECTION STATUS */}
        <div className={cn(
          "border rounded-xl p-4 flex items-center justify-between",
          jiraStatus.loading ? "bg-slate-50 border-slate-200" :
          jiraStatus.configured ? "bg-indigo-50 border-indigo-200" : "bg-amber-50 border-amber-200"
        )}>
          <div className="flex items-center gap-3">
            {jiraStatus.loading ? (
              <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
            ) : jiraStatus.configured ? (
              <CheckCircle2 className="w-5 h-5 text-indigo-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            )}
            <div>
              <h3 className={cn(
                "text-sm font-semibold",
                jiraStatus.loading ? "text-slate-700" :
                jiraStatus.configured ? "text-indigo-900" : "text-amber-900"
              )}>
                Jira API Status
              </h3>
              <p className={cn(
                "text-sm mt-0.5",
                jiraStatus.loading ? "text-slate-500" :
                jiraStatus.configured ? "text-indigo-700" : "text-amber-700"
              )}>
                {jiraStatus.message}
              </p>
            </div>
          </div>
          {!jiraStatus.configured && !jiraStatus.loading && (
            <div className="text-xs font-medium bg-amber-100 text-amber-800 px-3 py-1.5 rounded-lg">
              Action Required: Add Jira keys to Settings
            </div>
          )}
        </div>

        {/* KPI STRIP */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiCard 
            title="Sprint Progress" 
            value={sprintDay} 
            sub={sprintDaysRemaining} 
            icon={<Calendar className="w-5 h-5 text-indigo-600" />} 
            trend="on-track"
          />
          <div onClick={() => setIsNewItemsModalOpen(true)} className="cursor-pointer transition-transform hover:scale-105">
            <KpiCard 
              title="New Items" 
              value={newItemsCount.toString()} 
              sub="Created today" 
              icon={<Sparkles className="w-5 h-5 text-amber-600" />} 
              trend="neutral"
            />
          </div>
          <KpiCard 
            title="Crash-Free Users" 
            value="99.8%" 
            sub="Last 7 days (Firebase)" 
            icon={<Activity className="w-5 h-5 text-emerald-600" />} 
            trend="up"
          />
          <div onClick={() => setIsStuckTasksModalOpen(true)} className="cursor-pointer transition-transform hover:scale-105">
            <KpiCard 
              title="Stuck Tasks" 
              value={stuckTasksCount.toString()} 
              sub={`> ${stuckTasksThreshold / 24} days in ${stuckTasksStatus}`} 
              icon={<Clock className="w-5 h-5 text-rose-600" />} 
              trend="down"
            />
          </div>
          <div onClick={() => setIsReleaseModalOpen(true)} className="cursor-pointer transition-transform hover:scale-105">
            <KpiCard 
              title="Release versions" 
              value={releaseVersionsCount.toString()} 
              sub="Click to view priorities" 
              icon={<Layers className="w-5 h-5 text-indigo-600" />} 
              trend="neutral"
            />
          </div>
        </div>

        {/* SPRINT GOALS */}
        <div className="grid grid-cols-1 gap-6">
          <SprintGoalsWidget goalText={sprintGoalText} issues={issues} sprintGoalIssues={sprintGoalIssues} activeSprintName={activeSprintName} />
        </div>

        {/* MAIN BODY - ROW 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* SPRINT BURNDOWN (JIRA) */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 lg:col-span-2 shadow-sm relative">
            {jiraStatus.loading && (
              <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              </div>
            )}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Sprint Burndown</h2>
                <p className="text-sm text-slate-500">
                  {jiraStatus.configured ? "Live from Jira" : "Mock Data (Jira not configured)"}
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                <CheckCircle2 className="w-3.5 h-3.5" /> On Track
              </span>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={burndownData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                  <Line type="monotone" dataKey="ideal" name="Ideal Guideline" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  <Line type="monotone" dataKey="actual" name="Actual Remaining" stroke="#4f46e5" strokeWidth={3} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ITEM DISTRIBUTION (JIRA) */}
          <ItemDistributionWidget issues={issues} nextSprintName={nextSprintName} />
        </div>

        {/* MAIN BODY - ROW 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* TEAM PULSE (SLACK) */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Team Pulse: Urgent & Blockers</h2>
                <p className="text-sm text-slate-500">Slack / Outlook Integration</p>
              </div>
              <MessageSquare className="w-5 h-5 text-slate-400" />
            </div>
            <div className="space-y-4">
              {slackMentions.map((mention, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                    <span className="text-indigo-700 font-semibold text-sm">
                      {mention.user.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1 pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-900">{mention.user}</p>
                      <span className="text-xs text-slate-500">{mention.time}</span>
                    </div>
                    <p className="text-sm text-slate-700 mt-1">
                      {/* Highlight "Blocker" or "Urgent" */}
                      {mention.msg.split(/(Blocker:|Urgent:)/).map((part, i) => 
                        /(Blocker:|Urgent:)/.test(part) ? 
                          <span key={i} className="font-semibold text-rose-600">{part}</span> : 
                          <span key={i}>{part}</span>
                      )}
                    </p>
                    <p className="text-xs text-slate-400 mt-2 font-mono">{mention.channel}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* VELOCITY TREND (JIRA) */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="mb-6">
              <h2 className="text-base font-semibold text-slate-900">Velocity Trend</h2>
              <p className="text-sm text-slate-500">Last 5 Sprints</p>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={velocityData} margin={{ top: 5, right: 0, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="sprint" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip 
                    cursor={{ fill: '#f1f5f9' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Bar dataKey="committed" name="Committed" fill="#cbd5e1" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="completed" name="Completed" fill="#4f46e5" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* DEPLOYED-VERSIONS MESSAGES BY FILTER */}
        <DeployedMessagesWidget filter={filter} />


          </>
        ) : (
          <MasterPrompt />
        )}

      </main>

      {/* RELEASE CUBES MODAL */}
      {isReleaseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col relative">
            <button 
              onClick={() => setIsReleaseModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="overflow-y-auto p-1">
              <ReleaseCubesWidget issues={issues} />
            </div>
          </div>
        </div>
      )}

      {/* STUCK TASKS MODAL */}
      {isStuckTasksModalOpen && (
        <StuckTasksModal 
          issues={issues} 
          thresholdHours={stuckTasksThreshold}
          onThresholdChange={setStuckTasksThreshold}
          statusFilter={stuckTasksStatus}
          onStatusFilterChange={setStuckTasksStatus}
          onClose={() => {
            setIsStuckTasksModalOpen(false);
            setStuckTasksThreshold(72);
            setStuckTasksStatus('In Progress');
          }} 
        />
      )}

      {/* NEW ITEMS MODAL */}
      {isNewItemsModalOpen && (
        <NewItemsModal 
          issues={issues}
          onClose={() => setIsNewItemsModalOpen(false)}
        />
      )}
    </div>
  );
}

// --- HELPER COMPONENTS ---

function KpiCard({ title, value, sub, icon, trend }: { title: string, value: string, sub: string, icon: React.ReactNode, trend: 'up' | 'down' | 'neutral' | 'on-track' }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
          {icon}
        </div>
        {/* Optional trend indicator could go here */}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
        <p className="text-xs text-slate-400 mt-1">{sub}</p>
      </div>
    </div>
  );
}
