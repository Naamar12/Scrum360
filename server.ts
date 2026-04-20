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

      // 2. Fetch active and future sprints from Jira
      const sprintsUrl = `https://${cleanDomain}.atlassian.net/rest/agile/1.0/board/${cleanBoardId}/sprint?state=active,future`;
      console.log(`Fetching from Jira: ${sprintsUrl}`); // Helpful for debugging
      
      const sprintsResponse = await fetch(sprintsUrl, {
        headers: { 
          'Authorization': `Basic ${auth}`, 
          'Accept': 'application/json' 
        }
      });

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

      // 3. Fetch all unresolved issues for the board (Active, Future, Backlog) with pagination
      // Exclude 'Done' or resolved items
      const jql = encodeURIComponent('resolution = Unresolved ORDER BY priority DESC');
      let allIssues: any[] = [];
      let startAt = 0;
      const maxResults = 100;
      let isLast = false;

      while (!isLast && allIssues.length < 500) { // Cap at 500 issues to prevent timeouts
        const issuesUrl = `https://${cleanDomain}.atlassian.net/rest/agile/1.0/board/${cleanBoardId}/issue?jql=${jql}&startAt=${startAt}&maxResults=${maxResults}&fields=summary,issuetype,status,assignee,priority,sprint,resolution,fixVersions,parent,statuscategorychangedate,updated,created`;
        
        try {
          const issuesResponse = await fetch(issuesUrl, {
            headers: { 
              'Authorization': `Basic ${auth}`, 
              'Accept': 'application/json' 
            }
          });

          if (!issuesResponse.ok) {
            console.error(`Failed to fetch issues at startAt ${startAt}: ${issuesResponse.status}`);
            break;
          }

          const issuesData = await issuesResponse.json();
          const fetchedIssues = issuesData.issues || [];
          allIssues = allIssues.concat(fetchedIssues);
          
          if (fetchedIssues.length < maxResults || (issuesData.total && startAt + fetchedIssues.length >= issuesData.total)) {
            isLast = true;
          } else {
            startAt += maxResults;
          }
        } catch (e) {
          console.error("Error fetching issues:", e);
          break;
        }
      }

      const processedIssues = allIssues.map((issue: any) => {
        let sprintState = 'backlog';
        if (issue.fields.sprint) {
          if (activeSprintId && issue.fields.sprint.id === activeSprintId) {
            sprintState = 'active';
          } else if (nextSprintId && issue.fields.sprint.id === nextSprintId) {
            sprintState = 'next';
          } else if (issue.fields.sprint.state === 'active') {
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
      res.json({
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
        // In a real scenario, calculate burndown from Jira issues
        burndown: [
          { day: 'Day 1', ideal: 100, actual: 100 },
          { day: 'Day 2', ideal: 90, actual: 92 },
          { day: 'Day 3', ideal: 80, actual: 78 },
        ]
      });
    } catch (error: any) {
      console.error("Jira API Error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch data from Jira." });
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
