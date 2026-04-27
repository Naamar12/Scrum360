import React, { useState, useEffect, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Legend, AreaChart, Area
} from 'recharts';
import {
  Shield, AlertTriangle, CheckCircle2, Clock, MessageSquare,
  Activity, Server, Calendar, Users, Bug, LayoutDashboard, Loader2, Layers, X, Sparkles,
  Search, HelpCircle, Bell
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import ItemDistributionWidget, { JiraIssue } from './components/ItemDistributionWidget';
import SprintGoalsWidget from './components/SprintGoalsWidget';
import ReleaseCubesWidget from './components/ReleaseCubesWidget';
import StuckTasksModal from './components/StuckTasksModal';
import NewItemsModal from './components/NewItemsModal';
import MasterPrompt from './components/MasterPrompt';
import SprintBriefingWidget from './components/SprintBriefingWidget';
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'master' | 'briefing'>('dashboard');
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
    setIssues([]); // Clear stale data so SprintBriefing detects the filter change
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
    <div className="min-h-screen text-slate-900 font-sans pb-12" style={{ background: '#f6f7fb' }}>
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center">
              <img src="/scrum360-wordmark-transparent.png" alt="Scrum360" className="h-9 w-auto object-contain" />
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
              <button
                onClick={() => setActiveTab('briefing')}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                  activeTab === 'briefing' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                Sprint Briefing
              </button>
            </nav>
          </div>
          
          <div className="flex items-center gap-3">
            <button className="w-[34px] h-[34px] rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors border-0" title="Search">
              <Search className="w-4 h-4" />
            </button>
            <button className="w-[34px] h-[34px] rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors border-0" title="Help">
              <HelpCircle className="w-4 h-4" />
            </button>
            <button className="w-[34px] h-[34px] rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors border-0" title="Notifications">
              <Bell className="w-4 h-4" />
            </button>
            <label htmlFor="global-filter" className="text-sm text-slate-500 ml-1">
              Global Filter:
            </label>
            <select
              id="global-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-white border border-slate-200 text-sm font-medium rounded-lg py-1.5 pl-3 pr-8 focus:ring-2 focus:ring-violet-500 focus:border-violet-400 cursor-pointer"
            >
              <option value="v1">v1</option>
              <option value="mako">mako</option>
              <option value="N12">N12</option>
              <option value="12+">12+</option>
            </select>
            <div className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-white text-xs font-semibold cursor-pointer" style={{ background: 'linear-gradient(135deg, #6b4cf5, #1fb893)' }} title="Profile">
              NR
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-[18px]">
        
        {activeTab === 'dashboard' ? (
          <>
            {/* SECURITY & ARCHITECTURE BANNER */}
            <div className="rounded-xl p-4 flex items-start gap-4 border" style={{ background: 'linear-gradient(180deg, #effaf3 0%, #ebf8f0 100%)', borderColor: '#cfeadb' }}>
              <div className="shrink-0 w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: '#d6f0e0', color: '#157246' }}>
                <Shield className="w-[18px] h-[18px]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-1">Secure Backend Architecture Active</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#1a2138' }}>
                  <strong style={{ color: '#136539' }}>Zero-Client Exposure:</strong> All API keys for Jira, Firebase, and Slack/Microsoft are securely managed on the Node.js backend via <code className="px-1.5 py-0.5 rounded text-xs font-mono" style={{ background: '#c8eed7', color: '#15633e', border: '1px solid #a5dec0' }}>.env</code>. The frontend only receives aggregated, sanitized JSON payloads through an internal authenticated API layer. No direct external calls are made from the browser.
                </p>
              </div>
            </div>

        {/* JIRA CONNECTION STATUS */}
        <div className="rounded-xl p-4 flex items-start gap-4 border" style={
          jiraStatus.loading
            ? { background: '#f8f9fc', borderColor: '#e7e9f1' }
            : jiraStatus.configured
              ? { background: 'linear-gradient(180deg, #eff3ff 0%, #ecf0fe 100%)', borderColor: '#d6dffb' }
              : { background: 'linear-gradient(180deg, #fffbeb 0%, #fef9e7 100%)', borderColor: '#fde68a' }
        }>
          <div className="shrink-0 w-9 h-9 rounded-[10px] flex items-center justify-center" style={
            jiraStatus.loading
              ? { background: '#e7e9f1', color: '#6b7390' }
              : jiraStatus.configured
                ? { background: '#d8e2fb', color: '#2a4cd1' }
                : { background: '#fef3c7', color: '#b45309' }
          }>
            {jiraStatus.loading
              ? <Loader2 className="w-[18px] h-[18px] animate-spin" />
              : jiraStatus.configured
                ? <CheckCircle2 className="w-[18px] h-[18px]" />
                : <AlertTriangle className="w-[18px] h-[18px]" />}
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-slate-900 mb-0.5">Jira API Status</h3>
            <p className="text-sm" style={{ color: '#1a2138' }}>
              {jiraStatus.configured
                ? <><strong style={{ color: '#2a4cd1' }}>Connected to Jira</strong> · {jiraStatus.message}</>
                : jiraStatus.message}
            </p>
          </div>
          {!jiraStatus.configured && !jiraStatus.loading && (
            <div className="text-xs font-medium bg-amber-100 text-amber-800 px-3 py-1.5 rounded-lg shrink-0">
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
            icon={<Calendar className="w-[18px] h-[18px]" style={{ color: '#4a30c8' }} />}
            iconBg="#efeaff"
            accentColor="#6b4cf5"
            trend="on-track"
          />
          <div onClick={() => setIsNewItemsModalOpen(true)} className="cursor-pointer">
            <KpiCard
              title="New Items"
              value={newItemsCount.toString()}
              sub="Created today"
              icon={<Sparkles className="w-[18px] h-[18px]" style={{ color: '#7a4d05' }} />}
              iconBg="#fff4dc"
              accentColor="#ffb020"
              trend="neutral"
            />
          </div>
          <KpiCard
            title="Crash-Free Users"
            value="99.8%"
            sub="Last 7 days (Firebase)"
            icon={<Activity className="w-[18px] h-[18px]" style={{ color: '#16744a' }} />}
            iconBg="#e9f7ef"
            accentColor="#1fb893"
            trend="up"
          />
          <div onClick={() => setIsStuckTasksModalOpen(true)} className="cursor-pointer">
            <KpiCard
              title="Stuck Tasks"
              value={stuckTasksCount.toString()}
              sub={`> ${stuckTasksThreshold / 24} days in ${stuckTasksStatus}`}
              icon={<Clock className="w-[18px] h-[18px]" style={{ color: '#b03217' }} />}
              iconBg="#fde6e1"
              accentColor="#ff5b3a"
              trend="down"
            />
          </div>
          <div onClick={() => setIsReleaseModalOpen(true)} className="cursor-pointer">
            <KpiCard
              title="Release versions"
              value={releaseVersionsCount.toString()}
              sub="Click to view priorities"
              icon={<Layers className="w-[18px] h-[18px]" style={{ color: '#2a4cd1' }} />}
              iconBg="#ecf1ff"
              accentColor="#2f7bff"
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
        ) : activeTab === 'briefing' ? (
          <SprintBriefingWidget key={filter} issues={issues} activeSprintName={activeSprintName} filter={filter} />
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

function KpiCard({ title, value, sub, icon, iconBg, accentColor, trend }: {
  title: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  iconBg?: string;
  accentColor?: string;
  trend: 'up' | 'down' | 'neutral' | 'on-track';
}) {
  return (
    <div
      className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-2.5 relative overflow-hidden transition-all duration-150 hover:-translate-y-px hover:border-slate-300 hover:shadow-md group"
    >
      {accentColor && (
        <div
          className="absolute inset-x-0 top-0 h-[3px] opacity-0 group-hover:opacity-100 transition-opacity duration-150"
          style={{ background: accentColor }}
        />
      )}
      <div
        className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center"
        style={{ background: iconBg ?? '#f1f3f9' }}
      >
        {icon}
      </div>
      <p className="text-[13px] font-medium text-slate-500">{title}</p>
      <h3 className="text-[26px] font-bold leading-none tracking-tight text-slate-900" style={{ fontFamily: "'Poppins', 'Inter', sans-serif", letterSpacing: '-0.02em' }}>{value}</h3>
      <p className="text-xs text-slate-400">{sub}</p>
    </div>
  );
}
