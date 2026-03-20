// Helper functions for the create-ranking page
// These are extracted to reduce the page file size

export const setStartingListRace = async ({ year, race }: { year: number, race: string }) => {
  const response = await fetch(`/api/setStartingListRace?year=${year}&race=${race}`);
  const data = await response.json();
  return data;
};

export const getStartingListRace = async ({ year, race }: { year: number, race: string }) => {
  const response = await fetch(`/api/getRidersFromRace?year=${year}&race=${race}`);
  const data = await response.json();
  return data;
};

export const getAllTeams = async () => {
  const response = await fetch(`/api/getTeams`);
  const data = await response.json();
  return data;
};

export const getEnrichedRiders = async (teamsArray: any[]) => {
  console.log(`Starting to enrich riders for ${teamsArray.length} teams...`);

  for (let i = 0; i < teamsArray.length; i++) {
    const team: any = teamsArray[i];
    let teamSlug = team.slug;

    if (teamSlug === 'q365-pro-cycing-team-2025') {
      teamSlug = 'q365-pro-cycling-team-2025'
    }

    try {
      console.log(`[${i + 1}/${teamsArray.length}] Enriching riders for team: ${teamSlug}`);
      const response = await fetch(`/api/setEnrichedRiders?year=2026&team=${teamSlug}`);
      const data = await response.json();

      if (!response.ok) {
        console.error(`Failed to enrich riders for ${teamSlug}:`, data);
      } else {
        console.log(`✓ Successfully enriched riders for ${teamSlug}`);
      }

      if (i < teamsArray.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`Error enriching riders for ${teamSlug}:`, error);
    }
  }

  console.log('Finished enriching riders for all teams!');
};

export const getEnrichedTeams = async (teamsArray: any[]) => {
  console.log(`Starting to enrich teams for ${teamsArray.length} teams...`);

  for (let i = 0; i < teamsArray.length; i++) {
    const team: any = teamsArray[i];
    let teamSlug = team.slug;

    if (teamSlug === 'q365-pro-cycing-team-2025') {
      teamSlug = 'q365-pro-cycling-team-2025'
    }

    try {
      console.log(`[${i + 1}/${teamsArray.length}] Enriching team: ${teamSlug}`);
      const response = await fetch(`/api/setEnrichedTeams?year=2026&team=${teamSlug}`);
      const data = await response.json();

      if (!response.ok) {
        console.error(`Failed to enrich team ${teamSlug}:`, data);
      } else {
        console.log(`✓ Successfully enriched team ${teamSlug}`);
      }

      if (i < teamsArray.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`Error enriching team ${teamSlug}:`, error);
    }
  }

  console.log('Finished enriching teams!');
};

export const clearOldCaches = (currentYear: number) => {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('riders_') || key.startsWith('teams_') || key.startsWith('cache_meta_'))) {
      if (!key.includes(`_${currentYear}`)) {
        localStorage.removeItem(key);
      }
    }
  }
};
