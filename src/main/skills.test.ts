import { vi, describe, it, expect, afterAll, beforeEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

// Mock electron before importing skills.ts
vi.mock('electron', () => {
  return {
    app: {
      getPath: () => {
        return __dirname
      }
    },
    shell: {
      openPath: vi.fn()
    }
  }
})

import {
  listSkills,
  readSkill,
  createSkill,
  deleteSkill,
  openSkillsDir,
  SKILLS_DIR
} from './skills'

import { shell } from 'electron'

describe('Skills Management Unit Tests', () => {
  // Ensure the directory is recreated and clean before each run
  beforeEach(() => {
    if (fs.existsSync(SKILLS_DIR)) {
      fs.rmSync(SKILLS_DIR, { recursive: true, force: true })
    }
  })

  // Cleanup after all tests finish
  afterAll(() => {
    if (fs.existsSync(SKILLS_DIR)) {
      fs.rmSync(SKILLS_DIR, { recursive: true, force: true })
    }
  })

  describe('Initialization', () => {
    it('should create default skills files when directory is missing', () => {
      expect(fs.existsSync(SKILLS_DIR)).toBe(false)
      
      const skills = listSkills()
      
      expect(fs.existsSync(SKILLS_DIR)).toBe(true)
      expect(skills.length).toBe(4) // concisely, explain-like-5, code-review, polish
      expect(skills[0].file).toBe('code-review.md')
      expect(skills[1].file).toBe('concise.md')
    })
  })

  describe('CRUD Operations', () => {
    it('should create custom skills with sanitized filenames', () => {
      // Create a skill with complex spaces and symbols
      const customName = 'React E2E Testing Helper!! 123'
      const customContent = '# React E2E\nCustom content here.'
      
      const filename = createSkill(customName, customContent)
      
      // Expected sanitized filename: "react-e2e-testing-helper-123.md"
      expect(filename).toBe('react-e2e-testing-helper-123.md')
      
      // Verify file exists
      const p = path.join(SKILLS_DIR, filename)
      expect(fs.existsSync(p)).toBe(true)
      expect(fs.readFileSync(p, 'utf-8')).toBe(customContent)
    })

    it('should throw an error for invalid skill names', () => {
      expect(() => createSkill('!!!', 'content')).toThrowError('Invalid skill name')
      expect(() => createSkill('   ', 'content')).toThrowError('Invalid skill name')
    })

    it('should read a skill file correctly', () => {
      const filename = createSkill('Math Tutor', 'Solve math problems step-by-step.')
      
      const content = readSkill(filename)
      expect(content).toBe('Solve math problems step-by-step.')
    })

    it('should return empty string when trying to read non-existent skill', () => {
      const content = readSkill('does-not-exist.md')
      expect(content).toBe('')
    })

    it('should overwrite existing skill file when using the same name', () => {
      const name = 'Duplicate Skill'
      const file1 = createSkill(name, 'Initial content')
      expect(readSkill(file1)).toBe('Initial content')

      const file2 = createSkill(name, 'Updated content')
      expect(file1).toBe(file2)
      expect(readSkill(file2)).toBe('Updated content')
    })

    it('should defend against path traversal attempts in readSkill and deleteSkill', () => {
      // Setup a dummy file outside the SKILLS_DIR
      const parentDir = path.dirname(SKILLS_DIR)
      const sensitiveFile = path.join(parentDir, 'sensitive.txt')
      fs.writeFileSync(sensitiveFile, 'secret data', 'utf-8')
      expect(fs.existsSync(sensitiveFile)).toBe(true)

      // Traversal read attempt
      const traversalPath = '../sensitive.txt'
      expect(readSkill(traversalPath)).toBe('')

      // Traversal delete attempt
      deleteSkill(traversalPath)
      expect(fs.existsSync(sensitiveFile)).toBe(true) // file remains safe

      // Cleanup
      fs.unlinkSync(sensitiveFile)
    })

    it('should delete skill files correctly', () => {
      const filename = createSkill('Delete Me', 'Temporary content.')
      
      // Check it is listed
      let skills = listSkills()
      expect(skills.some(s => s.file === filename)).toBe(true)
      
      deleteSkill(filename)
      
      // Check it is removed
      skills = listSkills()
      expect(skills.some(s => s.file === filename)).toBe(false)
      
      // Verify file is gone
      const p = path.join(SKILLS_DIR, filename)
      expect(fs.existsSync(p)).toBe(false)
    })
  })

  describe('Integration with Shell', () => {
    it('should trigger shell.openPath when opening dir', () => {
      openSkillsDir()
      expect(shell.openPath).toHaveBeenCalledWith(SKILLS_DIR)
    })
  })
})
