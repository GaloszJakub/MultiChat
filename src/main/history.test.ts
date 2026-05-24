import { vi, describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest'

// Mock database tables state in-memory to prevent Node ABI binary version conflicts
let promptsTable: any[] = []
let conversationsTable: Map<string, any> = new Map()
let messagesTable: any[] = []
let nextMessageId = 1

// Mock better-sqlite3 with an in-memory JS emulation layer
vi.mock('better-sqlite3', () => {
  return {
    default: function() {
      return {
        exec: () => {},
        transaction: (fn: any) => {
          return (...args: any[]) => fn(...args)
        },
        prepare: (sql: string) => {
          const sqlClean = sql.replace(/\s+/g, ' ').trim()

          // 1. Prompts Table Operations
          if (sqlClean.includes('INSERT INTO prompts')) {
            return {
              run: (text: string, created_at: number) => {
                promptsTable.push({ text, created_at })
              }
            }
          }
          if (sqlClean.includes('SELECT * FROM prompts')) {
            return {
              all: (limit: number) => {
                const sorted = [...promptsTable].reverse()
                return sorted.slice(0, limit)
              }
            }
          }
          if (sqlClean.includes('DELETE FROM prompts')) {
            return {
              run: () => {
                promptsTable = []
              }
            }
          }

          // 2. Conversations Table Operations
          if (sqlClean.includes('INSERT INTO conversations')) {
            return {
              run: (id: string, title: string, created_at: number, updated_at: number, metadata: string) => {
                conversationsTable.set(id, { id, title, created_at, updated_at, metadata })
              }
            }
          }
          if (sqlClean.includes('SELECT * FROM conversations WHERE id = ?')) {
            return {
              get: (id: string) => {
                return conversationsTable.get(id) || null
              }
            }
          }
          if (sqlClean.includes('SELECT * FROM conversations ORDER BY updated_at DESC')) {
            return {
              all: (limit: number) => {
                const sorted = Array.from(conversationsTable.values()).sort((a, b) => b.updated_at - a.updated_at)
                return sorted.slice(0, limit)
              }
            }
          }
          if (sqlClean.includes('DELETE FROM conversations WHERE id = ?')) {
            return {
              run: (id: string) => {
                conversationsTable.delete(id)
                // Emulate cascade delete of messages
                messagesTable = messagesTable.filter(m => m.conversation_id !== id)
              }
            }
          }
          if (sqlClean.includes('DELETE FROM conversations')) {
            return {
              run: () => {
                conversationsTable.clear()
              }
            }
          }

          // 3. Messages Table Operations
          if (sqlClean.includes('DELETE FROM messages WHERE conversation_id = ?')) {
            return {
              run: (id: string) => {
                messagesTable = messagesTable.filter(m => m.conversation_id !== id)
              }
            }
          }
          if (sqlClean.includes('INSERT INTO messages')) {
            return {
              run: (conversation_id: string, service_id: string, role: string, text: string, created_at: number) => {
                messagesTable.push({
                  id: nextMessageId++,
                  conversation_id,
                  service_id,
                  role,
                  text,
                  created_at
                })
              }
            }
          }
          if (sqlClean.includes('SELECT service_id, role, text, created_at FROM messages WHERE conversation_id = ? ORDER BY id ASC')) {
            return {
              all: (id: string) => {
                return messagesTable.filter(m => m.conversation_id === id)
              }
            }
          }
          if (sqlClean.includes('DELETE FROM messages')) {
            return {
              run: () => {
                messagesTable = []
              }
            }
          }

          // Catch-all fallback
          return {
            run: () => {},
            all: () => [],
            get: () => null
          }
        }
      }
    }
  }
})

// Mock electron before importing history.ts to avoid Electron main thread bindings load failures
vi.mock('electron', () => {
  return {
    app: {
      getPath: () => {
        return __dirname
      }
    }
  }
})

import {
  getDb,
  saveConversation,
  getConversations,
  getConversationDetails,
  deleteConversation,
  clearAllConversations,
  savePrompt,
  getHistory,
  clearHistory
} from './history'

describe('SQLite History Unit Tests', () => {
  beforeEach(() => {
    // Clear everything before each test to ensure test isolation
    clearAllConversations()
    clearHistory()
  })

  afterAll(() => {
    // Cleanup databases tables after all tests run
    clearAllConversations()
    clearHistory()
  })

  describe('Prompt History (Shell Navigation)', () => {
    it('should save and fetch prompts correctly', () => {
      savePrompt('test prompt 1')
      savePrompt('test prompt 2')
      savePrompt('   ') // should be ignored

      const history = getHistory()
      expect(history.length).toBe(2)
      expect(history[0].text).toBe('test prompt 2') // LIFO order
      expect(history[1].text).toBe('test prompt 1')
    })

    it('should clear prompts correctly', () => {
      savePrompt('prompt to delete')
      clearHistory()
      const history = getHistory()
      expect(history.length).toBe(0)
    })
  })

  describe('Conversation Sessions History', () => {
    const testConvId = 'conv_test_12345'
    const testTitle = 'My Test Conversation'
    const testMetadata = JSON.stringify({
      enabledIds: ['chatgpt', 'claude'],
      activeId: 'chatgpt',
      selectedModels: { chatgpt: 'gpt-4o' },
      broadcastMode: 'parallel'
    })
    const testMessages = [
      { service_id: 'chatgpt', role: 'user', text: 'Hello!' },
      { service_id: 'chatgpt', role: 'assistant', text: 'Hello, how can I help you today?' },
      { service_id: 'claude', role: 'user', text: 'Hello!' },
      { service_id: 'claude', role: 'assistant', text: 'Hi! I am Claude.' }
    ]

    it('should create a new conversation with cascading messages', () => {
      saveConversation(testConvId, testTitle, testMetadata, testMessages)

      // Verify conversation exists
      const list = getConversations()
      expect(list.length).toBe(1)
      expect(list[0].id).toBe(testConvId)
      expect(list[0].title).toBe(testTitle)

      // Verify messages are fetched and grouped correctly
      const details = getConversationDetails(testConvId)
      expect(details).not.toBeNull()
      expect(details!.id).toBe(testConvId)
      expect(details!.messages.length).toBe(4)

      // Match details messages
      expect(details!.messages[0].service_id).toBe('chatgpt')
      expect(details!.messages[0].role).toBe('user')
      expect(details!.messages[0].text).toBe('Hello!')

      expect(details!.messages[3].service_id).toBe('claude')
      expect(details!.messages[3].role).toBe('assistant')
      expect(details!.messages[3].text).toBe('Hi! I am Claude.')
    })

    it('should update an existing conversation title/metadata and overwrite messages', () => {
      saveConversation(testConvId, testTitle, testMetadata, testMessages)

      const updatedTitle = 'Updated Title'
      const updatedMetadata = JSON.stringify({
        enabledIds: ['chatgpt'],
        activeId: 'chatgpt'
      })
      const updatedMessages = [
        { service_id: 'chatgpt', role: 'user', text: 'Hello again!' },
        { service_id: 'chatgpt', role: 'assistant', text: 'Hello!' }
      ]

      saveConversation(testConvId, updatedTitle, updatedMetadata, updatedMessages)

      const list = getConversations()
      expect(list.length).toBe(1)
      expect(list[0].title).toBe(updatedTitle)

      const details = getConversationDetails(testConvId)
      expect(details).not.toBeNull()
      // Message count should be 2 instead of 4 (previous ones are cleanly overwritten to prevent orphans)
      expect(details!.messages.length).toBe(2)
      expect(details!.messages[0].text).toBe('Hello again!')
    })

    it('should delete a single conversation kaskadowo (cascade messages delete)', () => {
      saveConversation(testConvId, testTitle, testMetadata, testMessages)

      deleteConversation(testConvId)

      const list = getConversations()
      expect(list.length).toBe(0)

      const details = getConversationDetails(testConvId)
      expect(details).toBeNull()
    })

    it('should clear all conversations and messages successfully', () => {
      saveConversation('c1', 'title 1', testMetadata, testMessages)
      saveConversation('c2', 'title 2', testMetadata, testMessages)

      clearAllConversations()

      expect(getConversations().length).toBe(0)
      expect(getConversationDetails('c1')).toBeNull()
      expect(getConversationDetails('c2')).toBeNull()
    })

    it('should save and load custom chains / pipeline metadata successfully', () => {
      const pipelineConvId = 'conv_pipeline_777'
      const pipelineTitle = 'Pipeline Session'
      const pipelineMetadata = JSON.stringify({
        enabledIds: ['chatgpt', 'gemini', 'claude'],
        activeId: 'chatgpt',
        selectedModels: {},
        broadcastMode: 'sequential',
        pipelineChain: [
          { serviceId: 'chatgpt', promptTemplate: '{{input}}' },
          { serviceId: 'gemini', promptTemplate: 'Review {{previous}}' },
          { serviceId: 'claude', promptTemplate: 'Summarize {{all_previous}}' }
        ]
      })

      saveConversation(pipelineConvId, pipelineTitle, pipelineMetadata, [])

      const details = getConversationDetails(pipelineConvId)
      expect(details).not.toBeNull()
      expect(details!.id).toBe(pipelineConvId)
      
      const parsedMeta = JSON.parse(details!.metadata)
      expect(parsedMeta.broadcastMode).toBe('sequential')
      expect(parsedMeta.pipelineChain.length).toBe(3)
      expect(parsedMeta.pipelineChain[1].serviceId).toBe('gemini')
      expect(parsedMeta.pipelineChain[2].promptTemplate).toBe('Summarize {{all_previous}}')
    })
  })
})
