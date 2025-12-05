'use client'

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface StagePoint {
  date: Date;
  stage: number;
  raceSlug: string;
  raceName: string;
  points: number;
  breakdown: {
    stageResult?: number;
    gcPoints?: number;
    pointsClass?: number;
    mountainsClass?: number;
    youthClass?: number;
    mountainPoints?: number;
    sprintPoints?: number;
    combativityBonus?: number;
    teamPoints?: number;
  };
}

interface DayData {
  date: Date;
  dateString: string;
  stages: StagePoint[];
}

interface RiderPointsData {
  riderId: string;
  riderName: string;
  riderTeam: string;
  riderCountry: string;
  jerseyImage?: string;
  totalPoints: number;
  pointsByDate: StagePoint[];
  pointsByDay: DayData[];
}

// Test data generator
function generateTestData(): RiderPointsData[] {
  const riders = [
    { name: 'Tadej Pogačar', team: 'UAE Team Emirates', country: 'Slovenia' },
    { name: 'Jonas Vingegaard', team: 'Visma-Lease a Bike', country: 'Denmark' },
    { name: 'Primož Roglič', team: 'Bora-Hansgrohe', country: 'Slovenia' },
    { name: 'Remco Evenepoel', team: 'Soudal Quick-Step', country: 'Belgium' },
    { name: 'Wout van Aert', team: 'Visma-Lease a Bike', country: 'Belgium' },
    { name: 'Mathieu van der Poel', team: 'Alpecin-Deceuninck', country: 'Netherlands' },
    { name: 'Jasper Philipsen', team: 'Alpecin-Deceuninck', country: 'Belgium' },
    { name: 'Egan Bernal', team: 'Ineos Grenadiers', country: 'Colombia' },
  ];

  const races = [
    { name: 'Tour De France', slug: 'tour-de-france_2025', stages: 21 },
    { name: 'Giro D Italia', slug: 'giro-d-italia_2025', stages: 21 },
  ];

  const startDate = new Date('2025-06-01');

  return riders.map((rider, riderIdx) => {
    const pointsByDate: StagePoint[] = [];
    let totalPoints = 0;

    // Generate points for multiple races
    races.forEach((race, raceIdx) => {
      const raceStartDate = new Date(startDate);
      raceStartDate.setDate(raceStartDate.getDate() + (raceIdx * 30)); // Races 30 days apart

      for (let stage = 1; stage <= Math.min(race.stages, 10); stage++) {
        const stageDate = new Date(raceStartDate);
        stageDate.setDate(stageDate.getDate() + stage - 1);

        // Random points based on rider's "strength"
        const basePoints = Math.max(0, 50 - (riderIdx * 5) + Math.random() * 30);
        const stageResult = Math.floor(basePoints);
        const gcPoints = stage > 3 ? Math.floor(basePoints * 0.8) : 0;
        const pointsClass = Math.random() > 0.7 ? Math.floor(Math.random() * 20) : 0;
        const mountainsClass = Math.random() > 0.8 ? Math.floor(Math.random() * 15) : 0;
        
        const stageTotal = stageResult + gcPoints + pointsClass + mountainsClass;
        totalPoints += stageTotal;

        pointsByDate.push({
          date: stageDate,
          stage,
          raceSlug: race.slug,
          raceName: race.name,
          points: stageTotal,
          breakdown: {
            stageResult,
            gcPoints,
            pointsClass: pointsClass || undefined,
            mountainsClass: mountainsClass || undefined,
          },
        });
      }
    });

    // Sort by date
    pointsByDate.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Group by day
    const dayMap = new Map<string, DayData>();
    pointsByDate.forEach((point) => {
      const dateString = point.date.toISOString().split('T')[0];
      if (!dayMap.has(dateString)) {
        dayMap.set(dateString, {
          date: point.date,
          dateString,
          stages: [],
        });
      }
      dayMap.get(dateString)!.stages.push(point);
    });

    const pointsByDay = Array.from(dayMap.values()).sort((a, b) => 
      a.date.getTime() - b.date.getTime()
    );

    return {
      riderId: `rider-${riderIdx}`,
      riderName: rider.name,
      riderTeam: rider.team,
      riderCountry: rider.country,
      totalPoints,
      pointsByDate,
      pointsByDay,
    };
  });
}

export default function RiderPointsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [riders, setRiders] = useState<RiderPointsData[]>([]);
  const [selectedRider, setSelectedRider] = useState<RiderPointsData | null>(null);
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [allDays, setAllDays] = useState<DayData[]>([]);

  useEffect(() => {
    if (user) {
      fetchRiderPoints();
    }
  }, [user]);

  const fetchRiderPoints = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // TEST DATA - Remove this section when real data is available
      const USE_TEST_DATA = true; // Set to false to use real API
      
      if (USE_TEST_DATA) {
        // Generate test data
        const testRiders = generateTestData();
        setRiders(testRiders);
        
        // Create unified timeline
        const allDaysMap = new Map<string, DayData>();
        testRiders.forEach((rider: RiderPointsData) => {
          rider.pointsByDay.forEach((day) => {
            if (!allDaysMap.has(day.dateString)) {
              allDaysMap.set(day.dateString, {
                date: day.date,
                dateString: day.dateString,
                stages: [],
              });
            }
            day.stages.forEach((stage) => {
              const existingStages = allDaysMap.get(day.dateString)!.stages;
              if (!existingStages.some(s => s.raceSlug === stage.raceSlug && s.stage === stage.stage)) {
                existingStages.push(stage);
              }
            });
          });
        });
        
        const sortedDays = Array.from(allDaysMap.values()).sort((a, b) => 
          a.date.getTime() - b.date.getTime()
        );
        setAllDays(sortedDays);
        
        // Start at the latest date (last day)
        if (sortedDays.length > 0) {
          setCurrentDayIndex(sortedDays.length - 1);
        }
        
        setLoading(false);
        return;
      }
      // END TEST DATA
      
      const response = await fetch(`/api/getRiderPointsTimeline?userId=${user.uid}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch rider points');
      }

      const data = await response.json();
      
      // Convert date strings back to Date objects and group by day
      const ridersWithDates = data.riders.map((rider: any) => {
        const pointsByDate = rider.pointsByDate.map((p: any) => ({
          ...p,
          date: new Date(p.date),
        }));

        // Group stages by day
        const dayMap = new Map<string, DayData>();
        pointsByDate.forEach((point: StagePoint) => {
          const dateString = point.date.toISOString().split('T')[0];
          if (!dayMap.has(dateString)) {
            dayMap.set(dateString, {
              date: point.date,
              dateString,
              stages: [],
            });
          }
          dayMap.get(dateString)!.stages.push(point);
        });

        const pointsByDay = Array.from(dayMap.values()).sort((a, b) => 
          a.date.getTime() - b.date.getTime()
        );

        return {
          ...rider,
          pointsByDate,
          pointsByDay,
        };
      });

      setRiders(ridersWithDates);

      // Create a unified timeline of all days across all riders
      const allDaysMap = new Map<string, DayData>();
      ridersWithDates.forEach((rider: RiderPointsData) => {
        rider.pointsByDay.forEach((day) => {
          if (!allDaysMap.has(day.dateString)) {
            allDaysMap.set(day.dateString, {
              date: day.date,
              dateString: day.dateString,
              stages: [],
            });
          }
          // Collect all unique races for this day
          day.stages.forEach((stage) => {
            const existingStages = allDaysMap.get(day.dateString)!.stages;
            if (!existingStages.some(s => s.raceSlug === stage.raceSlug && s.stage === stage.stage)) {
              existingStages.push(stage);
            }
          });
        });
      });

      const sortedDays = Array.from(allDaysMap.values()).sort((a, b) => 
        a.date.getTime() - b.date.getTime()
      );
      setAllDays(sortedDays);
      
      // Start at the latest date (last day)
      if (sortedDays.length > 0) {
        setCurrentDayIndex(sortedDays.length - 1);
      }
    } catch (error) {
      console.error('Error fetching rider points:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPointsUpToDay = (rider: RiderPointsData, dayIndex: number): number => {
    if (!rider.pointsByDay.length || dayIndex < 0) return 0;
    
    const targetDate = allDays[dayIndex]?.date;
    if (!targetDate) return 0;
    
    return rider.pointsByDate
      .filter(p => p.date <= targetDate)
      .reduce((sum, p) => sum + p.points, 0);
  };

  const filteredRiders = riders.filter(rider =>
    rider.riderName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rider.riderTeam.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedRiders = selectedRider
    ? [selectedRider]
    : [...filteredRiders].sort((a, b) => {
        const aPoints = getPointsUpToDay(a, currentDayIndex);
        const bPoints = getPointsUpToDay(b, currentDayIndex);
        return bPoints - aPoints;
      });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading rider points...</div>
      </div>
    );
  }

  const maxDayIndex = allDays.length - 1;
  const currentDay = allDays[currentDayIndex];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Rider Points Timeline</h1>
          <p className="text-gray-600">
            View how riders have accumulated points over time
          </p>
        </div>

        {/* Search */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <input
            type="text"
            placeholder="Search by name or team..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {selectedRider && (
            <button
              onClick={() => setSelectedRider(null)}
              className="mt-2 text-sm text-primary hover:underline"
            >
              ← Back to all riders
            </button>
          )}
        </div>

        {/* Date Range Slider */}
        {maxDayIndex > 0 && currentDay && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Timeline</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-600 min-w-[200px]">
                  <div className="font-semibold">
                    {currentDay.date.toLocaleDateString('nl-NL', { 
                      day: 'numeric', 
                      month: 'long', 
                      year: 'numeric' 
                    })}
                  </div>
                  <div className="text-xs text-gray-500">
                    Day {currentDayIndex + 1} / {maxDayIndex + 1}
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max={maxDayIndex}
                  value={currentDayIndex}
                  onChange={(e) => setCurrentDayIndex(parseInt(e.target.value))}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(currentDayIndex / maxDayIndex) * 100}%, #e5e7eb ${(currentDayIndex / maxDayIndex) * 100}%, #e5e7eb 100%)`
                  }}
                />
              </div>
              
              {/* Show races active on this day */}
              <div className="pt-2 border-t border-gray-200">
                <div className="text-xs font-medium text-gray-500 mb-2">Races on this day:</div>
                <div className="flex flex-wrap gap-2">
                  {Array.from(new Set(currentDay.stages.map(s => s.raceName))).map((raceName, idx) => {
                    const raceStages = currentDay.stages.filter(s => s.raceName === raceName);
                    return (
                      <div key={idx} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                        <span>{raceName}</span>
                        <span className="text-blue-500">•</span>
                        <span>Stage {raceStages.map(s => s.stage).join(', ')}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div className="flex justify-between text-xs text-gray-500">
                <span>{allDays[0]?.date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</span>
                <span>{allDays[maxDayIndex]?.date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</span>
              </div>
            </div>
          </div>
        )}

        {/* Riders List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rider
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Team
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Points (up to {currentDay?.date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })})
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Points
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedRiders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      No riders found
                    </td>
                  </tr>
                ) : (
                  sortedRiders.map((rider, index) => {
                    const pointsUpToDay = getPointsUpToDay(rider, currentDayIndex);
                    const targetDate = allDays[currentDayIndex]?.date;
                    const stagesCount = targetDate 
                      ? rider.pointsByDate.filter(p => p.date <= targetDate).length 
                      : 0;
                    
                    return (
                      <tr key={rider.riderId} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          #{index + 1}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {rider.jerseyImage && (
                              <img
                                src={`https://www.procyclingstats.com/${rider.jerseyImage}`}
                                alt={rider.riderName}
                                className="h-10 w-10 rounded-full object-cover object-top mr-3"
                              />
                            )}
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {rider.riderName}
                              </div>
                              <div className="text-xs text-gray-500">
                                {rider.riderCountry}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {rider.riderTeam}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-gray-900">
                            {pointsUpToDay} pts
                          </div>
                          <div className="text-xs text-gray-500">
                            {stagesCount} stages
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {rider.totalPoints} pts
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => setSelectedRider(selectedRider?.riderId === rider.riderId ? null : rider)}
                            className="text-primary hover:text-primary/80 font-medium"
                          >
                            {selectedRider?.riderId === rider.riderId ? 'Hide' : 'Details'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Rider Details */}
        {selectedRider && (
          <div className="mt-6 space-y-6">
            {/* Cumulative Points Chart */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold mb-4">
                Points Progress - {selectedRider.riderName}
              </h2>
              
              <div className="relative h-64 mb-4 ml-12">
                <svg className="w-full h-full" viewBox="0 0 800 200" preserveAspectRatio="none">
                  {/* Grid lines */}
                  {[0, 25, 50, 75, 100].map((percent) => (
                    <line
                      key={percent}
                      x1="0"
                      y1={200 - (percent * 2)}
                      x2="800"
                      y2={200 - (percent * 2)}
                      stroke="#e5e7eb"
                      strokeWidth="1"
                    />
                  ))}
                  
                  {/* Points line */}
                  {selectedRider.pointsByDay.slice(0, currentDayIndex + 1).length > 1 && (
                    <polyline
                      points={selectedRider.pointsByDay
                        .slice(0, currentDayIndex + 1)
                        .map((day, idx) => {
                          const x = (idx / Math.max(selectedRider.pointsByDay.length - 1, 1)) * 800;
                          const cumulativePoints = selectedRider.pointsByDate
                            .filter(p => p.date <= day.date)
                            .reduce((sum, point) => sum + point.points, 0);
                          const maxPoints = selectedRider.totalPoints;
                          const y = 200 - (cumulativePoints / maxPoints) * 200;
                          return `${x},${y}`;
                        })
                        .join(' ')}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="3"
                    />
                  )}
                  
                  {/* Points dots */}
                  {selectedRider.pointsByDay.slice(0, currentDayIndex + 1).map((day, idx) => {
                    const x = (idx / Math.max(selectedRider.pointsByDay.length - 1, 1)) * 800;
                    const cumulativePoints = selectedRider.pointsByDate
                      .filter(p => p.date <= day.date)
                      .reduce((sum, point) => sum + point.points, 0);
                    const maxPoints = selectedRider.totalPoints;
                    const y = 200 - (cumulativePoints / maxPoints) * 200;
                    
                    return (
                      <circle
                        key={idx}
                        cx={x}
                        cy={y}
                        r="4"
                        fill="#3b82f6"
                        className="hover:r-6 cursor-pointer"
                      >
                        <title>{`${day.date.toLocaleDateString('nl-NL')}: ${cumulativePoints} pts`}</title>
                      </circle>
                    );
                  })}
                </svg>
                
                {/* Y-axis labels */}
                <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500 -ml-12">
                  <span>{selectedRider.totalPoints}</span>
                  <span>{Math.round(selectedRider.totalPoints * 0.75)}</span>
                  <span>{Math.round(selectedRider.totalPoints * 0.5)}</span>
                  <span>{Math.round(selectedRider.totalPoints * 0.25)}</span>
                  <span>0</span>
                </div>
              </div>
              
              <div className="text-center text-sm text-gray-600">
                Cumulative points over {selectedRider.pointsByDay.slice(0, currentDayIndex + 1).length} days
              </div>
            </div>

            {/* Points Breakdown */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold mb-4">
                Points Breakdown
              </h2>
              
              <div className="space-y-3">
                {selectedRider.pointsByDate
                  .filter(p => currentDay && p.date <= currentDay.date)
                  .map((pointData, idx) => (
                  <div
                    key={idx}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {pointData.raceName} - Stage {pointData.stage}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {pointData.date.toLocaleDateString('nl-NL')}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-primary">
                          +{pointData.points} pts
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                      {pointData.breakdown.stageResult && (
                        <div className="text-gray-600">
                          🏁 Stage: <span className="font-medium">{pointData.breakdown.stageResult}</span>
                        </div>
                      )}
                      {pointData.breakdown.gcPoints && (
                        <div className="text-gray-600">
                          👑 GC: <span className="font-medium">{pointData.breakdown.gcPoints}</span>
                        </div>
                      )}
                      {pointData.breakdown.pointsClass && (
                        <div className="text-gray-600">
                          🟢 Points: <span className="font-medium">{pointData.breakdown.pointsClass}</span>
                        </div>
                      )}
                      {pointData.breakdown.mountainsClass && (
                        <div className="text-gray-600">
                          ⛰️ Mountains: <span className="font-medium">{pointData.breakdown.mountainsClass}</span>
                        </div>
                      )}
                      {pointData.breakdown.youthClass && (
                        <div className="text-gray-600">
                          👶 Youth: <span className="font-medium">{pointData.breakdown.youthClass}</span>
                        </div>
                      )}
                      {pointData.breakdown.teamPoints && (
                        <div className="text-gray-600">
                          👥 Team: <span className="font-medium">{pointData.breakdown.teamPoints}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">
                    Total points up to {currentDay?.date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}:
                  </span>
                  <span className="text-2xl font-bold text-primary">
                    {getPointsUpToDay(selectedRider, currentDayIndex)} pts
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
