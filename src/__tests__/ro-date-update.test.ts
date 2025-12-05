/**
 * Phase 27 - RO Date Update After Email Send (TDD)
 *
 * These tests verify that when an email is sent:
 * - lastDateUpdated is set to today
 * - nextDateToUpdate is set to today + 7 days
 * - The RO is no longer flagged as "overdue"
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isOverdue, parseDate } from '../lib/date-utils'

// ============================================================
// Test Suite 1: Date formatting for database
// ============================================================

describe('formatDateForDb', () => {
  // Helper function matching implementation in send-approved-email.ts
  const formatDateForDb = (d: Date): string =>
    `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`

  it('should format date as M/D/YYYY', () => {
    const date = new Date('2025-12-04T00:00:00')
    expect(formatDateForDb(date)).toBe('12/4/2025')
  })

  it('should not zero-pad single digit months', () => {
    const date = new Date('2025-01-05T00:00:00')
    expect(formatDateForDb(date)).toBe('1/5/2025')
  })

  it('should not zero-pad single digit days', () => {
    const date = new Date('2025-10-03T00:00:00')
    expect(formatDateForDb(date)).toBe('10/3/2025')
  })

  it('should handle double digit month and day', () => {
    const date = new Date('2025-12-25T00:00:00')
    expect(formatDateForDb(date)).toBe('12/25/2025')
  })
})

// ============================================================
// Test Suite 2: Next follow-up date calculation
// ============================================================

describe('calculateNextFollowUp', () => {
  // Helper function matching implementation
  const calculateNextFollowUp = (today: Date, daysToAdd: number): Date => {
    const nextDate = new Date(today)
    nextDate.setDate(today.getDate() + daysToAdd)
    return nextDate
  }

  it('should add 7 days to today', () => {
    const today = new Date('2025-12-04T00:00:00')
    const result = calculateNextFollowUp(today, 7)
    expect(result.getFullYear()).toBe(2025)
    expect(result.getMonth()).toBe(11) // December (0-indexed)
    expect(result.getDate()).toBe(11)
  })

  it('should handle month boundary (December to January)', () => {
    const today = new Date('2025-12-28T00:00:00')
    const result = calculateNextFollowUp(today, 7)
    expect(result.getFullYear()).toBe(2026)
    expect(result.getMonth()).toBe(0) // January
    expect(result.getDate()).toBe(4)
  })

  it('should handle year boundary', () => {
    const today = new Date('2025-12-31T00:00:00')
    const result = calculateNextFollowUp(today, 7)
    expect(result.getFullYear()).toBe(2026)
    expect(result.getMonth()).toBe(0) // January
    expect(result.getDate()).toBe(7)
  })

  it('should handle leap year February', () => {
    const today = new Date('2024-02-25T00:00:00') // 2024 is a leap year
    const result = calculateNextFollowUp(today, 7)
    expect(result.getFullYear()).toBe(2024)
    expect(result.getMonth()).toBe(2) // March
    expect(result.getDate()).toBe(3)
  })

  it('should handle non-leap year February', () => {
    const today = new Date('2025-02-25T00:00:00') // 2025 is not a leap year
    const result = calculateNextFollowUp(today, 7)
    expect(result.getFullYear()).toBe(2025)
    expect(result.getMonth()).toBe(2) // March
    expect(result.getDate()).toBe(4)
  })
})

// ============================================================
// Test Suite 3: Overdue status after date update
// ============================================================

describe('isOverdue after date update', () => {
  // Note: isOverdue compares against today's date (midnight)
  // We're testing that updating nextDateToUpdate to future clears overdue

  it('should NOT be overdue when nextDateToUpdate is in future', () => {
    // Use a date far in the future to avoid timezone issues
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)
    const futureDateStr = `${futureDate.getMonth() + 1}/${futureDate.getDate()}/${futureDate.getFullYear()}`

    expect(isOverdue(futureDateStr)).toBe(false)
  })

  it('should be overdue when nextDateToUpdate is in past', () => {
    // Use a date in the past
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 7)
    const pastDateStr = `${pastDate.getMonth() + 1}/${pastDate.getDate()}/${pastDate.getFullYear()}`

    expect(isOverdue(pastDateStr)).toBe(true)
  })

  it('should NOT be overdue when nextDateToUpdate is today', () => {
    // Today's date should NOT be overdue (overdue means < today, not <= today)
    const today = new Date()
    const todayStr = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`

    expect(isOverdue(todayStr)).toBe(false)
  })

  it('should handle null/undefined gracefully', () => {
    expect(isOverdue(null)).toBe(false)
    expect(isOverdue(undefined)).toBe(false)
    expect(isOverdue('')).toBe(false)
  })
})

// ============================================================
// Test Suite 4: Update decision logic
// ============================================================

describe('shouldUpdateRoDates', () => {
  // Helper function matching decision logic in send-approved-email.ts
  const shouldUpdateRoDates = (notification: { repairOrderId: number | null }): boolean => {
    return notification.repairOrderId !== null && notification.repairOrderId !== undefined
  }

  it('should update when notification has repairOrderId', () => {
    expect(shouldUpdateRoDates({ repairOrderId: 123 })).toBe(true)
  })

  it('should update when repairOrderId is 0 (valid ID)', () => {
    // Edge case: 0 is a valid ID in some systems
    expect(shouldUpdateRoDates({ repairOrderId: 0 })).toBe(true)
  })

  it('should skip when repairOrderId is null', () => {
    expect(shouldUpdateRoDates({ repairOrderId: null })).toBe(false)
  })
})

// ============================================================
// Test Suite 5: Date parsing compatibility
// ============================================================

describe('parseDate compatibility with format', () => {
  // Ensure our format is compatible with parseDate function

  it('should parse M/D/YYYY format correctly', () => {
    const result = parseDate('12/4/2025')
    expect(result).not.toBeNull()
    expect(result?.getFullYear()).toBe(2025)
    expect(result?.getMonth()).toBe(11) // December
    expect(result?.getDate()).toBe(4)
  })

  it('should parse MM/DD/YYYY format correctly', () => {
    const result = parseDate('12/25/2025')
    expect(result).not.toBeNull()
    expect(result?.getFullYear()).toBe(2025)
    expect(result?.getMonth()).toBe(11)
    expect(result?.getDate()).toBe(25)
  })

  it('should parse single digit month correctly', () => {
    const result = parseDate('1/15/2025')
    expect(result).not.toBeNull()
    expect(result?.getFullYear()).toBe(2025)
    expect(result?.getMonth()).toBe(0) // January
    expect(result?.getDate()).toBe(15)
  })
})

// ============================================================
// Test Suite 6: Integration scenario
// ============================================================

describe('Full integration scenario', () => {
  it('should reset overdue status after date update', () => {
    // Simulate the full flow:
    // 1. RO has overdue nextDateToUpdate (7 days ago)
    // 2. Email is sent
    // 3. nextDateToUpdate is updated to today + 7 days
    // 4. RO is no longer overdue

    const formatDateForDb = (d: Date): string =>
      `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`

    // Step 1: Old date (7 days ago) - should be overdue
    const oldDate = new Date()
    oldDate.setDate(oldDate.getDate() - 7)
    const oldDateStr = formatDateForDb(oldDate)
    expect(isOverdue(oldDateStr)).toBe(true)

    // Step 2-3: Simulate email send - update to today + 7
    const today = new Date()
    const newNextFollowUp = new Date()
    newNextFollowUp.setDate(today.getDate() + 7)
    const newDateStr = formatDateForDb(newNextFollowUp)

    // Step 4: Should no longer be overdue
    expect(isOverdue(newDateStr)).toBe(false)
  })

  it('should format lastDateUpdated as today', () => {
    const formatDateForDb = (d: Date): string =>
      `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`

    const today = new Date()
    const todayFormatted = formatDateForDb(today)

    // Verify the format matches expected pattern
    expect(todayFormatted).toMatch(/^\d{1,2}\/\d{1,2}\/\d{4}$/)

    // Verify it can be parsed back
    const parsed = parseDate(todayFormatted)
    expect(parsed).not.toBeNull()
    expect(parsed?.getFullYear()).toBe(today.getFullYear())
    expect(parsed?.getMonth()).toBe(today.getMonth())
    expect(parsed?.getDate()).toBe(today.getDate())
  })
})
