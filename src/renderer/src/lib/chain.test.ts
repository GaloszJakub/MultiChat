import { describe, it, expect } from 'vitest'
import { resolveTemplate } from './chain'
import type { ServiceId } from '../../../main/services/types'

describe('Custom Chain / Sequential Pipeline Template Resolver', () => {
  const mockResponses: Record<ServiceId, string> = {
    chatgpt: 'ChatGPT answer here.',
    claude: 'Claude summary is excellent.',
    gemini: 'Gemini reasoning.',
    grok: 'Grok fun fact!',
    kimi: '', // empty to test omissions in all_previous
    deepseek: 'DeepSeek deep dive.'
  }

  const originalInput = 'How does Photosynthesis work?'
  const previousResponse = 'Photosynthesis uses sunlight.'

  it('should replace {{input}} with the original user prompt', () => {
    const template = 'Explain this: "{{input}}"'
    const result = resolveTemplate(template, originalInput, mockResponses, previousResponse)
    expect(result).toBe('Explain this: "How does Photosynthesis work?"')
  })

  it('should replace multiple occurrences of {{input}}', () => {
    const template = 'Prompt: {{input}} | Original: {{input}}'
    const result = resolveTemplate(template, originalInput, mockResponses, previousResponse)
    expect(result).toBe('Prompt: How does Photosynthesis work? | Original: How does Photosynthesis work?')
  })

  it('should replace {{previous}} with the immediate previous response', () => {
    const template = 'Translate this text: {{previous}}'
    const result = resolveTemplate(template, originalInput, mockResponses, previousResponse)
    expect(result).toBe('Translate this text: Photosynthesis uses sunlight.')
  })

  it('should replace model-specific placeholders like {{chatgpt}}, {{claude}}, {{gemini}}', () => {
    const template = 'Comparing ChatGPT ({{chatgpt}}) and Claude ({{claude}}).'
    const result = resolveTemplate(template, originalInput, mockResponses, previousResponse)
    expect(result).toBe('Comparing ChatGPT (ChatGPT answer here.) and Claude (Claude summary is excellent.).')
  })

  it('should replace model-specific placeholders with empty strings if no response is available', () => {
    const template = 'Kimi response: [{{kimi}}]'
    const result = resolveTemplate(template, originalInput, mockResponses, previousResponse)
    expect(result).toBe('Kimi response: []')
  })

  it('should compile and format {{all_previous}} containing markdown list of all non-empty model responses', () => {
    const template = 'Here are all responses so far:\n{{all_previous}}'
    const result = resolveTemplate(template, originalInput, mockResponses, previousResponse)
    
    // Check that non-empty responses are present
    expect(result).toContain('**ChatGPT:**\nChatGPT answer here.')
    expect(result).toContain('**Claude:**\nClaude summary is excellent.')
    expect(result).toContain('**Gemini:**\nGemini reasoning.')
    expect(result).toContain('**Grok:**\nGrok fun fact!')
    expect(result).toContain('**DeepSeek:**\nDeepSeek deep dive.')
    
    // Check that Kimi (which is empty) is excluded
    expect(result).not.toContain('**Kimi:**')
    
    // Check correct dividers are present
    expect(result).toContain('\n\n---\n\n')
  })

  it('should handle completely empty templates or inputs gracefully', () => {
    expect(resolveTemplate('', originalInput, mockResponses, previousResponse)).toBe('')
    expect(resolveTemplate('Static text without placeholders', '', mockResponses, '')).toBe('Static text without placeholders')
  })

  it('should resolve a complex combined template with all kinds of placeholders', () => {
    const template = `
=== CUSTOM CHAIN STEP ===
Original Question: {{input}}
Latest Output: {{previous}}
ChatGPT said: {{chatgpt}}
Summary of all:
{{all_previous}}
========================
`.trim()

    const result = resolveTemplate(template, originalInput, mockResponses, previousResponse)

    expect(result).toContain('Original Question: How does Photosynthesis work?')
    expect(result).toContain('Latest Output: Photosynthesis uses sunlight.')
    expect(result).toContain('ChatGPT said: ChatGPT answer here.')
    expect(result).toContain('**Claude:**\nClaude summary is excellent.')
  })
})
