import { _electron as electron } from 'playwright'
import { test, expect } from '@playwright/test'
import * as path from 'path'

test.describe('MultiChat Electron E2E Tests', () => {
  let electronApp: any
  let window: any

  test.beforeEach(async () => {
    // Launch MultiChat using Playwright Electron handler pointing to project root
    electronApp = await electron.launch({
      args: [path.join(__dirname, '..')]
    })
    window = await electronApp.firstWindow()
  })

  test.afterEach(async () => {
    if (electronApp) {
      await electronApp.close()
    }
  })

  test('should launch the application successfully', async () => {
    // Verify window title
    const title = await window.title()
    expect(title).toBe('MultiChat')

    // Verify main view elements are present in DOM
    const promptTextarea = window.locator('textarea[placeholder="Ask all models…"]')
    await expect(promptTextarea).toBeVisible()
  })

  test('should toggle sidebar tabs between Skills and History', async () => {
    const skillsTab = window.locator('button:has-text("Skills")')
    const historyTab = window.locator('button:has-text("History")')

    await expect(skillsTab).toBeVisible()
    await expect(historyTab).toBeVisible()

    // 1. Switch to History Tab
    await historyTab.click()
    
    // Check that history-specific components are loaded
    const historySearch = window.locator('input[placeholder="Search history..."]')
    await expect(historySearch).toBeVisible()

    // 2. Switch back to Skills Tab
    await skillsTab.click()
    
    // Check that skills header is visible
    const newSkillButton = window.locator('button:has-text("New Skill")')
    await expect(newSkillButton).toBeVisible()
  })

  test('should open Pipeline Studio configuration modal when clicking Configure Chain', async () => {
    // 1. Switch broadcast mode to Sequential to make "Configure Chain" button visible
    const sequentialBtn = window.locator('button:has-text("Sequential")')
    await expect(sequentialBtn).toBeVisible()
    await sequentialBtn.click()

    // 2. Now the "Configure Chain" option is visible under the prompt composer actions bar
    const configureChainBtn = window.locator('span:has-text("Configure Chain")')
    await expect(configureChainBtn).toBeVisible()

    // Click the button to trigger modal
    await configureChainBtn.click()

    // Verify Sequential Chain Configuration modal header is rendered
    const modalHeader = window.locator('h3:has-text("Configure Sequential Chain")')
    await expect(modalHeader).toBeVisible()

    // Verify "Chain Steps" heading is visible in the modal (use .first() to prevent nesting strict mode violation)
    const stepsHeading = window.locator('span:has-text("Chain Steps")').first()
    await expect(stepsHeading).toBeVisible()

    // Close the modal (either by Cancel button or escape)
    const cancelBtn = window.locator('button:has-text("Cancel")')
    await expect(cancelBtn).toBeVisible()
    await cancelBtn.click()

    // Modal should now be closed / hidden
    await expect(modalHeader).not.toBeVisible()
  })
})
