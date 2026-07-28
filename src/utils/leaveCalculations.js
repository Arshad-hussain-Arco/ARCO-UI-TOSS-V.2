import { differenceInDays, addDays, getDay, isSameDay } from 'date-fns';

/**
 * Utility functions for frontend leave calculations.
 * Supports Saudi Arabia standard weekends (Friday & Saturday).
 */

const SA_WEEKEND_DAYS = [5, 6]; // Friday (5), Saturday (6)

/**
 * Checks if a given date is a weekend.
 * @param {Date} date
 * @param {number[]} weekendDays - Array of day indices (0-6) representing weekends.
 * @returns {boolean}
 */
export function isWeekend(date, weekendDays = SA_WEEKEND_DAYS) {
  const day = getDay(date);
  return weekendDays.includes(day);
}

/**
 * Checks if a given date is a public holiday.
 * @param {Date} date
 * @param {string[]|Date[]} holidays - Array of holiday dates (strings or Date objects).
 * @returns {boolean}
 */
export function isHoliday(date, holidays = []) {
  return holidays.some((holiday) => isSameDay(date, new Date(holiday)));
}

/**
 * Calculates leave duration metrics between a start and end date.
 * Automatically excludes weekends and public holidays from business days.
 * 
 * @param {Date} startDate 
 * @param {Date} endDate 
 * @param {string[]} holidays 
 * @param {boolean} isHalfDay 
 * @returns {Object} { totalDays, businessDays, weekendDays, holidayDays }
 */
export function calculateLeaveDuration(startDate, endDate, holidays = [], isHalfDay = false) {
  if (!startDate || !endDate) {
    return { totalDays: 0, businessDays: 0, weekendDays: 0, holidayDays: 0 };
  }

  // If end date is before start date, return 0
  if (endDate < startDate && !isSameDay(startDate, endDate)) {
    return { totalDays: 0, businessDays: 0, weekendDays: 0, holidayDays: 0 };
  }

  let totalDays = 0;
  let businessDays = 0;
  let weekendDays = 0;
  let holidayDays = 0;

  // We iterate through every day from start to end (inclusive)
  const totalDaysDiff = differenceInDays(endDate, startDate) + 1;

  for (let i = 0; i < totalDaysDiff; i++) {
    const currentDate = addDays(startDate, i);
    totalDays++;

    if (isWeekend(currentDate)) {
      weekendDays++;
    } else if (isHoliday(currentDate, holidays)) {
      holidayDays++;
    } else {
      businessDays++;
    }
  }

  // Adjust for half day (only applies if business days > 0 and usually for single day leaves)
  if (isHalfDay && businessDays > 0) {
    businessDays -= 0.5;
  }

  return {
    totalDays,
    businessDays,
    weekendDays,
    holidayDays,
  };
}

/**
 * Mocks updating an employee's leave balance.
 * @param {Object} currentBalance - { annual: 30, sick: 15, casual: 5 }
 * @param {string} leaveType - 'Annual Leave', 'Sick Leave', etc.
 * @param {number} deductedDays - Number of business days to deduct
 * @returns {Object} updated balance
 */
export function calculateRemainingBalance(currentBalance, leaveType, deductedDays) {
  const balanceMap = {
    'Annual Leave': 'annual',
    'Sick Leave': 'sick',
    'Casual Leave': 'casual',
    'Unpaid Leave': 'unpaid'
  };

  const key = balanceMap[leaveType];
  
  if (!key || currentBalance[key] === undefined) {
    return currentBalance; // Unchanged if mapping fails or unpaid
  }

  return {
    ...currentBalance,
    [key]: Math.max(0, currentBalance[key] - deductedDays)
  };
}
