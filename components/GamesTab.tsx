'use client'

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "./Button";
import { EnrichedRider } from "@/lib/scraper";
import { Flag } from "@/components/Flag";
import ClassificationTabs from "./ClassificationTabs";
import { ChevronLeft, ChevronRight } from "tabler-icons-react";

interface Race {
  id: string;
  name: string;
  year: number;
  slug: string;
  description?: string;
  createdAt: string;
  active: boolean;
}

// Module-level cache that persists across component mounts
const raceDataCache = new Map<string, any>();
const stagesCache = new Map<string, any[]>();

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
  const [raceData, setRaceData] = useState<any[]>([]);
  const [loadingRaceData, setLoadingRaceData] = useState(false);
  const [editingRaceId, setEditingRaceId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState<string>('');
  const [showStages, setShowStages] = useState(false);
  const [stages, setStages] = useState<any[]>([]);
  const [loadingStages, setLoadingStages] = useState(false);
  const [savingStage, setSavingStage] = useState(false);
  const [stageNumber, setStageNumber] = useState<string>('');
  const [selectedStage, setSelectedStage] = useState<any | null>(null);
  const [manuallyDeselected, setManuallyDeselected] = useState(false);
  const [showAllStageResults, setShowAllStageResults] = useState(false);
  const [showAllGC, setShowAllGC] = useState(false);
  const [showAllPoints, setShowAllPoints] = useState(false);
  const [showAllMountains, setShowAllMountains] = useState(false);
  const [activeClassificationTab, setActiveClassificationTab] = useState<'stage' | 'gc' | 'points' | 'mountains' | 'youth' | 'team'>('stage');

  const fetchRaces = (async () => {

    console.log('userID', userId)

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
    } catch (error: any) {
      console.error('Error fetching races:', error);
      setError(error.message || 'Kon races niet laden');
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
    } else if (!raceSlug && races.length > 0 && !selectedRace && !manuallyDeselected) {
      // Auto-load most recent race (highest year) - only if not manually deselected
      const mostRecentRace = races.reduce((latest, current) =>
        current.year > latest.year ? current : latest
      );
      fetchRaceData(mostRecentRace, true); // true = update URL
    }
  }, [searchParams, races, manuallyDeselected, selectedRace]);

  const handleInitializeRaces = async () => {
    if (!user || !confirm('Weet je zeker dat je de bestaande races wilt initialiseren?')) return;

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

      alert('Races succesvol geïnitialiseerd!');
      fetchRaces();
    } catch (error: any) {
      console.error('Error initializing races:', error);
      alert(error.message || 'Er is iets misgegaan bij het initialiseren');
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
    } catch (error: any) {
      console.error('Error fetching race data:', error);
      alert(error.message || 'Kon race data niet laden');
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
    } catch (error: any) {
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
        throw new Error(errorData.error || 'Kon stage niet opslaan');
      }

      const data = await response.json();
      alert(`Stage ${stageNumber} succesvol opgeslagen met ${data.ridersCount} renners!`);
      setStageNumber('');
      fetchStages(selectedRace.slug);
    } catch (error: any) {
      console.error('Error saving stage:', error);
      alert(error.message || 'Er is iets misgegaan bij het opslaan');
    } finally {
      setSavingStage(false);
    }
  };

  const handleSaveAllStages = async () => {
    if (!user || !selectedRace) return;

    const totalStages = 21;
    const confirmed = confirm(`Weet je zeker dat je alle ${totalStages} etappes wilt toevoegen? Dit kan enkele minuten duren.`);
    
    if (!confirmed) return;

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
            console.log(`✓ Stage ${stage} opgeslagen`);
          } else {
            failedStages.push(stage);
            console.error(`✗ Stage ${stage} mislukt`);
          }
        } catch (error) {
          failedStages.push(stage);
          console.error(`✗ Stage ${stage} error:`, error);
        }

        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (failedStages.length === 0) {
        alert(`🎉 Alle ${totalStages} etappes succesvol opgeslagen!`);
      } else {
        alert(`✓ ${successCount} etappes opgeslagen\n✗ ${failedStages.length} mislukt: ${failedStages.join(', ')}`);
      }

      fetchStages(selectedRace.slug);
    } catch (error: any) {
      console.error('Error saving all stages:', error);
      alert(`Er is iets misgegaan. ${successCount} etappes zijn opgeslagen.`);
    } finally {
      setSavingStage(false);
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
        throw new Error(errorData.error || 'Kon beschrijving niet updaten');
      }

      // Update local state
      setRaces(races.map(race => 
        race.id === raceId 
          ? { ...race, description: editDescription }
          : race
      ));
      
      setEditingRaceId(null);
      setEditDescription('');
    } catch (error: any) {
      console.error('Error updating description:', error);
      alert(error.message || 'Er is iets misgegaan bij het updaten');
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
        <div className="text-gray-600">Races laden...</div>
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
              text="← Terug naar overzicht"
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
              text={`Etappes (${stages.length})`}
              selected={showStages}
              onClick={() => setShowStages(true)}
            />
            <Button
              className="px-4 py-2 bg-primary hover:bg-primary/90 ml-auto"
              text={loadingRaceData ? "🔄 Laden..." : "🔄 Vernieuwen"}
              onClick={() => fetchRaceData(selectedRace, false, true)}
              disabled={loadingRaceData}
            />
          </div>
        </div>

        {/* Stages View */}
        {showStages ? (
          selectedStage ? (
            /* Stage Detail View */
            <div className="space-y-4">
              {/* Back Button */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <Button
                  className="px-4 py-2 "
                  text="← Terug naar etappes"
                  onClick={() => setSelectedStage(null)}
                />
              </div>

              {/* Stage Header */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h2 className="text-2xl font-semibold">Etappe {selectedStage.stage}</h2>
                <div className="flex gap-2">

                  <Button
                    className="px-4 py-2"
                    text={<div className="flex flex-row items-center"><ChevronLeft size={16} /> Vorige etappe</div>}
                    disabled={selectedStage.stage === 1}
                    onClick={() => setSelectedStage(stages.find(stage => stage.stage === selectedStage.stage - 1))}
                  />
                  <Button
                    className="px-4 py-2"
                    text={<div className="flex flex-row items-center">Volgende etappe <ChevronRight size={16} /></div>}
                    disabled={selectedStage.stage === stages.length}
                    onClick={() => setSelectedStage(stages.find(stage => stage.stage === selectedStage.stage + 1))}
                  />
                  
                  </div>
                <p className="text-sm text-gray-600 mt-1">
                  Opgeslagen op: {new Date(selectedStage.scrapedAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              {/* Classification Tabs */}
              <ClassificationTabs selectedStage={selectedStage} />
            </div>
          ) : (
            /* Stages List View */
            <div className="space-y-4">
              {/* Add Stage Form */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-3">Etappe Toevoegen</h3>
                <div className="space-y-3">
                  {/* Single stage */}
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={stageNumber}
                      onChange={(e) => setStageNumber(e.target.value)}
                      placeholder="Etappe nummer (bijv. 1)"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <Button
                      className="px-6 py-2 bg-primary hover:bg-primary/90"
                      text={savingStage ? "Bezig..." : "Opslaan"}
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
                      <span className="px-2 bg-white text-gray-500">of</span>
                    </div>
                  </div>

                  {/* All stages */}
                  <div className="flex items-center gap-2">
                    <Button
                      className="flex-1 px-6 py-2 bg-green-600 hover:bg-green-700 text-white"
                      text={savingStage ? "Bezig met alle etappes..." : "📦 Voeg alle 21 etappes toe"}
                      onClick={handleSaveAllStages}
                      disabled={savingStage}
                    />
                  </div>
                  <p className="text-xs text-gray-500 text-center">
                    Dit kan enkele minuten duren. Etappes worden één voor één opgeslagen.
                  </p>
                </div>
              </div>

              {/* Stages List */}
              {loadingStages ? (
                <div className="flex items-center justify-center p-8 bg-white border border-gray-200 rounded-lg">
                  <div className="text-gray-600">Etappes laden...</div>
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
                        <h4 className="text-lg font-semibold">Etappe {stage.stage}</h4>
                        <span className="text-xs text-gray-500">
                          {new Date(stage.scrapedAt).toLocaleDateString('nl-NL')}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p>🚴 {stage.stageResults?.length || 0} renners</p>
                        {stage.generalClassification?.length > 0 && (
                          <p>🏆 GC Leider: {stage.generalClassification[0]?.name || stage.generalClassification[0]?.firstName + ' ' + stage.generalClassification[0]?.lastName || 'Onbekend'} ({stage.generalClassification[0]?.timeDifference && stage.generalClassification[0]?.timeDifference !== '-' ? stage.generalClassification[0]?.timeDifference : 'Leider'})</p>
                        )}
                        {stage.pointsClassification?.length > 0 && (
                          <p>🟢 Punten Leider: {stage.pointsClassification[0]?.name || stage.pointsClassification[0]?.firstName + ' ' + stage.pointsClassification[0]?.lastName || 'Onbekend'} ({stage.pointsClassification[0]?.pointsTotal || stage.pointsClassification[0]?.points || '-'} ptn)</p>
                        )}
                        {stage.mountainsClassification?.length > 0 && (
                          <p>⛰️ Bergen Leider: {stage.mountainsClassification[0]?.name || stage.mountainsClassification[0]?.firstName + ' ' + stage.mountainsClassification[0]?.lastName || 'Onbekend'} ({stage.mountainsClassification[0]?.pointsTotal || stage.mountainsClassification[0]?.points || '-'} ptn)</p>
                        )}
                      </div>
                      <div className="mt-3 text-xs text-primary font-medium">
                        Klik voor details →
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
                <div className="text-gray-600">Race data laden...</div>
              </div>
            ) : raceData.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
                <p className="text-gray-600">Geen data gevonden in deze race collectie</p>
              </div>
            ) : (() => {
          // Group riders by team
          const ridersByTeam = raceData.reduce((acc, doc) => {
            const rider = doc.rider || {};
            const teamName = typeof rider.team === 'string' ? rider.team : rider.team?.name || 'Geen team';
            if (!acc[teamName]) {
              acc[teamName] = [];
            }
            acc[teamName].push(doc);
            return acc;
          }, {} as Record<string, any[]>);

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
                            {teamRiders.length} renner{teamRiders.length !== 1 ? 's' : ''}
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
                              Foto
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Naam
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Land
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Rang
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Punten
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {teamRiders.map((doc: any, index: number) => {
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
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                      Actief
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
      </div>
    );
  }

  // Group races by year
  const racesByYear = races.reduce((acc, race) => {
    const year = race.year;
    if (!acc[year]) {
      acc[year] = [];
    }
    acc[year].push(race);
    return acc;
  }, {} as Record<number, Race[]>);

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
              {races.length} race{races.length !== 1 ? 's' : ''} beschikbaar
            </p>
          </div>
          {races.length === 0 && (
            <Button
              className="px-4 py-2 bg-primary hover:bg-primary/90"
              text={initializing ? "Bezig..." : "Initialiseer Bestaande Races"}
              onClick={handleInitializeRaces}
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
            Click "Initialize Existing Races" to add current races,
            or go to "Add Race" to create a new race.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedYears.map((year) => (
            <div key={year} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              {/* Year header */}
              <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">{year}</h3>
                <p className="text-xs text-gray-500">
                  {racesByYear[year].length} race{racesByYear[year].length !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Races table for this year */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Naam
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Beschrijving
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Slug
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Aangemaakt
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {racesByYear[year].map((race) => (
                      <tr
                        key={race.id}
                        onClick={() => fetchRaceData(race)}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{race.name}</div>
                        </td>
                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                          {editingRaceId === race.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary"
                                placeholder="Beschrijving..."
                                autoFocus
                              />
                              <button
                                onClick={(e) => handleSaveDescription(race.id, e)}
                                className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                              >
                                ✓
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div 
                              className="text-sm text-gray-600 cursor-pointer hover:text-primary flex items-center gap-2"
                              onClick={(e) => handleEditDescription(race, e)}
                            >
                              <span>{race.description || '-'}</span>
                              <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded text-primary">
                            {race.slug}
                          </code>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            race.active 
                              ? 'bg-green-100 text-white' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {race.active ? 'Actief' : 'Inactief'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-600">
                            {formatDate(race.createdAt)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
