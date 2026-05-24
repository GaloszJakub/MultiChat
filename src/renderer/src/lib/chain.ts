import { SERVICES } from './services'
import type { ServiceId } from '../../../main/services/types'

/**
 * Resolves template placeholders for Sequential Chain execution.
 * Placeholders:
 * - {{input}}: Original prompt entered by the user
 * - {{previous}}: The immediately preceding step's model response
 * - {{all_previous}}: Formatted list of all models' responses so far
 * - {{chatgpt}}, {{claude}}, etc.: Individual service responses
 */
export function resolveTemplate(
  template: string,
  originalInput: string,
  responses: Record<ServiceId, string>,
  previousResponse: string
): string {
  let resolved = template
  resolved = resolved.replaceAll('{{input}}', originalInput)
  resolved = resolved.replaceAll('{{previous}}', previousResponse)

  // Build all_previous
  const allPreviousParts: string[] = []
  SERVICES.forEach(s => {
    const resp = responses[s.id]
    if (resp && resp.trim()) {
      allPreviousParts.push(`**${s.label}:**\n${resp}`)
    }
  })
  const allPrevious = allPreviousParts.join('\n\n---\n\n')
  resolved = resolved.replaceAll('{{all_previous}}', allPrevious)

  // Model specific placeholders
  SERVICES.forEach(s => {
    resolved = resolved.replaceAll(`{{${s.id}}}`, responses[s.id] || '')
  })

  return resolved
}
