import 'dotenv/config';
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // In-memory cache for Jira responses (per team, 60s TTL)
  const jiraCache = new Map<string, { data: any; ts: number }>();
  const JIRA_CACHE_TTL = 60_000;

  // Jira API Endpoint
  app.get("/api/jira/sprint", async (req, res) => {
    const { JIRA_DOMAIN, JIRA_EMAIL, JIRA_API_TOKEN } = process.env;
    const team = (req.query.team as string) || 'v1';
    
    // Map the requested team to its specific Jira Board ID from environment variables
    // Index table mapping: mako -> mako3, 12+ -> 12+scrum
    const boardMap: Record<string, string | undefined> = {
      'v1': process.env.JIRA_BOARD_ID_V1,
      'mako': process.env.JIRA_BOARD_ID_MAKO3,
      'mako3': process.env.JIRA_BOARD_ID_MAKO3, // Legacy fallback
      'N12': process.env.JIRA_BOARD_ID_N12,
      '12+': process.env.JIRA_BOARD_ID_12_SCRUM,
      '12+scrum': process.env.JIRA_BOARD_ID_12_SCRUM, // Legacy fallback
    };

    const boardId = boardMap[team];

    const mockBurndown = [
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
    
    // Check if Jira credentials exist
    if (!JIRA_DOMAIN || !JIRA_EMAIL || !JIRA_API_TOKEN) {
      return res.json({
        configured: false,
        message: "Jira credentials not found. Showing mock data.",
        burndown: mockBurndown
      });
    }

    // Check if the specific board ID is configured for the selected team
    if (!boardId) {
      return res.json({
        configured: false,
        message: `Board ID for '${team}' is not configured. Showing mock data.`,
        burndown: mockBurndown
      });
    }

    // Serve from cache if still fresh
    const cached = jiraCache.get(team);
    if (cached && Date.now() - cached.ts < JIRA_CACHE_TTL) {
      return res.json(cached.data);
    }

    try {
      // 1. Create Basic Auth token
      const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');

      // Sanitize the JIRA_DOMAIN in case the user accidentally included 'https://' or '.atlassian.net'
      let cleanDomain = JIRA_DOMAIN.trim();
      cleanDomain = cleanDomain.replace(/^https?:\/\//, ''); // Remove http:// or https://
      cleanDomain = cleanDomain.replace(/\.atlassian\.net.*$/, ''); // Remove .atlassian.net and anything after it
      cleanDomain = cleanDomain.replace(/\/.*$/, ''); // Remove any trailing paths

      // Sanitize the boardId to extract only the numeric part
      // Users might accidentally paste "KESHET/boards/91" or "?rapidView=91"
      let cleanBoardId = boardId;
      const match = cleanBoardId.match(/(\d+)$/);
      if (match) {
        cleanBoardId = match[1];
      }

      const headers = { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' };
      const jql = encodeURIComponent('resolution = Unresolved ORDER BY priority DESC');
      const maxResults = 200;
      const issuesBase = `https://${cleanDomain}.atlassian.net/rest/agile/1.0/board/${cleanBoardId}/issue?jql=${jql}&maxResults=${maxResults}&fields=summary,issuetype,status,assignee,priority,sprint,resolution,fixVersions,parent,statuscategorychangedate,updated,created`;

      // 2. Fetch sprints and first issues page in parallel
      const sprintsUrl = `https://${cleanDomain}.atlassian.net/rest/agile/1.0/board/${cleanBoardId}/sprint?state=active,future`;
      console.log(`Fetching from Jira: ${sprintsUrl}`);

      const [sprintsResponse, firstPageResponse] = await Promise.all([
        fetch(sprintsUrl, { headers }),
        fetch(`${issuesBase}&startAt=0`, { headers }),
      ]);

      let activeSprintData = null;
      let activeSprintId: number | null = null;
      let activeSprintName: string | null = null;
      let activeSprintGoal: string | null = null;
      let nextSprintId: number | null = null;
      let sprintDay = "Day X of 10";
      let sprintDaysRemaining = "X days remaining";

      let nextSprintName: string = "Next Sprint";

      if (sprintsResponse.ok) {
        activeSprintData = await sprintsResponse.json();
        
        const activeSprint = activeSprintData.values?.find((s: any) => s.state === 'active');
        if (activeSprint) {
          activeSprintId = activeSprint.id;
          activeSprintName = activeSprint.name;
          activeSprintGoal = activeSprint.goal;
          
          if (activeSprint.startDate) {
            const start = new Date(activeSprint.startDate);
            start.setHours(0, 0, 0, 0);
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            let daysPassed = 0;
            let current = new Date(start);
            
            // Calculate working days (assuming Sunday-Thursday for Israel, or just skipping Fri/Sat)
            while (current <= now) {
              const dayOfWeek = current.getDay();
              if (dayOfWeek !== 5 && dayOfWeek !== 6) { // Skip Friday (5) and Saturday (6)
                daysPassed++;
              }
              current.setDate(current.getDate() + 1);
            }
            
            daysPassed = Math.min(Math.max(daysPassed, 1), 10);
            const daysLeft = 10 - daysPassed;
            
            sprintDay = `Day ${daysPassed} of 10`;
            sprintDaysRemaining = `${daysLeft} days remaining`;
          }
        }
        
        const futureSprints = activeSprintData.values?.filter((s: any) => s.state === 'future') || [];
        // Sort future sprints by startDate if available, otherwise by ID (chronological creation)
        futureSprints.sort((a: any, b: any) => {
          if (a.startDate && b.startDate) return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
          return a.id - b.id;
        });
        
        if (futureSprints.length > 0) {
          nextSprintId = futureSprints[0].id;
          nextSprintName = futureSprints[0].name;
        }
      } else if (sprintsResponse.status === 404 || sprintsResponse.status === 401 || sprintsResponse.status === 403) {
        const errorText = await sprintsResponse.text();
        console.error(`Jira API error (${sprintsResponse.status}):`, errorText);
        
        if (sprintsResponse.status === 404) {
          throw new Error(`Board ID ${cleanBoardId} not found or you don't have permission to view it.`);
        } else {
          throw new Error(`Authentication failed. Please check your Jira Email and API Token.`);
        }
      }

      let sprintGoalIssuesMap: Record<string, { summary: string, url: string }> = {};
      if (activeSprintGoal) {
        const keysMatch = Array.from(activeSprintGoal.matchAll(/\b(KESHET-\d+)\b/g));
        const keys = [...new Set(keysMatch.map(m => m[1]))];
        
        if (keys.length > 0) {
          try {
            const goalIssuesResponse = await fetch(`https://${cleanDomain}.atlassian.net/rest/api/3/search/jql`, {
              method: 'POST',
              headers: { 
                'Authorization': `Basic ${auth}`, 
                'Content-Type': 'application/json',
                'Accept': 'application/json' 
              },
              body: JSON.stringify({
                jql: `key IN (${keys.join(',')})`,
                fields: ["summary", "fixVersions", "status"]
              })
            });
            if (goalIssuesResponse.ok) {
              const goalIssuesData = await goalIssuesResponse.json();
              goalIssuesData.issues?.forEach((issue: any) => {
                const fixVersions = issue.fields.fixVersions || [];
                const fixVersionNames = fixVersions.map((v: any) => v.name).join(', ');
                sprintGoalIssuesMap[issue.key] = {
                  summary: issue.fields.summary,
                  url: `https://${cleanDomain}.atlassian.net/browse/${issue.key}`,
                  fixVersion: fixVersionNames || 'no fix version',
                  status: issue.fields.status?.name || 'Unknown'
                };
              });
            } else {
              console.error("Jira search failed:", await goalIssuesResponse.text());
            }
          } catch (e) {
            console.error("Error fetching sprint goal issues:", e);
          }
        }
      }

      // 3. Process first page and fetch remaining pages in parallel
      if (!firstPageResponse.ok) {
        console.error(`Failed to fetch first issues page: ${firstPageResponse.status}`);
      }
      const firstPageData = firstPageResponse.ok ? await firstPageResponse.json() : { issues: [], total: 0 };
      const firstIssues: any[] = firstPageData.issues || [];
      const total: number = firstPageData.total || 0;

      // Fetch all remaining pages simultaneously (cap at 500 total)
      const cap = Math.min(total, 500);
      const remainingStarts: number[] = [];
      for (let s = maxResults; s < cap; s += maxResults) remainingStarts.push(s);

      const remainingPages = await Promise.all(
        remainingStarts.map(s =>
          fetch(`${issuesBase}&startAt=${s}`, { headers })
            .then(r => r.ok ? r.json() : { issues: [] })
            .catch(() => ({ issues: [] }))
        )
      );

      const allIssues: any[] = [
        ...firstIssues,
        ...remainingPages.flatMap((d: any) => d.issues || []),
      ];

      const processedIssues = allIssues.map((issue: any) => {
        let sprintState = 'backlog';
        if (issue.fields.sprint) {
          if (activeSprintId && issue.fields.sprint.id === activeSprintId) {
            sprintState = 'active';
          } else if (nextSprintId && issue.fields.sprint.id === nextSprintId) {
            sprintState = 'next';
          } else if (!activeSprintId && issue.fields.sprint.state === 'active') {
            // Fallback only when the board's active sprint is unknown: avoids marking
            // issues from other teams' active sprints as active on this board.
            sprintState = 'active';
          } else if (issue.fields.sprint.state === 'future') {
            sprintState = 'backlog'; // Other future sprints pushed to backlog visually
          }
        }
        
        const fixVersions = issue.fields.fixVersions || [];
        const fixVersionNames = fixVersions.map((v: any) => v.name).join(', ');
        
        let parentKey = undefined;
        let parentSummary = undefined;
        if (issue.fields.parent) {
          parentKey = issue.fields.parent.key;
          parentSummary = issue.fields.parent.fields?.summary;
        }
        
        return {
          id: issue.id,
          key: issue.key,
          summary: issue.fields.summary,
          type: issue.fields.issuetype?.name || 'Unknown',
          status: issue.fields.status?.name || 'Unknown',
          fixVersion: fixVersionNames || 'no fix version',
          assignee: issue.fields.assignee?.displayName || 'Unassigned',
          priority: issue.fields.priority?.name || 'None',
          priorityId: issue.fields.priority?.id || '99',
          sprintState: sprintState,
          isResolved: !!issue.fields.resolution,
          url: `https://${cleanDomain}.atlassian.net/browse/${issue.key}`,
          parentKey,
          parentSummary,
          statusChangedDate: issue.fields.statuscategorychangedate || issue.fields.updated || new Date().toISOString(),
          createdDate: issue.fields.created
        };
      });

      // Second pass: inherit sprintState from parent for sub-tasks
      const issueMap = new Map(processedIssues.map(i => [i.key, i]));
      processedIssues.forEach(issue => {
        if (issue.type.toLowerCase() === 'sub-task' && issue.sprintState === 'backlog' && issue.parentKey) {
          const parent = issueMap.get(issue.parentKey);
          if (parent && parent.sprintState !== 'backlog') {
            issue.sprintState = parent.sprintState;
          }
        }
      });

      // 4. Process data and return to frontend
      const responseData = {
        configured: true,
        message: `Connected to Jira (Board: ${cleanBoardId} for ${team})`,
        rawData: activeSprintData,
        issues: processedIssues,
        activeSprintName: activeSprintName,
        nextSprintName: nextSprintName !== "Next Sprint" ? nextSprintName : undefined,
        sprintGoal: activeSprintGoal,
        sprintGoalIssues: sprintGoalIssuesMap,
        sprintDay: sprintDay,
        sprintDaysRemaining: sprintDaysRemaining,
        jiraBoardUrl: boardId.startsWith('http') ? boardId : `https://${cleanDomain}.atlassian.net/jira/software/boards/${cleanBoardId}`,
        // In a real scenario, calculate burndown from Jira issues
        burndown: [
          { day: 'Day 1', ideal: 100, actual: 100 },
          { day: 'Day 2', ideal: 90, actual: 92 },
          { day: 'Day 3', ideal: 80, actual: 78 },
        ]
      };
      jiraCache.set(team, { data: responseData, ts: Date.now() });
      res.json(responseData);
    } catch (error: any) {
      console.error("Jira API Error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch data from Jira." });
    }
  });

  // Sprint Insights: stuck work items based on 85th percentile of historical status duration
  const insightsCache = new Map<string, { data: any; ts: number }>();
  const INSIGHTS_CACHE_TTL = 5 * 60_000; // 5 minutes

  app.get("/api/jira/sprint-insights", async (req, res) => {
    const { JIRA_DOMAIN, JIRA_EMAIL, JIRA_API_TOKEN } = process.env;
    const team = (req.query.team as string) || 'v1';

    const boardMap: Record<string, string | undefined> = {
      'v1': process.env.JIRA_BOARD_ID_V1,
      'mako': process.env.JIRA_BOARD_ID_MAKO3,
      'mako3': process.env.JIRA_BOARD_ID_MAKO3,
      'N12': process.env.JIRA_BOARD_ID_N12,
      '12+': process.env.JIRA_BOARD_ID_12_SCRUM,
      '12 ': process.env.JIRA_BOARD_ID_12_SCRUM, // '+' decoded as space in query strings
      '12+scrum': process.env.JIRA_BOARD_ID_12_SCRUM,
    };

    if (!JIRA_DOMAIN || !JIRA_EMAIL || !JIRA_API_TOKEN) {
      return res.status(400).json({ error: 'Jira not configured' });
    }

    // '+' in query strings is decoded as a space — normalise back
    const boardId = boardMap[team] ?? boardMap[team.trim() + '+'];
    if (!boardId) {
      return res.status(400).json({ error: `Board not configured for team: ${team}` });
    }

    const cached = insightsCache.get(team);
    if (cached && Date.now() - cached.ts < INSIGHTS_CACHE_TTL) {
      return res.json(cached.data);
    }

    try {
      const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
      let cleanDomain = JIRA_DOMAIN.trim()
        .replace(/^https?:\/\//, '')
        .replace(/\.atlassian\.net.*$/, '')
        .replace(/\/.*$/, '');

      let cleanBoardId = boardId;
      const bMatch = cleanBoardId.match(/(\d+)$/);
      if (bMatch) cleanBoardId = bMatch[1];

      const headers = { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' };

      // Round 1: active + closed sprints in parallel
      const [activeSprintsRes, closedSprintsRes] = await Promise.all([
        fetch(`https://${cleanDomain}.atlassian.net/rest/agile/1.0/board/${cleanBoardId}/sprint?state=active`, { headers }),
        fetch(`https://${cleanDomain}.atlassian.net/rest/agile/1.0/board/${cleanBoardId}/sprint?state=closed`, { headers }),
      ]);

      if (!activeSprintsRes.ok) throw new Error('Failed to fetch active sprint');
      const activeSprintsData = await activeSprintsRes.json();
      const activeSprint = activeSprintsData.values?.find((s: any) => s.state === 'active');
      if (!activeSprint) return res.json({ stuckGroups: [], totalStuck: 0 });

      // Resolve the 5 most-recent closed sprint IDs.
      // The closed-sprints endpoint returns results oldest-first, so we must paginate
      // to the last page to get the sprints closest to today.
      let recentClosedSprintIds: number[] = [];
      if (closedSprintsRes.ok) {
        const closedData = await closedSprintsRes.json();
        const total: number = closedData.total || 0;
        let allClosedValues: any[] = closedData.values || [];

        // If there are more pages, fetch the last one (most-recent sprints live there)
        if (!closedData.isLast && total > allClosedValues.length) {
          const lastPageStart = Math.max(0, total - 50);
          const lastPageRes = await fetch(
            `https://${cleanDomain}.atlassian.net/rest/agile/1.0/board/${cleanBoardId}/sprint?state=closed&maxResults=50&startAt=${lastPageStart}`,
            { headers }
          );
          if (lastPageRes.ok) {
            const lastPageData = await lastPageRes.json();
            allClosedValues = lastPageData.values || [];
          }
        }

        recentClosedSprintIds = (allClosedValues as any[])
          .sort((a, b) => b.id - a.id)
          .slice(0, 5)
          .map((s) => s.id);
      }

      // Round 2: active sprint issues (via board endpoint — same set as the main dashboard) +
      // 5 most-recent closed sprint issues for historical p85, in parallel.
      // Using board/issue?jql=sprint=X is critical: /sprint/{id}/issue misses items that
      // inherit their sprint assignment from a parent (sub-tasks).
      const activeJql = encodeURIComponent(`sprint = ${activeSprint.id}`);
      const activeIssuesUrl = `https://${cleanDomain}.atlassian.net/rest/agile/1.0/board/${cleanBoardId}/issue?jql=${activeJql}&fields=summary,status,assignee,issuetype,created&expand=changelog&maxResults=200`;

      const allFetches: Promise<Response>[] = [
        fetch(activeIssuesUrl, { headers }),
        ...recentClosedSprintIds.map((id) =>
          fetch(
            `https://${cleanDomain}.atlassian.net/rest/agile/1.0/sprint/${id}/issue?fields=status&expand=changelog&maxResults=100`,
            { headers }
          )
        ),
      ];
      const [activeIssuesRes, ...closedResArray] = await Promise.all(allFetches);

      const activeIssues: any[] = activeIssuesRes.ok
        ? (await activeIssuesRes.json()).issues || []
        : [];

      const closedSprintIssues: any[] = (
        await Promise.all(
          closedResArray.map((r) => (r.ok ? r.json().then((d: any) => d.issues || []) : Promise.resolve([])))
        )
      ).flat();

      // Build historical duration map: status → [hours spent in that status] from closed sprint
      const statusDurations: Record<string, number[]> = {};
      for (const issue of closedSprintIssues) {
        const histories = (issue.changelog?.histories || [])
          .filter((h: any) => h.items?.some((i: any) => i.field === 'status'))
          .sort((a: any, b: any) => new Date(a.created).getTime() - new Date(b.created).getTime());

        let prevStatus: string | null = null;
        let prevTime: number | null = null;
        for (const h of histories) {
          const item = h.items.find((i: any) => i.field === 'status');
          if (!item) continue;
          const t = new Date(h.created).getTime();
          if (prevStatus !== null && prevTime !== null) {
            const hours = (t - prevTime) / 3_600_000;
            if (hours > 0 && hours < 30 * 24) {
              (statusDurations[prevStatus] ??= []).push(hours);
            }
          }
          prevStatus = item.toString;
          prevTime = t;
        }
      }

      // 85th percentile helper (requires ≥5 samples to be meaningful)
      const p85 = (arr: number[]): number => {
        if (arr.length < 5) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        return sorted[Math.ceil(0.85 * sorted.length) - 1];
      };

      const historicalThresholds: Record<string, number> = {};
      for (const [status, durations] of Object.entries(statusDurations)) {
        const val = p85(durations);
        if (val > 0) historicalThresholds[status] = val;
      }

      // Minimum threshold: never flag items stuck for less than 1 week
      const MIN_THRESHOLD_HOURS = 168;

      // Fallback thresholds — all floored at 1 week minimum
      const defaultThresholds: Record<string, number> = {
        'In Progress': 168,
        'Code Review': 168,
        'Waiting for QA': 168,
        'Waiting for QA deploy': 168,
        'Waiting For Deploy': 168,
        'Waiting For QA deploy': 168,
        'QA': 168,
        'To Do': 168,
      };
      const getThreshold = (status: string) =>
        Math.max(MIN_THRESHOLD_HOURS, historicalThresholds[status] ?? defaultThresholds[status] ?? MIN_THRESHOLD_HOURS);

      // Find the exact time an issue most-recently entered its CURRENT status via changelog.
      // We look for the most recent transition whose "toString" matches the issue's current status.
      const statusEntryTime = (issue: any): number => {
        const currentStatus = issue.fields.status?.name;
        const histories = (issue.changelog?.histories || [])
          .filter((h: any) => h.items?.some((i: any) => i.field === 'status'))
          .sort((a: any, b: any) => new Date(b.created).getTime() - new Date(a.created).getTime());
        for (const h of histories) {
          const item = h.items.find((i: any) => i.field === 'status');
          if (item && item.toString === currentStatus) {
            return new Date(h.created).getTime();
          }
        }
        return new Date(issue.fields.created || Date.now()).getTime();
      };

      const now = Date.now();
      const stuckByStatus: Record<string, { items: any[]; threshold: number }> = {};

      for (const issue of activeIssues) {
        // Skip "Done" items
        if (issue.fields.status?.statusCategory?.key === 'done') continue;
        // Skip unstarted "To Do" items — Jira Sprint Insights never flags these as stuck
        if (issue.fields.status?.statusCategory?.key === 'new') continue;
        // Skip sub-tasks — Jira Sprint Insights shows only top-level work items
        if (issue.fields.issuetype?.subtask === true) continue;

        const status = issue.fields.status?.name || 'Unknown';
        const thr = getThreshold(status);
        const entryTime = statusEntryTime(issue);
        const hours = (now - entryTime) / 3_600_000;
        if (hours < thr) continue;

        (stuckByStatus[status] ??= { items: [], threshold: thr }).items.push({
          key: issue.key,
          summary: issue.fields.summary,
          assignee: issue.fields.assignee?.displayName || 'Unassigned',
          assigneeAvatarUrl: issue.fields.assignee?.avatarUrls?.['48x48'] ?? null,
          hoursSinceChange: Math.floor(hours),
          url: `https://${cleanDomain}.atlassian.net/browse/${issue.key}`,
          type: issue.fields.issuetype?.name || 'Unknown',
        });
      }

      const stuckGroups = Object.entries(stuckByStatus)
        .map(([status, { items, threshold: thr }]) => ({
          status,
          threshold85th: Math.round(thr),
          items: items.sort((a, b) => b.hoursSinceChange - a.hoursSinceChange),
        }))
        .sort((a, b) => b.items.length - a.items.length);

      const totalStuck = stuckGroups.reduce((s, g) => s + g.items.length, 0);
      const responseData = { stuckGroups, totalStuck };
      insightsCache.set(team, { data: responseData, ts: Date.now() });
      res.json(responseData);

    } catch (error: any) {
      console.error('Sprint insights error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch sprint insights' });
    }
  });

  // Slack: deployed-versions messages per Global Filter user
  app.get("/api/slack/deployed-messages", async (req, res) => {
    const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
    const CHANNEL_ID = 'C0894AU7Y0N';
    const USER_MAP: Record<string, string> = {
      'v1':  'U08Q7TE11PB', // Naama Rotem Gelber
      'mako': 'U022Y7SGFRA', // Berti Levi Katan
      'N12':  'UDYA2EQQH',  // Hen Lebel
      '12+':  'U01P6GR53PB', // Aviran.Sa
    };

    const filter = (req.query.filter as string) || 'v1';
    const userId = USER_MAP[filter];

    if (!SLACK_BOT_TOKEN) return res.status(503).json({ error: 'SLACK_BOT_TOKEN not configured' });
    if (!userId) return res.status(400).json({ error: `Unknown filter: ${filter}` });

    try {
      const messages: { timestamp: string; text: string }[] = [];
      let cursor: string | undefined;

      do {
        const params = new URLSearchParams({ channel: CHANNEL_ID, limit: '200' });
        if (cursor) params.set('cursor', cursor);

        const response = await fetch(`https://slack.com/api/conversations.history?${params}`, {
          headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
        });
        const data = await response.json() as any;

        if (!data.ok) throw new Error(data.error || 'Slack API error');

        for (const msg of data.messages ?? []) {
          if (msg.user === userId && msg.type === 'message' && !msg.subtype) {
            messages.push({
              timestamp: new Date(parseFloat(msg.ts) * 1000).toISOString(),
              text: msg.text ?? '',
            });
          }
        }

        cursor = data.response_metadata?.next_cursor || undefined;
      } while (cursor);

      // newest first
      messages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      res.json(messages);
    } catch (error: any) {
      console.error('Slack deployed-messages error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch Slack messages' });
    }
  });

  // Slack: Berti Levi Katan messages from #deployed-versions
  app.get("/api/slack/berti-messages", async (req, res) => {
    const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
    const CHANNEL_ID = 'C0894AU7Y0N';
    const BERTI_USER_ID = 'U022Y7SGFRA';

    if (!SLACK_BOT_TOKEN) {
      return res.status(503).json({ error: 'SLACK_BOT_TOKEN not configured' });
    }

    try {
      const messages: { timestamp: string; text: string }[] = [];
      let cursor: string | undefined;

      do {
        const params = new URLSearchParams({ channel: CHANNEL_ID, limit: '200' });
        if (cursor) params.set('cursor', cursor);

        const response = await fetch(`https://slack.com/api/conversations.history?${params}`, {
          headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
        });
        const data = await response.json() as any;

        if (!data.ok) throw new Error(data.error || 'Slack API error');

        for (const msg of data.messages ?? []) {
          if (msg.user === BERTI_USER_ID && msg.type === 'message' && !msg.subtype) {
            const date = new Date(parseFloat(msg.ts) * 1000);
            messages.push({
              timestamp: date.toISOString(),
              text: msg.text ?? '',
            });
          }
        }

        cursor = data.response_metadata?.next_cursor || undefined;
      } while (cursor);

      messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      res.json(messages);
    } catch (error: any) {
      console.error('Slack API error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch Slack messages' });
    }
  });

  // Sprint Briefing: convert SM free-text + sprint issues into per-developer instructions via Claude
  app.post("/api/sprint-briefing", async (req, res) => {
    const { ANTHROPIC_API_KEY, JIRA_DOMAIN } = process.env;

    if (!ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured' });
    }

    const { freeText, issues } = req.body;
    if (!freeText?.trim()) {
      return res.status(400).json({ error: 'freeText is required' });
    }

    let jiraBaseUrl = '';
    if (JIRA_DOMAIN) {
      let cleanDomain = JIRA_DOMAIN.trim()
        .replace(/^https?:\/\//, '')
        .replace(/\.atlassian\.net.*$/, '')
        .replace(/\/.*$/, '');
      jiraBaseUrl = `https://${cleanDomain}.atlassian.net/browse`;
    }

    const activeIssues = (Array.isArray(issues) ? issues : [])
      .filter((i: any) => i.sprintState === 'active')
      .map((i: any) => `${i.key} | ${i.type} | ${i.assignee} | ${i.status} | ${i.summary}`)
      .join('\n');

    const linkNote = jiraBaseUrl
      ? `For each task key (e.g. ABC-123), create a Markdown link: [Summary](${jiraBaseUrl}/ABC-123)`
      : 'Jira base URL not configured — list task keys as plain text without links.';

    const userContent = `## Active Sprint Issues (key | type | assignee | status | summary):
${activeIssues || '(none provided)'}

## Jira Links:
${linkNote}

## Scrum Master Notes:
${freeText}`;

    try {
      const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
      const stream = anthropic.messages.stream({
        model: 'claude-opus-4-7',
        max_tokens: 4096,
        system: `You are a Scrum Master assistant. Given free-text notes from a Sprint Planning session and a list of active Jira sprint issues, generate clear, action-oriented, priority-ordered work instructions for each developer — in Markdown.

## Output format — one section per developer:

## [Developer Name]

### Focus Headline
One sentence: their main sprint goal.

### Priority List
Numbered list. Each item: task name as a Markdown link to Jira (if URL available), followed by the key in parentheses.

### Context / Dependencies
Brief note: why this task matters or what it depends on.

### Quick Tip
One technical or personal emphasis for this developer.

---

Rules:
- Match developer names from the SM notes and from the assignee field in the issues list.
- Infer task priorities from the SM notes; default to issue order if not specified.
- Write in the same language the SM used (Hebrew, English, or mixed).
- Output clean Markdown only — no preamble, no explanation outside the sections.`,
        messages: [{ role: 'user', content: userContent }],
      });
      const result = await stream.finalMessage();
      const text = result.content.find((b: any) => b.type === 'text')?.text ?? '';
      res.json({ markdown: text });
    } catch (error: any) {
      console.error('Claude sprint-briefing error:', error);
      res.status(500).json({ error: error.message || 'Failed to generate briefing' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
