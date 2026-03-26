import { BankHoliday, WorkdayConfiguration, WorkdayDuration } from '../types';

// Default workday configuration for Senegal banking sector
export const DEFAULT_WORKDAY_CONFIG: WorkdayConfiguration = {
  standardWorkdays: 3, // 3 workdays default for credit processing
  workingHours: {
    start: '08:00',
    end: '17:00'
  },
  workingDays: [1, 2, 3, 4, 5], // Monday to Friday (0 = Sunday, 1 = Monday, etc.)
  holidays: [
    // ── 2024 ────────────────────────────────────────────────────────────────
    // Jours fériés fixes (récurrents chaque année)
    { id: 'sn-2024-0101', name: "Jour de l'An",            date: '2024-01-01', year: 2024, isRecurring: true,  description: 'Nouvel An' },
    { id: 'sn-2024-0404', name: "Fête de l'Indépendance",  date: '2024-04-04', year: 2024, isRecurring: true,  description: 'Indépendance du Sénégal (1960)' },
    { id: 'sn-2024-0501', name: "Fête du Travail",         date: '2024-05-01', year: 2024, isRecurring: true,  description: 'Journée internationale des travailleurs' },
    { id: 'sn-2024-0815', name: "Assomption",              date: '2024-08-15', year: 2024, isRecurring: true,  description: 'Assomption de la Vierge Marie' },
    { id: 'sn-2024-1101', name: "Toussaint",               date: '2024-11-01', year: 2024, isRecurring: true,  description: 'Fête de tous les saints' },
    { id: 'sn-2024-1225', name: "Noël",                    date: '2024-12-25', year: 2024, isRecurring: true,  description: 'Nativité de Jésus-Christ' },
    // Jours fériés chrétiens mobiles
    { id: 'sn-2024-paques',      name: "Lundi de Pâques",       date: '2024-04-01', year: 2024, isRecurring: false, description: 'Lendemain de Pâques' },
    { id: 'sn-2024-ascension',   name: "Ascension",             date: '2024-05-09', year: 2024, isRecurring: false, description: 'Ascension du Christ' },
    { id: 'sn-2024-pentecote',   name: "Lundi de Pentecôte",    date: '2024-05-20', year: 2024, isRecurring: false, description: 'Lendemain de la Pentecôte' },
    // Jours fériés islamiques (dates variables selon le calendrier lunaire)
    { id: 'sn-2024-korité',      name: "Korité (Aïd el-Fitr)",  date: '2024-04-10', year: 2024, isRecurring: false, description: 'Fin du mois de Ramadan' },
    { id: 'sn-2024-tabaski',     name: "Tabaski (Aïd el-Kébir)",date: '2024-06-17', year: 2024, isRecurring: false, description: 'Fête du sacrifice' },
    { id: 'sn-2024-tamkharit',   name: "Tamkharit",             date: '2024-07-16', year: 2024, isRecurring: false, description: 'Achoura — 10e jour de Mouharram' },
    { id: 'sn-2024-gamou',       name: "Gamou (Mawlid)",        date: '2024-09-16', year: 2024, isRecurring: false, description: 'Naissance du Prophète Mohammed (PSL)' },

    // ── 2025 ────────────────────────────────────────────────────────────────
    { id: 'sn-2025-0101', name: "Jour de l'An",            date: '2025-01-01', year: 2025, isRecurring: true,  description: 'Nouvel An' },
    { id: 'sn-2025-0404', name: "Fête de l'Indépendance",  date: '2025-04-04', year: 2025, isRecurring: true,  description: 'Indépendance du Sénégal (1960)' },
    { id: 'sn-2025-0501', name: "Fête du Travail",         date: '2025-05-01', year: 2025, isRecurring: true,  description: 'Journée internationale des travailleurs' },
    { id: 'sn-2025-0815', name: "Assomption",              date: '2025-08-15', year: 2025, isRecurring: true,  description: 'Assomption de la Vierge Marie' },
    { id: 'sn-2025-1101', name: "Toussaint",               date: '2025-11-01', year: 2025, isRecurring: true,  description: 'Fête de tous les saints' },
    { id: 'sn-2025-1225', name: "Noël",                    date: '2025-12-25', year: 2025, isRecurring: true,  description: 'Nativité de Jésus-Christ' },
    { id: 'sn-2025-paques',      name: "Lundi de Pâques",       date: '2025-04-21', year: 2025, isRecurring: false, description: 'Lendemain de Pâques' },
    { id: 'sn-2025-ascension',   name: "Ascension",             date: '2025-05-29', year: 2025, isRecurring: false, description: 'Ascension du Christ' },
    { id: 'sn-2025-pentecote',   name: "Lundi de Pentecôte",    date: '2025-06-09', year: 2025, isRecurring: false, description: 'Lendemain de la Pentecôte' },
    { id: 'sn-2025-korité',      name: "Korité (Aïd el-Fitr)",  date: '2025-03-30', year: 2025, isRecurring: false, description: 'Fin du mois de Ramadan' },
    { id: 'sn-2025-tabaski',     name: "Tabaski (Aïd el-Kébir)",date: '2025-06-07', year: 2025, isRecurring: false, description: 'Fête du sacrifice' },
    { id: 'sn-2025-tamkharit',   name: "Tamkharit",             date: '2025-07-05', year: 2025, isRecurring: false, description: 'Achoura — 10e jour de Mouharram' },
    { id: 'sn-2025-gamou',       name: "Gamou (Mawlid)",        date: '2025-09-04', year: 2025, isRecurring: false, description: 'Naissance du Prophète Mohammed (PSL)' },

    // ── 2026 ────────────────────────────────────────────────────────────────
    { id: 'sn-2026-0101', name: "Jour de l'An",            date: '2026-01-01', year: 2026, isRecurring: true,  description: 'Nouvel An' },
    { id: 'sn-2026-0404', name: "Fête de l'Indépendance",  date: '2026-04-04', year: 2026, isRecurring: true,  description: 'Indépendance du Sénégal (1960)' },
    { id: 'sn-2026-0501', name: "Fête du Travail",         date: '2026-05-01', year: 2026, isRecurring: true,  description: 'Journée internationale des travailleurs' },
    { id: 'sn-2026-0815', name: "Assomption",              date: '2026-08-15', year: 2026, isRecurring: true,  description: 'Assomption de la Vierge Marie' },
    { id: 'sn-2026-1101', name: "Toussaint",               date: '2026-11-01', year: 2026, isRecurring: true,  description: 'Fête de tous les saints' },
    { id: 'sn-2026-1225', name: "Noël",                    date: '2026-12-25', year: 2026, isRecurring: true,  description: 'Nativité de Jésus-Christ' },
    { id: 'sn-2026-paques',      name: "Lundi de Pâques",       date: '2026-04-06', year: 2026, isRecurring: false, description: 'Lendemain de Pâques' },
    { id: 'sn-2026-ascension',   name: "Ascension",             date: '2026-05-14', year: 2026, isRecurring: false, description: 'Ascension du Christ' },
    { id: 'sn-2026-pentecote',   name: "Lundi de Pentecôte",    date: '2026-05-25', year: 2026, isRecurring: false, description: 'Lendemain de la Pentecôte' },
    { id: 'sn-2026-korité',      name: "Korité (Aïd el-Fitr)",  date: '2026-03-20', year: 2026, isRecurring: false, description: 'Fin du mois de Ramadan' },
    { id: 'sn-2026-tabaski',     name: "Tabaski (Aïd el-Kébir)",date: '2026-05-27', year: 2026, isRecurring: false, description: 'Fête du sacrifice' },
    { id: 'sn-2026-tamkharit',   name: "Tamkharit",             date: '2026-06-25', year: 2026, isRecurring: false, description: 'Achoura — 10e jour de Mouharram' },
    { id: 'sn-2026-gamou',       name: "Gamou (Mawlid)",        date: '2026-08-25', year: 2026, isRecurring: false, description: 'Naissance du Prophète Mohammed (PSL)' },
  ]
};

/**
 * Check if a date is a working day (not weekend or holiday)
 */
export const isWorkingDay = (date: Date, config: WorkdayConfiguration = DEFAULT_WORKDAY_CONFIG): boolean => {
  const dayOfWeek = date.getDay();
  
  // Check if it's a working day of the week
  if (!config.workingDays.includes(dayOfWeek)) {
    return false;
  }
  
  // Check if it's a holiday
  const dateString = date.toISOString().split('T')[0];
  const isHoliday = config.holidays.some(holiday => holiday.date === dateString);
  
  return !isHoliday;
};

/**
 * Calculate the number of working hours between two dates
 */
export const calculateWorkingHours = (startDate: Date, endDate: Date, config: WorkdayConfiguration = DEFAULT_WORKDAY_CONFIG): number => {
  if (startDate >= endDate) return 0;
  
  const startHour = parseInt(config.workingHours.start.split(':')[0]);
  const endHour = parseInt(config.workingHours.end.split(':')[0]);
  const dailyWorkingHours = endHour - startHour;
  
  let totalHours = 0;
  let currentDate = new Date(startDate);
  
  while (currentDate < endDate) {
    if (isWorkingDay(currentDate, config)) {
      // Calculate hours for this day
      const dayStart = new Date(currentDate);
      dayStart.setHours(startHour, 0, 0, 0);
      
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(endHour, 0, 0, 0);
      
      // Determine actual start and end times for this day
      const actualStart = currentDate < dayStart ? dayStart : currentDate;
      const actualEnd = endDate > dayEnd ? dayEnd : endDate;
      
      if (actualStart < actualEnd) {
        const hoursThisDay = (actualEnd.getTime() - actualStart.getTime()) / (1000 * 60 * 60);
        totalHours += Math.min(hoursThisDay, dailyWorkingHours);
      }
    }
    
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
    currentDate.setHours(startHour, 0, 0, 0);
  }
  
  return Math.round(totalHours * 100) / 100; // Round to 2 decimal places
};

/**
 * Calculate workday duration in days and hours format
 */
export const calculateWorkdayDuration = (startDate: Date, endDate: Date, config: WorkdayConfiguration = DEFAULT_WORKDAY_CONFIG): WorkdayDuration => {
  const totalWorkingHours = calculateWorkingHours(startDate, endDate, config);
  const startHour = parseInt(config.workingHours.start.split(':')[0]);
  const endHour = parseInt(config.workingHours.end.split(':')[0]);
  const dailyWorkingHours = endHour - startHour;
  
  const workdays = Math.floor(totalWorkingHours / dailyWorkingHours);
  const remainingHours = totalWorkingHours % dailyWorkingHours;
  
  return {
    workdays,
    hours: Math.round(remainingHours * 100) / 100,
    totalHours: totalWorkingHours,
    businessDaysOnly: true
  };
};

/**
 * Format duration for display
 */
export const formatWorkdayDuration = (duration: WorkdayDuration): string => {
  const parts: string[] = [];
  
  if (duration.workdays > 0) {
    parts.push(`${duration.workdays} jour${duration.workdays > 1 ? 's' : ''}`);
  }
  
  if (duration.hours > 0) {
    const hours = Math.floor(duration.hours);
    const minutes = Math.round((duration.hours - hours) * 60);
    
    if (hours > 0) {
      parts.push(`${hours}h`);
    }
    if (minutes > 0) {
      parts.push(`${minutes}min`);
    }
  }
  
  return parts.length > 0 ? parts.join(' ') : '0min';
};

/**
 * Check if processing time exceeds standard workdays
 */
export const isProcessingOverdue = (duration: WorkdayDuration, config: WorkdayConfiguration = DEFAULT_WORKDAY_CONFIG): boolean => {
  return duration.workdays > config.standardWorkdays;
};

/**
 * Get processing status based on duration
 */
export const getProcessingStatus = (duration: WorkdayDuration, config: WorkdayConfiguration = DEFAULT_WORKDAY_CONFIG): {
  status: 'excellent' | 'good' | 'warning' | 'overdue';
  label: string;
  color: 'success' | 'info' | 'warning' | 'error';
} => {
  const standardDays = config.standardWorkdays;
  
  if (duration.workdays < standardDays * 0.5) {
    return { status: 'excellent', label: 'Excellent', color: 'success' };
  } else if (duration.workdays <= standardDays * 0.8) {
    return { status: 'good', label: 'Bon', color: 'info' };
  } else if (duration.workdays <= standardDays) {
    return { status: 'warning', label: 'À surveiller', color: 'warning' };
  } else {
    return { status: 'overdue', label: 'En retard', color: 'error' };
  }
};

/**
 * Add workdays to a date (excluding weekends and holidays)
 */
export const addWorkdays = (startDate: Date, workdays: number, config: WorkdayConfiguration = DEFAULT_WORKDAY_CONFIG): Date => {
  let currentDate = new Date(startDate);
  let daysAdded = 0;
  
  while (daysAdded < workdays) {
    currentDate.setDate(currentDate.getDate() + 1);
    
    if (isWorkingDay(currentDate, config)) {
      daysAdded++;
    }
  }
  
  return currentDate;
};

/**
 * Get expected completion date based on standard workdays
 */
export const getExpectedCompletionDate = (startDate: Date, config: WorkdayConfiguration = DEFAULT_WORKDAY_CONFIG): Date => {
  return addWorkdays(startDate, config.standardWorkdays, config);
};

/**
 * Load workday configuration from localStorage.
 * Merges saved settings with defaults: holidays are merged per year so that
 * years not yet in localStorage always get the default entries.
 */
export const loadWorkdayConfiguration = (): WorkdayConfiguration => {
  try {
    const saved = localStorage.getItem('workday-configuration');
    if (saved) {
      const parsed = JSON.parse(saved);
      const savedHolidays: BankHoliday[] = parsed.holidays || [];
      // Years already customised by the user — keep them as-is
      const savedYears = new Set(savedHolidays.map((h: BankHoliday) => h.year));
      // Default holidays for years not yet in localStorage
      const missingDefaults = DEFAULT_WORKDAY_CONFIG.holidays.filter(
        h => !savedYears.has(h.year)
      );
      return {
        ...DEFAULT_WORKDAY_CONFIG,
        ...parsed,
        holidays: [...savedHolidays, ...missingDefaults],
      };
    }
  } catch (error) {
    console.warn('Failed to load workday configuration:', error);
  }
  return DEFAULT_WORKDAY_CONFIG;
};

/**
 * Save workday configuration to localStorage
 */
export const saveWorkdayConfiguration = (config: WorkdayConfiguration): void => {
  try {
    localStorage.setItem('workday-configuration', JSON.stringify(config));
  } catch (error) {
    console.error('Failed to save workday configuration:', error);
  }
};