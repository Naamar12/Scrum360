import React, { useState } from 'react';
import { Copy, Check, FileText } from 'lucide-react';

const masterPromptText = `Build a comprehensive React dashboard called "Scrum360" using Vite, Tailwind CSS, Lucide React, and Recharts. The app should have a Node.js/Express backend to fetch live data from the Jira Agile API.

Key Features & Requirements:

1. Global Filter & Backend Mapping:
   - Top navigation dropdown to select teams: "v1", "mako", "N12", "12+".
   - The Node.js backend must map "mako" to "mako3" and "12+" to "12+scrum" when querying Jira Board IDs.

2. Sprint Progress KPI:
   - Dynamically calculate the current sprint day (e.g., "Day 3 of 10") and "X days remaining".
   - Assume a 2-week sprint (10 working days), excluding Fridays and Saturdays (Israel work week).
   - Base the calculation on the active sprint's \`startDate\` fetched from Jira, normalizing dates to midnight to avoid partial day issues.

3. Sprint Goals Widget:
   - Fetch sprint goals and their linked issues from Jira.
   - Display the active sprint's name as a large, bold heading above the "Sprint Strategic Goals" title (which should be colored red).
   - Display the goal name, Jira Key, Fix Version (default to 'no fix version' if missing), and Status.
   - Color-code the status badge: Green for Done/Closed/Resolved, Yellow for In Progress/Active/In Review, Blue for others.

4. Item Distribution Widget:
   - Donut chart and data table showing the distribution of Bugs, Sub-Bugs, and User Stories.
   - Visually distinguish issue types: use different icon shapes/colors per type (e.g., red circle for Bug, orange triangle for Sub-Bug, blue square for User Story).
   - Include a toggle below the title for "Current Sprint" (default, showing only active sprint issues) and "All".
   - Include a "View All" modal that categorizes issues by Current Sprint, Next Sprint, and Backlog.
   - Modal features: Filter by Assignee, Search by text/key, Sort by Assignee/Status, and an "Include Done" checkbox.
   - When viewing "Sub-Bugs" in the modal, display a "Parent" column to the right of "Item Name" showing the parent story's summary with a link to the Jira ticket.

5. Stuck Tasks Alert:
   - A "Stuck Tasks" KPI card showing the number of sub-tasks stuck in a given status for longer than a configurable threshold.
   - The KPI sub-label shows the threshold in days (e.g., "> 3 days in In Progress").
   - Clicking the KPI card opens a modal with a table showing those sub-tasks.
   - A dropdown above the table allows selecting the threshold: 12, 24, 48, 72 hours (displayed in days in the KPI label).
   - The table includes columns for the Sub-task and its Parent Story, both as hyperlinks to Jira.

6. New Items KPI:
   - A "New Items" KPI card showing the count of Jira issues created today in the active sprint.
   - Clicking it opens a modal listing those issues.
   - Issues created today display a "New" badge in the item list.

7. Release Priorities Widget:
   - A "Release versions" KPI card showing the number of distinct Fix Versions in the active sprint.
   - Clicking it opens a modal with draggable accordion cubes, each representing a Fix Version.
   - The title shows the count in the format "(X Release versions)".
   - Includes a search bar to filter releases by name.
   - Allows manual drag-and-drop reordering based on priority.
   - Each cube is collapsible: collapsed shows release name, item count, and a "Done %" progress bar.
   - The release name links to Jira.
   - A "Sprint Goal" checkbox highlights the cube with a prominent border/background.
   - When expanded, shows issues with a colored status dot (green=done, yellow=in progress, gray=other), key, summary, and status.
   - Hovering over an issue summary shows a tooltip with the assignee name.

8. Deployed Messages Widget:
   - Displays Slack messages from #deployed-versions, filtered by the active Global Filter user.
   - Extracts and displays platform tags from message text: iOS, Android, AndroidTV, AppleTV, SmartTV, Web, Backend, WADM, WEM, DOMO, BQ, Responsive — each with a distinct color badge.
   - Extracts version numbers (e.g., 1.2.3) and shows them as version badges.
   - Groups messages by date: "Today", "Yesterday", or a formatted date.
   - Includes a search bar that filters messages and highlights matched terms in the text.
   - Includes a multi-select platform filter to show only messages for specific platforms.

9. Sprint Briefing Generator:
   - A dedicated "Sprint Briefing" tab in the top navigation.
   - The Scrum Master types free-text notes from the Sprint Planning session into a textarea (RTL-aware, dir="auto").
   - A "Generate Briefing" button sends the free text plus all active sprint issues (key, type, assignee, status, summary) to a backend endpoint POST /api/sprint-briefing.
   - The backend calls Gemini 2.0 Flash (via @google/genai) with a structured prompt.
   - The prompt instructs Gemini to produce per-developer sections, each containing:
       ## [Developer Name]
       ### Focus Headline — their main sprint goal (1 sentence)
       ### Priority List — numbered, each task as a Markdown link to Jira
       ### Context / Dependencies — brief note on importance or blockers
       ### Quick Tip — one technical or personal emphasis
   - The Jira base URL is built from the JIRA_DOMAIN env var: https://{domain}.atlassian.net/browse
   - The frontend renders the returned Markdown with a built-in renderer (no external library): h2/h3 headings, bold, numbered/bullet lists, and clickable links styled in indigo.
   - Shows count of active sprint issues loaded, and a loading spinner during generation.

10. Additional Dashboard Widgets:
    - Sprint Burndown Line Chart (Recharts): ideal vs actual remaining story points.
    - Velocity Trend Bar Chart (Recharts): Committed vs Completed for the last 5 sprints.
    - Team Pulse: mocked urgent/blocker Slack messages with Blocker:/Urgent: highlighted in red.
    - Crash-Free Users KPI: Firebase mock (99.8%, last 7 days).

11. Secure Backend Architecture:
    - All API keys (Jira, Slack, Gemini) stored server-side in .env — never exposed to the browser.
    - Express middleware: app.use(express.json()) for POST body parsing.
    - Sanitize JIRA_DOMAIN (strip https://, .atlassian.net, trailing paths) and boardId (extract numeric part only).

12. Navigation & Layout:
    - App title: "Scrum360".
    - Top navigation tabs: "Dashboard", "Sprint Briefing", "Master Prompt".
    - Clean, modern UI: slate/indigo/emerald color palette, Tailwind CSS, rounded-xl cards, shadow-sm.
    - Ensure the "Cost Breakdown" section is NOT included.`;

export default function MasterPrompt() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(masterPromptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            Master Prompt: Scrum Master 360
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            An up-to-date, comprehensive prompt describing the entire application and all its features. 
            Use this to recreate the project or migrate to another AI tool.
          </p>
        </div>
        <button 
          onClick={handleCopy} 
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium shrink-0"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copied!' : 'Copy Master Prompt'}
        </button>
      </div>
      
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
        <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed" dir="auto">
          {masterPromptText}
        </pre>
      </div>
    </div>
  );
}
