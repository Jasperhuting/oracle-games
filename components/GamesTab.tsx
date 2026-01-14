'use client'

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "./Button";
import { EnrichedRider } from "@/lib/scraper/types";
import { Flag } from "@/components/Flag";
import ClassificationTabs from "./ClassificationTabs";
import { ChevronLeft, ChevronRight } from "tabler-icons-react";
import { ConfirmDialog } from "./ConfirmDialog";
import { Race } from "@/lib/types/game-ui";
import { useTranslation } from "react-i18next";

// Module-level cache that persists across component mounts
const raceDataCache = new Map<string, any>(); // eslint-disable-line @typescript-eslint/no-explicit-any
const stagesCache = new Map<string, any[]>(); // eslint-disable-line @typescript-eslint/no-explicit-any

// TODO: fix any

export const GamesTab = () => {
  const { user } = useAuth();
  const userId = user?.uid;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [races, setRaces] = useState<Race[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(false);
  const [selectedRace, setSelectedRace] = useState<Race | null>(null);
  const [raceData, setRaceData] = useState<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [loadingRaceData, setLoadingRaceData] = useState(false);
  const [editingRaceId, setEditingRaceId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState<string>('');
  const [showStages, setShowStages] = useState(false);
  const [stages, setStages] = useState<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [loadingStages, setLoadingStages] = useState(false);
  const [savingStage, setSavingStage] = useState(false);
  const [savingRaceResult, setSavingRaceResult] = useState(false);
  const [stageNumber, setStageNumber] = useState<string>('');
  const [selectedStage, setSelectedStage] = useState<any | null>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [manuallyDeselected, setManuallyDeselected] = useState(false);
  const [initializeConfirmOpen, setInitializeConfirmOpen] = useState(false);
  const [saveAllStagesConfirmOpen, setSaveAllStagesConfirmOpen] = useState(false);
  const [saveRaceResultConfirmOpen, setSaveRaceResultConfirmOpen] = useState(false);
  const [infoDialog, setInfoDialog] = useState<{ title: string; description: string } | null>(null);
  const [rescrapeConfirmOpen, setRescrapeConfirmOpen] = useState<number | null>(null);
  const [rescraping, setRescraping] = useState(false);
  const { t } = useTranslation();

  const fetchRaces = (async () => {

    if (!userId) return;

    try {
      const response = await fetch(`/api/getRaces?userId=${userId}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch races');
      }

      const data = await response.json();
      setRaces(data.races);
      setError(null);
    } catch (error: unknown) {
      console.error('Error fetching races:', error);
      setError(error instanceof Error ? error.message : 'Kon races niet laden');
    } finally {
      setLoading(false);
    }
  });

  // Fetch races when component mounts or userId changes
  useEffect(() => {
    fetchRaces();
  }, [userId]);

  // Check URL for race parameter and load race data
  useEffect(() => {
    const raceSlug = searchParams.get('race');

    if (raceSlug && races.length > 0) {
      // Only load if it's a different race than currently selected
      if (!selectedRace || selectedRace.slug !== raceSlug) {
        const race = races.find(r => r.slug === raceSlug);
        if (race) {
          setManuallyDeselected(false);
          fetchRaceData(race, false); // false = don't update URL
        }
      }
    }
  }, [searchParams, races, manuallyDeselected, selectedRace]);

  const confirmInitializeRaces = () => {
    setInitializeConfirmOpen(true);
  };

  const handleRescrapeYear = async (year: number) => {
    if (!user) return;

    setRescraping(true);
    try {
      const response = await fetch('/api/admin/rescrape-year', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid,
          year: year.toString(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to rescrape year');
      }

      // Build detailed message
      let description = `Rescraped ${data.successCount} stages from ${data.racesProcessed} races.`;
      description += ` Season points cleared: ${data.seasonPointsCleared}.`;

      if (data.failCount > 0) {
        description += ` Failed: ${data.failCount}.`;
      }

      if (data.racesSkipped > 0) {
        description += `\n\nSkipped ${data.racesSkipped} races:`;
        // Show first 5 skip reasons
        const reasonsToShow = data.skippedReasons?.slice(0, 5) || [];
        for (const r of reasonsToShow) {
          description += `\n- ${r.slug}: ${r.reason}`;
        }
        if (data.skippedReasons?.length > 5) {
          description += `\n... and ${data.skippedReasons.length - 5} more`;
        }
      }

      if (data.results?.length > 0 && data.failCount > 0) {
        description += '\n\nFailed stages:';
        const failedResults = data.results.filter((r: { success: boolean }) => !r.success).slice(0, 5);
        for (const r of failedResults) {
          description += `\n- ${r.raceSlug} stage ${r.stage}: ${r.error}`;
        }
      }

      setInfoDialog({
        title: `Year ${year} Rescraped`,
        description,
      });

      // Refresh races list
      fetchRaces();
    } catch (error: unknown) {
      console.error('Error rescraping year:', error);
      setInfoDialog({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to rescrape year.',
      });
    } finally {
      setRescraping(false);
      setRescrapeConfirmOpen(null);
    }
  };

  const handleInitializeRaces = async () => {
    if (!user) return;

    setInitializing(true);
    try {
      const response = await fetch('/api/initializeRaces', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminUserId: user.uid,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Kon races niet initialiseren');
      }

      setInfoDialog({
        title: 'Races initialized',
        description: 'Races are successfully initialized.',
      });
      fetchRaces();
    } catch (error: unknown) {
      console.error('Error initializing races:', error);
      setInfoDialog({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to initialize races.',
      });
    } finally {
      setInitializing(false);
    }
  };

  const fetchRaceData = async (race: Race, updateUrl: boolean = true, forceRefresh: boolean = false) => {
    if (!user) return;

    setSelectedRace(race);
    setShowStages(false);

    // Update URL with race parameter
    if (updateUrl) {
      const currentTab = searchParams.get('tab') || 'races';
      router.push(`?tab=${currentTab}&race=${race.slug}`, { scroll: false });
    }

    // Check cache first
    if (!forceRefresh && raceDataCache.has(race.slug)) {
      setRaceData(raceDataCache.get(race.slug) || []);
      setLoadingRaceData(false);
      if (stagesCache.has(race.slug)) {
        setStages(stagesCache.get(race.slug) || []);
        setLoadingStages(false);
      } else {
        fetchStages(race.slug, false);
      }
      return;
    }

    setLoadingRaceData(true);
    setRaceData([]);

    try {
      const response = await fetch(`/api/getRaceData?userId=${user.uid}&raceSlug=${race.slug}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch race data');
      }

      const data = await response.json();
      setRaceData(data.data);
      
      // Cache the data
      raceDataCache.set(race.slug, data.data);
      
      // Also fetch stages
      fetchStages(race.slug, forceRefresh);
    } catch (error: unknown) {
      console.error('Error fetching race data:', error);
      setInfoDialog({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch race data.',
      });
    } finally {
      setLoadingRaceData(false);
    }
  };

  const fetchStages = async (raceSlug: string, forceRefresh: boolean = false) => {
    if (!user) return;

    // Check cache first
    if (!forceRefresh && stagesCache.has(raceSlug)) {
      setStages(stagesCache.get(raceSlug) || []);
      return;
    }

    setLoadingStages(true);
    try {
      const response = await fetch(`/api/getStageResults?userId=${user.uid}&raceSlug=${raceSlug}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch stages');
      }

      const data = await response.json();
      setStages(data.stages);
      
      // Cache the stages
      stagesCache.set(raceSlug, data.stages);
    } catch (error: unknown) {
      console.error('Error fetching stages:', error);
    } finally {
      setLoadingStages(false);
    }
  };

  const handleSaveStage = async () => {
    if (!user || !selectedRace || !stageNumber) return;

    setSavingStage(true);
    try {
      const response = await fetch('/api/saveStageResult', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid,
          raceSlug: selectedRace.slug,
          year: selectedRace.year,
          stage: stageNumber,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save stage');
      }

      const data = await response.json();
      setInfoDialog({
        title: 'Stage Saved',
        description: `Stage ${stageNumber} successfully saved with ${data.ridersCount} riders!`
      });
      setStageNumber('');
      fetchStages(selectedRace.slug);
    } catch (error: unknown) {
      console.error('Error saving stage:', error);
      setInfoDialog({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save stage.',
      });
    } finally {
      setSavingStage(false);
    }
  };

  const confirmSaveAllStages = () => {
    setSaveAllStagesConfirmOpen(true);
  };

  const handleSaveAllStages = async () => {
    if (!user || !selectedRace) return;

    const totalStages = 21;

    setSavingStage(true);
    let successCount = 0;
    const failedStages: number[] = [];

    try {
      for (let stage = 1; stage <= totalStages; stage++) {
        try {
          const response = await fetch('/api/saveStageResult', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: user.uid,
              raceSlug: selectedRace.slug,
              year: selectedRace.year,
              stage: stage,
            }),
          });

          if (response.ok) {
            successCount++;
            console.log(`✓ Stage ${stage} saved`);
          } else {
            failedStages.push(stage);
            console.error(`✗ Stage ${stage} failed`);
          }
        } catch (error) {
          failedStages.push(stage);
          console.error(`✗ Stage ${stage} error:`, error);
        }

        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (failedStages.length === 0) {
        setInfoDialog({
          title: 'Stages saved',
          description: `All ${totalStages} stages were saved successfully.`,
        });
      } else {
        setInfoDialog({
          title: 'Partial success',
          description: `✓ ${successCount} stages saved. ${failedStages.length} failed: ${failedStages.join(', ')}.`,
        });
      }

      fetchStages(selectedRace.slug);
    } catch (error: unknown) {
      console.error('Error saving all stages:', error);
      setInfoDialog({
        title: 'Error',
        description: `Something went wrong. ${successCount} stages have been saved.`,
      });
    } finally {
      setSavingStage(false);
    }
  };

  // Helper to check if race is a single-day race (no stages)
  const isSingleDayRace = (race: Race | null) => {
    if (!race) return false;
    // If stages is 1 or undefined/null, treat as single-day race
    return race.stages === 1 || race.stages === undefined || race.stages === null;
  };

  const confirmSaveRaceResult = () => {
    setSaveRaceResultConfirmOpen(true);
  };

  const handleSaveRaceResult = async () => {
    if (!user || !selectedRace) return;

    setSaveRaceResultConfirmOpen(false);
    setSavingRaceResult(true);
    try {
      const response = await fetch('/api/saveRaceResult', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid,
          raceSlug: selectedRace.slug,
          year: selectedRace.year,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save race result');
      }

      const data = await response.json();
      setInfoDialog({
        title: 'Result Saved',
        description: `Race result successfully saved with ${data.ridersCount} riders!`
      });
      // Refresh stages to show the new result
      fetchStages(selectedRace.slug, true);
    } catch (error: unknown) {
      console.error('Error saving race result:', error);
      setInfoDialog({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save race result.',
      });
    } finally {
      setSavingRaceResult(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('nl-NL', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const handleEditDescription = (race: Race, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingRaceId(race.id);
    setEditDescription(race.description || '');
  };

  const handleSaveDescription = async (raceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;

    try {
      const response = await fetch('/api/updateRaceDescription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid,
          raceId,
          description: editDescription,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update description');
      }

      // Update local state
      setRaces(races.map(race => 
        race.id === raceId 
          ? { ...race, description: editDescription }
          : race
      ));
      
      setEditingRaceId(null);
      setEditDescription('');
    } catch (error: unknown) {
      console.error('Error updating description:', error);
      setInfoDialog({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update description.',
      });
    }
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingRaceId(null);
    setEditDescription('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Races loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <span className="text-red-700 text-sm">{error}</span>
      </div>
    );
  }

  // If a race is selected, show race details
  if (selectedRace) {
    return (
      <div className="space-y-4">
        {/* Back button and header */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <Button
              className="px-4 py-2 "
              text="← Back to overview"
              onClick={() => {
                setSelectedRace(null);
                setRaceData([]);
                setManuallyDeselected(true);
                const currentTab = searchParams.get('tab') || 'races';
                router.push(`?tab=${currentTab}`, { scroll: false });
              }}
            />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-semibold">{selectedRace.name} {selectedRace.year}</h2>
            <p className="text-sm text-gray-600 mt-1">
              Collection: <code className="bg-gray-100 px-2 py-1 rounded">{selectedRace.slug}</code>
            </p>
            {selectedRace.description && (
              <p className="text-sm text-gray-600 mt-2">{selectedRace.description}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              className="px-4 py-2"
              text="Renners"
              selected={!showStages}
              onClick={() => setShowStages(false)}
            />
            <Button
              className="px-4 py-2"
              text={isSingleDayRace(selectedRace) ? `Result (${stages.length})` : `Etappes (${stages.length})`}
              selected={showStages}
              onClick={() => setShowStages(true)}
            />
            <Button
              className="px-4 py-2 bg-primary hover:bg-primary/90 ml-auto"
              text={loadingRaceData ? "🔄 Loading..." : t('global.refresh')}
              onClick={() => fetchRaceData(selectedRace, false, true)}
              disabled={loadingRaceData}
            />
          </div>
        </div>

        {/* Stages/Result View */}
        {showStages ? (
          selectedStage ? (
            /* Stage Detail View */
            <div className="space-y-4">
              {/* Back Button */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <Button
                  className="px-4 py-2 "
                  text="← Back to stages"
                  onClick={() => setSelectedStage(null)}
                />
              </div>

              {/* Stage Header */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h2 className="text-2xl font-semibold">Stage {selectedStage.stage}</h2>
                <div className="flex gap-2">

                  <Button
                    className="px-4 py-2"
                    text={<div className="flex flex-row items-center"><ChevronLeft size={16} /> Previous stage</div>}
                    disabled={selectedStage.stage === 1}
                    onClick={() => setSelectedStage(stages.find(stage => stage.stage === selectedStage.stage - 1))}
                  />
                  <Button
                    className="px-4 py-2"
                    text={<div className="flex flex-row items-center">Next stage <ChevronRight size={16} /></div>}
                    disabled={selectedStage.stage === stages.length}
                    onClick={() => setSelectedStage(stages.find(stage => stage.stage === selectedStage.stage + 1))}
                  />
                  
                  </div>
                <p className="text-sm text-gray-600 mt-1">
                  Saved on: {new Date(selectedStage.scrapedAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              {/* Classification Tabs */}
              <ClassificationTabs selectedStage={selectedStage} />
            </div>
          ) : isSingleDayRace(selectedRace) ? (
            /* Single-Day Race Result View */
            <div className="space-y-4">
              {/* Scrape Result Button */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-3">Race Result</h3>
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    This is a single-day race. Click the button below to scrape the race result from ProCyclingStats.
                  </p>
                  <Button
                    className="w-full px-6 py-2 bg-primary hover:bg-primary/90"
                    text={savingRaceResult ? "Scraping result..." : "🏁 Scrape Race Result"}
                    onClick={confirmSaveRaceResult}
                    disabled={savingRaceResult}
                  />
                </div>
              </div>

              {/* Result Display */}
              {loadingStages ? (
                <div className="flex items-center justify-center p-8 bg-white border border-gray-200 rounded-lg">
                  <div className="text-gray-600">Loading result...</div>
                </div>
              ) : stages.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
                  <p className="text-gray-600">No result saved yet</p>
                  <p className="text-sm text-gray-500 mt-2">Click the button above to scrape the race result</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {stages.map((result) => (
                    <div
                      key={result.id}
                      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => setSelectedStage(result)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="text-lg font-semibold">Race Result</h4>
                        <span className="text-xs text-gray-500">
                          {new Date(result.scrapedAt).toLocaleDateString('nl-NL')}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p>🚴 {result.stageResults?.length || 0} riders</p>
                        {result.stageResults?.[0] && (
                          <p>🥇 Winner: {result.stageResults[0]?.name || result.stageResults[0]?.shortName || 'Unknown'}</p>
                        )}
                        {result.stageResults?.[1] && (
                          <p>🥈 2nd: {result.stageResults[1]?.name || result.stageResults[1]?.shortName || 'Unknown'}</p>
                        )}
                        {result.stageResults?.[2] && (
                          <p>🥉 3rd: {result.stageResults[2]?.name || result.stageResults[2]?.shortName || 'Unknown'}</p>
                        )}
                      </div>
                      <div className="mt-3 text-xs text-primary font-medium">
                        Click for full results →
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Multi-Stage Race - Stages List View */
            <div className="space-y-4">
              {/* Add Stage Form */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-3">Add Stage</h3>
                <div className="space-y-3">
                  {/* Single stage */}
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={stageNumber}
                      onChange={(e) => setStageNumber(e.target.value)}
                      placeholder="Stage number (e.g. 1)"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <Button
                      className="px-6 py-2 bg-primary hover:bg-primary/90"
                      text={savingStage ? "Loading..." : "Save"}
                      onClick={handleSaveStage}
                      disabled={savingStage || !stageNumber}
                    />
                  </div>

                  {/* Divider */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-gray-500">or</span>
                    </div>
                  </div>

                  {/* All stages */}
                  <div className="flex items-center gap-2">
                    <Button
                      className="flex-1 px-6 py-2 bg-green-600 hover:bg-green-700 text-white"
                      text={savingStage ? "Busy adding all stages..." : "📦 Add all 21 stages"}
                      onClick={confirmSaveAllStages}
                      disabled={savingStage}
                    />
                  </div>
                  <p className="text-xs text-gray-500 text-center">
                    This can take a few minutes. Stages are saved one by one.
                  </p>
                </div>
              </div>

              {/* Stages List */}
              {loadingStages ? (
                <div className="flex items-center justify-center p-8 bg-white border border-gray-200 rounded-lg">
                  <div className="text-gray-600">Loading stages...</div>
                </div>
              ) : stages.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
                  <p className="text-gray-600">No stages saved yet</p>
                  <p className="text-sm text-gray-500 mt-2">Add a stage number to get started</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {stages.map((stage) => (
                    <div
                      key={stage.id}
                      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => setSelectedStage(stage)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="text-lg font-semibold">Stage {stage.stage}</h4>
                        <span className="text-xs text-gray-500">
                          {new Date(stage.scrapedAt).toLocaleDateString('nl-NL')}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p>🚴 {stage.stageResults?.length || 0} riders</p>
                        {stage.generalClassification?.length > 0 && (
                          <p>🏆 GC Leader: {stage.generalClassification[0]?.name || stage.generalClassification[0]?.firstName + ' ' + stage.generalClassification[0]?.lastName || 'Unknown'} ({stage.generalClassification[0]?.timeDifference && stage.generalClassification[0]?.timeDifference !== '-' ? stage.generalClassification[0]?.timeDifference : 'Leader'})</p>
                        )}
                        {stage.pointsClassification?.length > 0 && (
                          <p>🟢 Points Leader: {stage.pointsClassification[0]?.name || stage.pointsClassification[0]?.firstName + ' ' + stage.pointsClassification[0]?.lastName || 'Unknown'} ({stage.pointsClassification[0]?.pointsTotal || stage.pointsClassification[0]?.points || '-'} ptn)</p>
                        )}
                        {stage.mountainsClassification?.length > 0 && (
                          <p>⛰️ Mountains Leader: {stage.mountainsClassification[0]?.name || stage.mountainsClassification[0]?.firstName + ' ' + stage.mountainsClassification[0]?.lastName || 'Unknown'} ({stage.mountainsClassification[0]?.pointsTotal || stage.mountainsClassification[0]?.points || '-'} ptn)</p>
                        )}
                      </div>
                      <div className="mt-3 text-xs text-primary font-medium">
                        Click for details →
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        ) : (
          /* Race data - Riders List */
          <>
            {loadingRaceData ? (
              <div className="flex items-center justify-center p-8 bg-white border border-gray-200 rounded-lg">
                <div className="text-gray-600">Loading race data...</div>
              </div>
            ) : raceData.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
                <p className="text-gray-600">No data found in this race collection</p>
              </div>
            ) : (() => {
          // Group riders by team
          const ridersByTeam = raceData.reduce((acc, doc) => {
            const rider = doc.rider || {};
            const teamName = typeof rider.team === 'string' ? rider.team : rider.team?.name || 'No team';
            if (!acc[teamName]) {
              acc[teamName] = [];
            }
            acc[teamName].push(doc);
            return acc;
          }, {} as Record<string, any[]>); // eslint-disable-line @typescript-eslint/no-explicit-any

          // Sort teams alphabetically
          const sortedTeams = Object.keys(ridersByTeam).sort();

          return (
            <div className="space-y-6">
              {sortedTeams.map((teamName) => {
                const teamRiders = ridersByTeam[teamName];
                const firstRider = teamRiders[0]?.rider || {};
                const teamImage = firstRider?.team?.teamImage;

                return (
                  <div key={teamName} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    {/* Team Header */}
                    <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                      <div className="flex items-center gap-3">
                        {teamImage && (
                          <img 
                            src={`https://www.procyclingstats.com/${teamImage}`} 
                            alt={teamName} 
                            className="h-8 w-auto object-contain"
                          />
                        )}
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{teamName}</h3>
                          <p className="text-xs text-gray-500">
                            {teamRiders.length} rider{teamRiders.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Riders Table */}
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Photo
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Name
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Country
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Rank
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Points
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {teamRiders.map((doc: any, index: number) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                            const rider = doc.rider || {};
                            const riderImage = rider?.team?.riders?.find((teamRider: EnrichedRider) => teamRider.name === rider.nameID)?.jerseyImage;

                            return (
                              <tr key={doc.id || index} className="hover:bg-gray-50">
                                <td className="px-2 py-4 whitespace-nowrap w-20">
                                  <div className="flex items-center justify-center">
                                    {riderImage && (
                                      <img 
                                        src={`https://www.procyclingstats.com/${riderImage}`} 
                                        alt={rider.name} 
                                        className="h-12 w-12 object-cover object-top rounded-full"
                                      />
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900">
                                    {rider.name || doc.id || 'Onbekend'}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-600">
                                    <Flag 
                                    className="whitespace-nowrap break-keep" 
                                    width={30}
                                    countryCode={rider.country} 
                                     />
                                    
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-600">
                                    {rider.rank || '-'}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-600">
                                    {rider.points || '-'}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  {doc.dnf !== undefined ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                      DNF #{doc.dnf}
                                    </span>
                                  ) : doc.dns !== undefined ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                      DNS #{doc.dns}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-800 text-white">
                                      Active
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
          </>
        )}

        {/* Save Race Result Confirmation Dialog - needed in selectedRace view */}
        <ConfirmDialog
          open={saveRaceResultConfirmOpen}
          onClose={() => setSaveRaceResultConfirmOpen(false)}
          onConfirm={handleSaveRaceResult}
          title="Scrape Race Result"
          description={
            <>
              <p>Are you sure you want to scrape the race result from ProCyclingStats?</p>
              <p className="mt-2 text-sm text-gray-600">This will fetch the latest results and save them to the database.</p>
            </>
          }
          confirmText="Scrape Result"
          cancelText="Cancel"
          variant="primary"
        />

        {/* Info Dialog - needed in selectedRace view */}
        {infoDialog && (
          <ConfirmDialog
            open={true}
            onClose={() => setInfoDialog(null)}
            onConfirm={() => setInfoDialog(null)}
            title={infoDialog.title}
            description={infoDialog.description}
            confirmText="OK"
            cancelText="Close"
          />
        )}
      </div>
    );
  }

  // Helper to check if a race has passed
  const isRacePassed = (race: Race) => {
    if (!race.endDate && !race.startDate) return false;
    const dateStr = race.endDate || race.startDate;
    if (!dateStr) return false;
    const raceDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return raceDate < today;
  };

  // Helper to check if a race is a women's race
  const isWomensOrYouthRace = (race: Race) => {
    const classification = race.classification?.toUpperCase() || '';
    const slug = race.slug?.toLowerCase() || '';
    const name = race.name?.toLowerCase() || '';

    // Check classification for women's race types (from PCS terminology)
    // WWT = UCI Women's WorldTour (1.WWT, 2.WWT)
    // WE = Women Elite
    // WU = Women Under 23
    // WJ = Women Junior
    if (classification.includes('WWT')) return true;
    if (classification === 'WE' || classification.includes('.WE')) return true;
    if (classification === 'WU' || classification.includes('.WU')) return true;
    if (classification === 'WJ' || classification.includes('.WJ')) return true;
    if (classification === 'MU' || classification.includes('.MU')) return true;
    if (classification === 'MJ' || classification.includes('.MJ')) return true;

    // Check slug for women's race patterns
    // -we suffix (Women Elite)
    // -wu suffix (Women Under 23)
    // -wj suffix (Women Junior)
    // Common name patterns
    // Also matches patterns like -wj1, -we1, -wu1 (with number suffix for race type)
    if (/-(we|wu|wj|u23)(-|_|\/|$|\d)/.test(slug)) return true;
    if (slug.includes('-women') || slug.includes('-ladies') || slug.includes('-dames')) return true;

    // Check name for women indicators
    if (name.includes('women') || name.includes("women's")) return true;
    if (name.includes('ladies')) return true;
    if (name.includes('feminin') || name.includes('féminin')) return true;
    if (name.includes('dames')) return true;
    if (name.includes('vrouwen')) return true;
    if (name.includes('mj')) return true;
    if (name.includes('u23')) return true;

    return false;
  };

  

  // Filter out women's races
  const filteredRaces = races.filter(race => !isWomensOrYouthRace(race));

  // Group races by year and sort within each year
  const racesByYear = filteredRaces.reduce((acc, race) => {
    const year = race.year;
    if (!acc[year]) {
      acc[year] = [];
    }
    acc[year].push(race);
    return acc;
  }, {} as Record<number, Race[]>);

  // Sort races within each year: passed races first (most recent first), then upcoming races (soonest first)
  Object.keys(racesByYear).forEach((year) => {
    racesByYear[Number(year)].sort((a, b) => {
      const aPassed = isRacePassed(a);
      const bPassed = isRacePassed(b);

      // Both passed: most recent first (descending by date)
      if (aPassed && bPassed) {
        const aDate = new Date(a.endDate || a.startDate || 0);
        const bDate = new Date(b.endDate || b.startDate || 0);
        return bDate.getTime() - aDate.getTime();
      }

      // Only one passed: passed races come first
      if (aPassed && !bPassed) return -1;
      if (!aPassed && bPassed) return 1;

      // Both upcoming: soonest first (ascending by date)
      const aDate = new Date(a.startDate || a.endDate || 0);
      const bDate = new Date(b.startDate || b.endDate || 0);
      return aDate.getTime() - bDate.getTime();
    });
  });

  // Sort years in descending order
  const sortedYears = Object.keys(racesByYear)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Races Overzicht</h2>
            <p className="text-sm text-gray-600">
              {filteredRaces.length} race{filteredRaces.length !== 1 ? 's' : ''} available
            </p>
          </div>
          {races.length === 0 && (
            <Button
              className="px-4 py-2 bg-primary hover:bg-primary/90"
              text={initializing ? "Loading..." : "Initialize Existing Races"}
              onClick={confirmInitializeRaces}
              disabled={initializing}
            />
          )}
        </div>
      </div>

      {/* Races Grouped by Year */}
      {races.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-600 mb-4">No races found</p>
          <p className="text-sm text-gray-500">
            Click &quot;Initialize Existing Races&quot; to add current races,
            or go to &quot;Add Race&quot; to create a new race.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedYears.map((year) => (
            <div key={year} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              {/* Year header */}
              <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{year}</h3>
                  <p className="text-xs text-gray-500">
                    {racesByYear[year].length} race{racesByYear[year].length !== 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setRescrapeConfirmOpen(year);
                  }}
                  disabled={rescraping}
                  className="px-3 py-1.5 text-xs font-medium text-orange-700 bg-orange-100 hover:bg-orange-200 rounded-md transition-colors disabled:opacity-50"
                >
                  {rescraping && rescrapeConfirmOpen === year ? 'Rescraping...' : 'Rescrape Year'}
                </button>
              </div>

              {/* Races table for this year */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Class
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Slug
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Scraped
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {racesByYear[year].map((race) => {
                      const passed = isRacePassed(race);
                      return (
                      <tr
                        key={race.id}
                        onClick={() => fetchRaceData(race)}
                        className={`hover:bg-gray-50 cursor-pointer transition-colors ${passed ? 'bg-gray-50' : ''}`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className={`text-sm font-medium ${passed ? 'text-gray-400' : 'text-gray-900'}`}>{race.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className={`text-sm ${passed ? 'text-gray-400' : 'text-gray-600'}`}>
                            {race.startDate && race.endDate ? (
                              race.startDate === race.endDate ? (
                                formatDate(race.startDate)
                              ) : (
                                `${formatDate(race.startDate)} - ${formatDate(race.endDate)}`
                              )
                            ) : race.startDate ? (
                              formatDate(race.startDate)
                            ) : (
                              '-'
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            passed ? 'bg-gray-100 text-gray-400' :
                            race.classification?.includes('UWT') ? 'bg-yellow-100 text-yellow-800' :
                            race.classification?.includes('WWT') ? 'bg-pink-100 text-pink-800' :
                            race.classification?.includes('Pro') ? 'bg-blue-100 text-blue-800' :
                            race.classification === 'NC' ? 'bg-red-100 text-red-800' :
                            race.classification === 'CC' ? 'bg-purple-100 text-purple-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {race.classification || '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <code className={`text-xs bg-gray-100 px-2 py-1 rounded ${passed ? 'text-gray-400' : 'text-primary'}`}>
                            {race.slug}
                          </code>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {race.hasResults ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              ✓ {race.resultsCount || 1} {race.resultsCount === 1 ? 'result' : 'results'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                              -
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            passed ? 'bg-gray-200 text-gray-400' :
                            race.active !== false
                              ? 'bg-green-800 text-white'
                              : 'bg-gray-800 text-gray-800/80'
                          }`}>
                            {passed ? 'Finished' : race.active !== false ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Initialize Races Confirmation Dialog */}
      <ConfirmDialog
        open={initializeConfirmOpen}
        onClose={() => setInitializeConfirmOpen(false)}
        onConfirm={handleInitializeRaces}
        title="Initialize Existing Races"
        description="Weet je zeker dat je de bestaande races wilt initialiseren?"
        confirmText="Initialize"
        cancelText="Cancel"
        variant="primary"
      />

      {/* Save All Stages Confirmation Dialog */}
      <ConfirmDialog
        open={saveAllStagesConfirmOpen}
        onClose={() => setSaveAllStagesConfirmOpen(false)}
        onConfirm={handleSaveAllStages}
        title="Add All Stages"
        description={
          <>
            <p>Are you sure you want to add all 21 stages?</p>
            <p className="mt-2 text-sm text-gray-600">This can take a few minutes. Stages are saved one by one.</p>
          </>
        }
        confirmText="Add All Stages"
        cancelText="Cancel"
        variant="primary"
      />

      {/* Save Race Result Confirmation Dialog */}
      <ConfirmDialog
        open={saveRaceResultConfirmOpen}
        onClose={() => setSaveRaceResultConfirmOpen(false)}
        onConfirm={handleSaveRaceResult}
        title="Scrape Race Result"
        description={
          <>
            <p>Are you sure you want to scrape the race result from ProCyclingStats?</p>
            <p className="mt-2 text-sm text-gray-600">This will fetch the latest results and save them to the database.</p>
          </>
        }
        confirmText="Scrape Result"
        cancelText="Cancel"
        variant="primary"
      />

      {/* Rescrape Year Confirmation Dialog */}
      <ConfirmDialog
        open={rescrapeConfirmOpen !== null}
        onClose={() => setRescrapeConfirmOpen(null)}
        onConfirm={() => rescrapeConfirmOpen && handleRescrapeYear(rescrapeConfirmOpen)}
        title={`Rescrape All Races for ${rescrapeConfirmOpen}`}
        description={
          <>
            <p>This will:</p>
            <ul className="mt-2 text-sm text-gray-600 list-disc list-inside space-y-1">
              <li>Clear all season points for {rescrapeConfirmOpen}</li>
              <li>Re-scrape all finished races with results</li>
              <li>Recalculate all points using the new Pnt column</li>
            </ul>
            <p className="mt-3 text-sm text-orange-600 font-medium">This may take several minutes.</p>
          </>
        }
        confirmText={rescraping ? "Rescraping..." : "Rescrape Year"}
        cancelText="Cancel"
        variant="danger"
      />

      {/* Info Dialog for messages previously shown with alert() */}
      {infoDialog && (
        <ConfirmDialog
          open={true}
          onClose={() => setInfoDialog(null)}
          onConfirm={() => setInfoDialog(null)}
          title={infoDialog.title}
          description={infoDialog.description}
          confirmText="OK"
          cancelText="Close"
        />
      )}
    </div>
  );
}
