/**
 * Working time calculation utilities for banking operations
 * Converts calendar time to working days/hours excluding weekends and holidays
 */

// Bank working configuration for Senegal
export const WORKING_CONFIG = {
  // Working hours: 8:00 AM to 5:00 PM (9 hours per day)
  workingHours: {
    start: 8, // 8 AM
    end: 17,  // 5 PM
  },
  hoursPerDay: 9,
  daysPerWeek: 5, // Monday to Friday
  
  // Senegal bank holidays (approximation - would need to be configurable)
  holidays: [
    // Fixed holidays
    '01-01', // New Year's Day
    '04-04', // Independence Day
    '05-01', // Labor Day
    '12-25', // Christmas
    // Islamic holidays would be calculated dynamically in real implementation
  ]
};

/**
 * Check if a date falls on a weekend (Saturday or Sunday)
 */
export function isWeekend(date: Date): boolean {
  const dayOfWeek = date.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6; // Sunday = 0, Saturday = 6
}

/**
 * Check if a date is a bank holiday
 * In a real implementation, this would check against a configurable holiday database
 */
export function isHoliday(date: Date): boolean {
  const monthDay = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return WORKING_CONFIG.holidays.includes(monthDay);
}

/**
 * Check if a date is a working day (not weekend, not holiday)
 */
export function isWorkingDay(date: Date): boolean {
  return !isWeekend(date) && !isHoliday(date);
}

/**
 * Get the working hours in a specific day
 * Returns 0 if it's not a working day, otherwise returns configured working hours
 */
export function getWorkingHoursInDay(date: Date): number {
  return isWorkingDay(date) ? WORKING_CONFIG.hoursPerDay : 0;
}

/**
 * Calculate working time between two dates
 * Excludes weekends, holidays, and considers only working hours
 */
export function calculateWorkingTime(startDate: Date, endDate: Date): {
  totalWorkingMinutes: number;
  workingDays: number;
  workingHours: number;
} {
  if (startDate >= endDate) {
    return { totalWorkingMinutes: 0, workingDays: 0, workingHours: 0 };
  }

  let totalWorkingMinutes = 0;
  let workingDays = 0;

  // Start from the beginning of the start date's working hours
  const current = new Date(startDate);
  current.setHours(WORKING_CONFIG.workingHours.start, 0, 0, 0);

  // If start date is after working hours, move to next working day
  const startHour = startDate.getHours();
  if (startHour >= WORKING_CONFIG.workingHours.end || !isWorkingDay(startDate)) {
    current.setDate(current.getDate() + 1);
    current.setHours(WORKING_CONFIG.workingHours.start, 0, 0, 0);
  } else if (startHour < WORKING_CONFIG.workingHours.start) {
    current.setHours(WORKING_CONFIG.workingHours.start, 0, 0, 0);
  } else {
    current.setTime(startDate.getTime());
  }

  while (current < endDate) {
    if (isWorkingDay(current)) {
      const dayStart = new Date(current);
      dayStart.setHours(WORKING_CONFIG.workingHours.start, 0, 0, 0);
      
      const dayEnd = new Date(current);
      dayEnd.setHours(WORKING_CONFIG.workingHours.end, 0, 0, 0);

      // Calculate working minutes for this day
      let dayWorkingMinutes = 0;
      
      if (current.toDateString() === startDate.toDateString()) {
        // First day: from actual start time to end of working day
        const effectiveStart = startDate > dayStart ? startDate : dayStart;
        const effectiveEnd = endDate < dayEnd ? endDate : dayEnd;
        
        if (effectiveEnd > effectiveStart && effectiveStart < dayEnd) {
          dayWorkingMinutes = Math.max(0, effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60);
        }
      } else if (current.toDateString() === endDate.toDateString()) {
        // Last day: from start of working day to actual end time
        const effectiveEnd = endDate < dayEnd ? endDate : dayEnd;
        
        if (effectiveEnd > dayStart) {
          dayWorkingMinutes = Math.max(0, effectiveEnd.getTime() - dayStart.getTime()) / (1000 * 60);
        }
      } else {
        // Full working day
        dayWorkingMinutes = WORKING_CONFIG.hoursPerDay * 60;
      }

      totalWorkingMinutes += dayWorkingMinutes;
      if (dayWorkingMinutes > 0) {
        workingDays += dayWorkingMinutes / (WORKING_CONFIG.hoursPerDay * 60);
      }
    }

    // Move to next day
    current.setDate(current.getDate() + 1);
    current.setHours(WORKING_CONFIG.workingHours.start, 0, 0, 0);
  }

  return {
    totalWorkingMinutes,
    workingDays: Math.round(workingDays * 100) / 100,
    workingHours: Math.round((totalWorkingMinutes / 60) * 100) / 100
  };
}

/**
 * Format working time duration in a human-readable format
 */
export function formatWorkingDuration(workingMinutes: number): string {
  if (workingMinutes < 60) {
    return `${Math.round(workingMinutes)}min`;
  }

  const workingHours = workingMinutes / 60;
  
  if (workingHours < WORKING_CONFIG.hoursPerDay) {
    const hours = Math.floor(workingHours);
    const minutes = Math.round((workingHours - hours) * 60);
    
    if (minutes === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${minutes}min`;
  }

  const workingDays = workingHours / WORKING_CONFIG.hoursPerDay;
  
  if (workingDays < 1) {
    return `${Math.round(workingHours * 10) / 10}h`;
  }

  const days = Math.floor(workingDays);
  const remainingHours = Math.round((workingDays - days) * WORKING_CONFIG.hoursPerDay * 10) / 10;

  if (remainingHours === 0) {
    return `${days}j`;
  }
  
  return `${days}j ${remainingHours}h`;
}