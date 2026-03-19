const TIME_ZONE = 'Europe/Amsterdam';

export const formatDateOnlyInAmsterdam = (date: Date): string =>
  date.toLocaleDateString('en-CA', { timeZone: TIME_ZONE });

export const getCompletedRaceDates = (runDate: Date, lookbackDays = 3): string[] =>
  Array.from({ length: lookbackDays }, (_, index) =>
    formatDateOnlyInAmsterdam(new Date(runDate.getTime() - (index + 1) * 86400000))
  );
