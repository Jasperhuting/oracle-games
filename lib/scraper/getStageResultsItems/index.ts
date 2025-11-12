/**
 * Modular stage result scrapers
 * 
 * This module exports individual scraping functions for different classifications.
 * Each function is responsible for scraping a specific type of data from the stage results page.
 */

export { createHelpers } from './shared-helpers';
export { scrapeStageResults } from './getStageResults-stage';
export { scrapeGeneralClassification } from './getStageResults-gc';
export { scrapePointsClassification } from './getStageResults-points';
export { scrapeMountainsClassification } from './getStageResults-mountains';
export { scrapeYouthClassification } from './getStageResults-youth';
export { scrapeTeamClassification } from './getStageResults-team';
