import { useState } from 'react';

interface ClassificationTabsProps {
  selectedStage: any;
}

export default function ClassificationTabs({ selectedStage }: ClassificationTabsProps) {
  const [activeTab, setActiveTab] = useState<'stage' | 'gc' | 'points' | 'mountains' | 'team'>('stage');
  const [showAllStageResults, setShowAllStageResults] = useState(false);
  const [showAllGC, setShowAllGC] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Tabs Navigation */}
      <div className="flex border-b border-gray-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('stage')}
          className={`px-6 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
            activeTab === 'stage'
              ? 'border-b-2 border-primary text-primary bg-gray-50'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          🚴 ({selectedStage.stageResults?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('gc')}
          className={`px-6 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
            activeTab === 'gc'
              ? 'border-b-2 border-primary text-primary bg-gray-50'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          🏆 Algemeen ({selectedStage.generalClassification?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('points')}
          className={`px-6 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
            activeTab === 'points'
              ? 'border-b-2 border-primary text-primary bg-gray-50'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          🟢 Punten ({selectedStage.pointsClassification?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('mountains')}
          className={`px-6 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
            activeTab === 'mountains'
              ? 'border-b-2 border-primary text-primary bg-gray-50'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          ⛰️ Bergen ({selectedStage.mountainsClassification?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('team')}
          className={`px-6 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
            activeTab === 'team'
              ? 'border-b-2 border-primary text-primary bg-gray-50'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          👥 Team ({selectedStage.teamClassification?.length || 0})
        </button>
      </div>

      {/* Tab Content */}
      <div>
        {/* Stage Results Tab */}
        {activeTab === 'stage' && selectedStage.stageResults?.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pos</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Foto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Renner</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Team</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tijd</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {selectedStage.stageResults.slice(0, showAllStageResults ? undefined : 20).map((result: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium w-8">{result.place || idx + 1}</td>
                    <td className="px-2 py-4 whitespace-nowrap w-20">
                      {result.jerseyImage && (
                        <img 
                          src={`https://www.procyclingstats.com/${result.jerseyImage}`} 
                          alt={result.name}
                          className="h-12 w-12 object-cover object-top rounded-full"
                        />
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{result.name || `${result.firstName || ''} ${result.lastName || ''}`.trim() || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{result.team || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{result.timeDifference && result.timeDifference !== '-' ? result.timeDifference : (result.place === 1 ? 'Winner' : '-')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {selectedStage.stageResults.length > 20 && (
              <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-center">
                <button
                  onClick={() => setShowAllStageResults(!showAllStageResults)}
                  className="text-sm text-primary hover:text-primary/90 font-medium"
                >
                  {showAllStageResults ? '← Show less' : `Show all ${selectedStage.stageResults.length} riders →`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* General Classification Tab */}
        {activeTab === 'gc' && selectedStage.generalClassification?.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pos</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Photo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rider</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Team</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {selectedStage.generalClassification.slice(0, showAllGC ? undefined : 20).map((result: any, idx: number) => {
                  const teamName = typeof result.team === 'string' ? result.team : result.team?.name || '-';
                  
                  return (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium w-8">{result.place || idx + 1}</td>
                      <td className="px-2 py-4 whitespace-nowrap w-20">
                        {result.jerseyImage && (
                          <img 
                            src={`https://www.procyclingstats.com/${result.jerseyImage}`} 
                            alt={result.name} 
                            className="h-12 w-12 object-cover object-top rounded-full"
                          />
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{result.name || `${result.firstName || ''} ${result.lastName || ''}`.trim() || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{teamName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {result.timeDifference && result.timeDifference.trim() !== '' && result.timeDifference !== '-' 
                          ? result.timeDifference 
                          : (result.place === 1 ? 'Leader' : result.gc || '-')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {selectedStage.generalClassification.length > 20 && (
              <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-center">
                <button
                  onClick={() => setShowAllGC(!showAllGC)}
                  className="text-sm text-primary hover:text-primary/90 font-medium"
                >
                  {showAllGC ? '← Show less' : `Show all ${selectedStage.generalClassification.length} riders →`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Points Classification Tab */}
        {activeTab === 'points' && selectedStage.pointsClassification?.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pos</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Photo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rider</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Team</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Points</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {selectedStage.pointsClassification.slice(0, 20).map((result: any, idx: number) => {
                  const teamName = typeof result.team === 'string' ? result.team : result.team?.name || '-';
                  
                  return (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium w-8">{result.place || idx + 1}</td>
                      <td className="px-2 py-4 whitespace-nowrap w-20">
                        {result.jerseyImage && (
                          <img 
                            src={`https://www.procyclingstats.com/${result.jerseyImage}`} 
                            alt={result.name} 
                            className="h-12 w-12 object-cover object-top rounded-full"
                          />
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{result.name || `${result.firstName || ''} ${result.lastName || ''}`.trim() || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{teamName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{result.pointsTotal} {result.points >= 0 && `(+${result.points})`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Mountains Classification Tab */}
        {activeTab === 'mountains' && selectedStage.mountainsClassification?.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pos</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Photo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rider</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Team</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Points</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {selectedStage.mountainsClassification.slice(0, 20).map((result: any, idx: number) => {
                  const teamName = typeof result.team === 'string' ? result.team : result.team?.name || '-';
                  
                  return (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium w-8">{result.place || idx + 1}</td>
                      <td className="px-2 py-4 whitespace-nowrap w-20">
                        {result.jerseyImage && (
                          <img 
                            src={`https://www.procyclingstats.com/${result.jerseyImage}`} 
                            alt={result.name} 
                            className="h-12 w-12 object-cover object-top rounded-full"
                          />
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{result.name || `${result.firstName || ''} ${result.lastName || ''}`.trim() || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{teamName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{result.pointsTotal} {result.points >= 0 && `(+${result.points})`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Team Classification Tab */}
        {activeTab === 'team' && selectedStage.teamClassification?.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pos</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Team</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {selectedStage.teamClassification.slice(0, 20).map((result: any, idx: number) => {
                  const formatTime = (seconds: number) => {
                    if (!seconds || seconds === 0) return '-';
                    const mins = Math.floor(seconds / 60);
                    const secs = seconds % 60;
                    return `${mins}:${secs.toString().padStart(2, '0')}`;
                  };

                  const displayTime = result.timeInSeconds 
                    ? formatTime(result.timeInSeconds)
                    : (result.time || result.timeDifference || '-');

                  return (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium w-8">{result.place || idx + 1}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{result.team || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{displayTime}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
