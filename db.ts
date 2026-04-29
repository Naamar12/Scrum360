import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'scrum360.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS briefing (
    team TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS briefing_archive (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team TEXT NOT NULL,
    data TEXT NOT NULL,
    sprint_name TEXT,
    archived_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS more_widget (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

export interface StoredCard {
  title: string;
  items: { id: number; text: string; issueType?: string }[];
  isReady?: boolean;
  bgColor?: string;
  generatedContent?: string;
}

export interface StoredData {
  cards: Record<string, StoredCard>;
  extraCards: string[];
  hiddenDevs: string[];
  cardOrder?: string[];
}

export function getBriefing(team: string): StoredData | null {
  const row = db.prepare('SELECT data FROM briefing WHERE team = ?').get(team) as { data: string } | undefined;
  return row ? (JSON.parse(row.data) as StoredData) : null;
}

export function saveBriefing(team: string, data: StoredData): void {
  db.prepare('INSERT OR REPLACE INTO briefing (team, data, updated_at) VALUES (?, ?, ?)').run(
    team,
    JSON.stringify(data),
    new Date().toISOString(),
  );
}

export function archiveBriefing(
  team: string,
  archiveData: StoredData & { archivedAt?: string; sprintName?: string },
): void {
  db.prepare(
    'INSERT INTO briefing_archive (team, data, sprint_name, archived_at) VALUES (?, ?, ?, ?)',
  ).run(
    team,
    JSON.stringify({
      cards: archiveData.cards,
      extraCards: archiveData.extraCards,
      hiddenDevs: archiveData.hiddenDevs,
      cardOrder: archiveData.cardOrder,
    }),
    archiveData.sprintName ?? null,
    archiveData.archivedAt ?? new Date().toISOString(),
  );
}

export function getMoreWidget(id: string): unknown | null {
  const row = db.prepare('SELECT data FROM more_widget WHERE id = ?').get(id) as { data: string } | undefined;
  return row ? JSON.parse(row.data) : null;
}

export function saveMoreWidget(id: string, data: unknown): void {
  db.prepare('INSERT OR REPLACE INTO more_widget (id, data, updated_at) VALUES (?, ?, ?)').run(
    id,
    JSON.stringify(data),
    new Date().toISOString(),
  );
}

export default db;
