import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'

const DB_PATH = join(app.getPath('userData'), 'history.db')

let db: Database.Database

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH)
    db.exec(`CREATE TABLE IF NOT EXISTS prompts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`)
  }
  return db
}

export function savePrompt(text: string): void {
  // Omit empty or whitespace-only prompts
  if (!text || !text.trim()) return
  getDb().prepare('INSERT INTO prompts (text, created_at) VALUES (?, ?)').run(text.trim(), Date.now())
}

export function getHistory(limit = 100): { id: number; text: string; created_at: number }[] {
  try {
    return getDb().prepare('SELECT * FROM prompts ORDER BY created_at DESC LIMIT ?').all(limit) as any[]
  } catch (err) {
    console.error('Error fetching prompt history:', err)
    return []
  }
}

export function clearHistory(): void {
  try {
    getDb().prepare('DELETE FROM prompts').run()
  } catch (err) {
    console.error('Error clearing prompt history:', err)
  }
}
