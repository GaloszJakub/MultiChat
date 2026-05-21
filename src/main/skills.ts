import { app, shell } from 'electron'
import { join } from 'path'
import { mkdirSync, readdirSync, readFileSync, existsSync, writeFileSync } from 'fs'

const SKILLS_DIR = join(app.getPath('userData'), 'skills')

function ensureDir() {
  if (!existsSync(SKILLS_DIR)) {
    mkdirSync(SKILLS_DIR, { recursive: true })
    // Create example skills
    writeFileSync(join(SKILLS_DIR, 'concise.md'),
      '# Concise\nAnswer briefly and to the point. No unnecessary explanations. Use bullet points when listing multiple items.')
    writeFileSync(join(SKILLS_DIR, 'explain-like-5.md'),
      '# Explain Like I\'m 5\nExplain the following as if to a 5-year-old. Use simple words, analogies, and short sentences.')
    writeFileSync(join(SKILLS_DIR, 'code-review.md'),
      '# Code Review\nReview the following code. Point out bugs, security issues, performance problems, and style improvements. Be specific.')
    writeFileSync(join(SKILLS_DIR, 'polish.md'),
      '# Polish Writing\nImprove the following text. Fix grammar, improve clarity, make it more professional. Preserve the original meaning.')
  }
}

export function listSkills(): { name: string; file: string }[] {
  ensureDir()
  return readdirSync(SKILLS_DIR)
    .filter(f => f.endsWith('.md'))
    .sort()
    .map(f => ({ name: f.replace(/\.md$/, ''), file: f }))
}

export function readSkill(file: string): string {
  ensureDir()
  const p = join(SKILLS_DIR, file)
  if (!existsSync(p) || !p.startsWith(SKILLS_DIR)) return ''
  return readFileSync(p, 'utf-8')
}

export function openSkillsDir() {
  ensureDir()
  shell.openPath(SKILLS_DIR)
}

export function createSkill(name: string, content: string): string {
  ensureDir()
  const safeName = name.trim().replace(/[^a-zA-Z0-9\-_ ]/g, '').replace(/\s+/g, '-').toLowerCase()
  if (!safeName) throw new Error('Invalid skill name')
  const file = `${safeName}.md`
  const p = join(SKILLS_DIR, file)
  writeFileSync(p, content.trim(), 'utf-8')
  return file
}

export { SKILLS_DIR }
