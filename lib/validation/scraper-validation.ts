/**
 * Scraper Data Validation Service
 *
 * Validates scraped data before storing to prevent:
 * - Empty/invalid data overwriting good data
 * - Points being reset due to failed scrapes
 * - Incorrect data from HTML parsing errors
 */

import type {
  StageResult,
  StartlistResult,
  StageRider,
  ClassificationRider,
  TeamClassification,
  TTTTeamResult
} from '../scraper/types';

// Validation configuration
export const VALIDATION_CONFIG = {
  // Minimum riders required for valid stage result
  MIN_RIDERS_STAGE: 10,
  // Warning threshold - less than this triggers a warning but not rejection
  MIN_RIDERS_WARNING: 50,
  // Maximum reasonable PCS points for a single result
  MAX_PCS_POINTS: 1000,
  // Maximum reasonable UCI points for a single result
  MAX_UCI_POINTS: 1000,
  // Maximum reasonable position in a race
  MAX_POSITION: 250,
};

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
  value?: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  metadata: {
    riderCount: number;
    hasGC: boolean;
    hasPointsClassification: boolean;
    hasMountainsClassification: boolean;
    hasYouthClassification: boolean;
    hasTeamClassification: boolean;
    validatedAt: string;
  };
}

/**
 * Check if result is a TTT team result (Team Time Trial)
 */
function isTTTTeamResult(result: StageRider | TTTTeamResult): result is TTTTeamResult {
  return 'riders' in result && Array.isArray((result as TTTTeamResult).riders);
}

/**
 * Validate a single stage rider result
 */
function validateStageRider(rider: StageRider, index: number): ValidationError[] {
  const errors: ValidationError[] = [];

  // Required fields
  if (rider.place === undefined || rider.place === null) {
    errors.push({
      field: `stageResults[${index}].place`,
      message: 'Missing place/position',
      severity: 'error',
    });
  } else if (rider.place === -1 || rider.place === 0) {
    // -1 or 0 indicates DNF/DNS or the scraper could not parse the position
    // This is common and should not block points calculation for other riders
    errors.push({
      field: `stageResults[${index}].place`,
      message: `Rider did not finish or position unknown (place: ${rider.place})`,
      severity: 'warning',
      value: rider.place,
    });
  } else if (rider.place < 0 || rider.place > VALIDATION_CONFIG.MAX_POSITION) {
    errors.push({
      field: `stageResults[${index}].place`,
      message: `Invalid position: ${rider.place}`,
      severity: 'error',
      value: rider.place,
    });
  }

  // Must have at least one name identifier
  const hasName = rider.shortName || rider.lastName || rider.firstName || rider.name || rider.nameID;
  if (!hasName) {
    errors.push({
      field: `stageResults[${index}]`,
      message: 'Missing rider name identifier (shortName, lastName, firstName, name, or nameID)',
      severity: 'error',
    });
  }

  // Team should be present
  if (!rider.team) {
    errors.push({
      field: `stageResults[${index}].team`,
      message: 'Missing team name',
      severity: 'warning',
    });
  }

  // Validate points if present
  if (rider.points && rider.points !== '-') {
    const points = typeof rider.points === 'string' ? parseInt(rider.points, 10) : rider.points;
    if (!isNaN(points) && points > VALIDATION_CONFIG.MAX_PCS_POINTS) {
      errors.push({
        field: `stageResults[${index}].points`,
        message: `Points value seems too high: ${points}`,
        severity: 'warning',
        value: points,
      });
    }
  }

  return errors;
}

/**
 * Validate a classification rider (GC, Points, Mountains, Youth)
 */
function validateClassificationRider(
  rider: ClassificationRider,
  index: number,
  classificationType: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (rider.place === undefined || rider.place === null) {
    errors.push({
      field: `${classificationType}[${index}].place`,
      message: 'Missing place/position',
      severity: 'error',
    });
  }

  // Must have at least one identifier
  const hasName = rider.shortName || rider.lastName || rider.firstName || rider.rider;
  if (!hasName) {
    errors.push({
      field: `${classificationType}[${index}]`,
      message: 'Missing rider name identifier',
      severity: 'warning',
    });
  }

  return errors;
}

/**
 * Validate team classification entry
 */
function validateTeamClassification(
  team: TeamClassification,
  index: number
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (team.place === undefined || team.place === null) {
    errors.push({
      field: `teamClassification[${index}].place`,
      message: 'Missing place/position',
      severity: 'error',
    });
  }

  if (!team.team && !team.shortName) {
    errors.push({
      field: `teamClassification[${index}]`,
      message: 'Missing team name',
      severity: 'warning',
    });
  }

  return errors;
}

/**
 * Validate a complete StageResult object
 */
export function validateStageResult(data: StageResult): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Metadata
  const stageResults = Array.isArray(data.stageResults) ? data.stageResults : [];
  const gc = Array.isArray(data.generalClassification) ? data.generalClassification : [];
  const points = Array.isArray(data.pointsClassification) ? data.pointsClassification : [];
  const mountains = Array.isArray(data.mountainsClassification) ? data.mountainsClassification : [];
  const youth = Array.isArray(data.youthClassification) ? data.youthClassification : [];
  const teams = Array.isArray(data.teamClassification) ? data.teamClassification : [];

  // Count riders - handle TTT results by counting riders within teams
  // For tour-gc documents, stageResults is empty - use generalClassification instead
  const isTourGC = (data as any).isTourGC === true || (data as any).key?.type === 'tour-gc';
  
  // For TTT races, count total riders across all teams
  const tttRiderCount = stageResults
    .filter(r => isTTTTeamResult(r))
    .reduce((sum, team) => sum + (team as TTTTeamResult).riders.length, 0);
  const regularRiderCount = stageResults.filter(r => !isTTTTeamResult(r)).length;
  
  const riderCount = isTourGC
    ? gc.length
    : (tttRiderCount > 0 ? tttRiderCount : regularRiderCount);

  // 1. Check minimum rider count (only error for very low counts, no warning for "low" counts)
  // Note: Some races like National Championship ITTs can have as few as 20-30 riders
  if (riderCount < VALIDATION_CONFIG.MIN_RIDERS_STAGE) {
    errors.push({
      field: isTourGC ? 'generalClassification' : 'stageResults',
      message: `Too few riders: ${riderCount} (minimum: ${VALIDATION_CONFIG.MIN_RIDERS_STAGE})`,
      severity: 'error',
      value: riderCount,
    });
  }

  // 2. Check required metadata
  if (!data.race) {
    errors.push({
      field: 'race',
      message: 'Missing race name',
      severity: 'error',
    });
  }

  if (!data.year) {
    errors.push({
      field: 'year',
      message: 'Missing year',
      severity: 'error',
    });
  }

  // 3. Validate individual stage results
  stageResults.forEach((result, index) => {
    if (!isTTTTeamResult(result)) {
      const riderErrors = validateStageRider(result, index);
      riderErrors.forEach(err => {
        if (err.severity === 'error') {
          errors.push(err);
        } else {
          warnings.push(err);
        }
      });
    }
  });

  // 4. Check for duplicate positions in stage results
  const positions = stageResults
    .filter((r): r is StageRider => !isTTTTeamResult(r))
    .map(r => r.place)
    .filter(p => p !== undefined);

  const duplicatePositions = positions.filter((p, i) => positions.indexOf(p) !== i);
  if (duplicatePositions.length > 0) {
    warnings.push({
      field: 'stageResults',
      message: `Duplicate positions found: ${[...new Set(duplicatePositions)].join(', ')}`,
      severity: 'warning',
      value: duplicatePositions,
    });
  }

  // 5. Validate classifications
  gc.forEach((rider, index) => {
    const classErrors = validateClassificationRider(rider, index, 'generalClassification');
    classErrors.forEach(err => {
      if (err.severity === 'error') {
        errors.push(err);
      } else {
        warnings.push(err);
      }
    });
  });

  points.forEach((rider, index) => {
    const classErrors = validateClassificationRider(rider, index, 'pointsClassification');
    classErrors.forEach(err => {
      if (err.severity === 'error') {
        errors.push(err);
      } else {
        warnings.push(err);
      }
    });
  });

  mountains.forEach((rider, index) => {
    const classErrors = validateClassificationRider(rider, index, 'mountainsClassification');
    classErrors.forEach(err => {
      if (err.severity === 'error') {
        errors.push(err);
      } else {
        warnings.push(err);
      }
    });
  });

  youth.forEach((rider, index) => {
    const classErrors = validateClassificationRider(rider, index, 'youthClassification');
    classErrors.forEach(err => {
      if (err.severity === 'error') {
        errors.push(err);
      } else {
        warnings.push(err);
      }
    });
  });

  teams.forEach((team, index) => {
    const teamErrors = validateTeamClassification(team, index);
    teamErrors.forEach(err => {
      if (err.severity === 'error') {
        errors.push(err);
      } else {
        warnings.push(err);
      }
    });
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    metadata: {
      riderCount,
      hasGC: gc.length > 0,
      hasPointsClassification: points.length > 0,
      hasMountainsClassification: mountains.length > 0,
      hasYouthClassification: youth.length > 0,
      hasTeamClassification: teams.length > 0,
      validatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Validate a StartlistResult object
 */
export function validateStartlist(data: StartlistResult): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  const teams = Array.isArray(data.riders) ? data.riders : [];

  // Count total riders across all teams
  const totalRiders = teams.reduce((sum, team) => {
    const riderCount = Array.isArray(team.riders) ? team.riders.length : 0;
    return sum + riderCount;
  }, 0);

  // Check minimum riders
  if (totalRiders < VALIDATION_CONFIG.MIN_RIDERS_STAGE) {
    errors.push({
      field: 'riders',
      message: `Too few riders in startlist: ${totalRiders}`,
      severity: 'error',
      value: totalRiders,
    });
  }

  // Check required metadata
  if (!data.race) {
    errors.push({
      field: 'race',
      message: 'Missing race name',
      severity: 'error',
    });
  }

  if (!data.year) {
    errors.push({
      field: 'year',
      message: 'Missing year',
      severity: 'error',
    });
  }

  // Validate teams have required fields
  teams.forEach((team, index) => {
    if (!team.name && !team.shortName) {
      warnings.push({
        field: `riders[${index}]`,
        message: 'Team missing name',
        severity: 'warning',
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    metadata: {
      riderCount: totalRiders,
      hasGC: false,
      hasPointsClassification: false,
      hasMountainsClassification: false,
      hasYouthClassification: false,
      hasTeamClassification: false,
      validatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Check if data is a StageResult (vs StartlistResult)
 */
export function isStageResult(data: StageResult | StartlistResult): data is StageResult {
  return 'stageResults' in data;
}

/**
 * Validate either StageResult or StartlistResult
 */
export function validateScraperData(data: StageResult | StartlistResult): ValidationResult {
  if (isStageResult(data)) {
    return validateStageResult(data);
  }
  return validateStartlist(data);
}

/**
 * Generate a hash of the scraper data for idempotency checks
 */
export function generateDataHash(data: StageResult | StartlistResult): string {
  // Create a simplified object for hashing
  const hashObj = {
    race: data.race,
    year: data.year,
    count: data.count,
    // Include first and last rider for quick comparison
    stageResults: isStageResult(data)
      ? [data.stageResults?.[0], data.stageResults?.[data.stageResults.length - 1]]
      : undefined,
    riders: !isStageResult(data)
      ? data.riders?.length
      : undefined,
  };

  // Simple hash function
  const str = JSON.stringify(hashObj);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}
