import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'

const DB_PATH = join(app.getPath('userData'), 'history.db')

let db: Database.Database

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH)
    db.exec('PRAGMA foreign_keys = ON')
    db.exec(`CREATE TABLE IF NOT EXISTS prompts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`)
    db.exec(`CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      metadata TEXT NOT NULL
    )`)
    db.exec(`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT NOT NULL,
      service_id TEXT NOT NULL,
      role TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
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

export function saveConversation(
  id: string,
  title: string,
  metadata: string,
  messages: { service_id: string; role: string; text: string; created_at?: number }[]
): void {
  const dbInstance = getDb()
  const now = Date.now()

  dbInstance.transaction(() => {
    // Insert or update conversation
    dbInstance.prepare(`
      INSERT INTO conversations (id, title, created_at, updated_at, metadata)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        updated_at = excluded.updated_at,
        metadata = excluded.metadata
    `).run(id, title, now, now, metadata)

    // Delete existing messages for this conversation to prevent duplicate issues
    dbInstance.prepare('DELETE FROM messages WHERE conversation_id = ?').run(id)

    // Insert new messages
    const insertMsg = dbInstance.prepare(`
      INSERT INTO messages (conversation_id, service_id, role, text, created_at)
      VALUES (?, ?, ?, ?, ?)
    `)
    for (const msg of messages) {
      insertMsg.run(id, msg.service_id, msg.role, msg.text, msg.created_at || now)
    }
  })()
}

export function getConversations(limit = 100): { id: string; title: string; created_at: number; updated_at: number; metadata: string }[] {
  try {
    return getDb().prepare('SELECT * FROM conversations ORDER BY updated_at DESC LIMIT ?').all(limit) as any[]
  } catch (err) {
    console.error('Error fetching conversations list:', err)
    return []
  }
}

export function getConversationDetails(id: string): {
  id: string
  title: string
  created_at: number
  updated_at: number
  metadata: string
  messages: { service_id: string; role: string; text: string; created_at: number }[]
} | null {
  try {
    const dbInstance = getDb()
    const conv = dbInstance.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as any
    if (!conv) return null

    const messages = dbInstance.prepare('SELECT service_id, role, text, created_at FROM messages WHERE conversation_id = ? ORDER BY id ASC').all(id) as any[]

    return {
      ...conv,
      messages
    }
  } catch (err) {
    console.error('Error fetching conversation details:', err)
    return null
  }
}

export function deleteConversation(id: string): void {
  try {
    getDb().prepare('DELETE FROM conversations WHERE id = ?').run(id)
  } catch (err) {
    console.error('Error deleting conversation:', err)
  }
}

export function clearAllConversations(): void {
  try {
    const dbInstance = getDb()
    dbInstance.transaction(() => {
      dbInstance.prepare('DELETE FROM messages').run()
      dbInstance.prepare('DELETE FROM conversations').run()
    })()
  } catch (err) {
    console.error('Error clearing all conversations:', err)
  }
}

