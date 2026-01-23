'use client';

import { useState, useEffect } from 'react';
import ScraperForm from '@/components/ScraperForm';
import { type ScraperFormData } from '@/lib/types/admin';
import { ScrapingResult, BulkJob } from '@/lib/types/pages';
import { useAuth } from '@/hooks/useAuth';
import { formatTimestamp } from '@/lib/utils/timestamp';

export default function ScraperPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScrapingResult | null>(null);
  const [bulkJob, setBulkJob] = useState<BulkJob | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [preview, setPreview] = useState<any | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
const { user } = useAuth();

  // Poll for bulk job progress
  useEffect(() => {
    if (!jobId) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/scraper/bulk?jobId=${jobId}`);
        const jobData = await response.json();
        
        setBulkJob(jobData);
        
        if (jobData.status === 'completed' || jobData.status === 'failed') {
          clearInterval(pollInterval);
          setLoading(false);
          
          // Convert to result format for display
          const results = jobData.results || [];
          const errors = jobData.errors || [];
          
          setResult({
            success: jobData.status === 'completed',
            message: `All stages completed. ${results.filter((r: any) => r.success).length || 0} successful, ${errors.length || 0} failed.`, // eslint-disable-line @typescript-eslint/no-explicit-any
            type: 'all-stages',
            totalStages: jobData.totalStages,
            successfulStages: results.filter((r: any) => r.success).length || 0, // eslint-disable-line @typescript-eslint/no-explicit-any
            failedStages: errors.length || 0,
            totalDataCount: results.reduce((sum: number, r: any) => sum + (r.dataCount || 0), 0) || 0, // eslint-disable-line @typescript-eslint/no-explicit-any
            results: results,
          });
        }
      } catch (error) {
        console.error('Error polling job status:', error);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [jobId]);

  // Preview points function
  const handlePreviewPoints = async (formData: ScraperFormData) => {
    console.log('[PREVIEW] Starting preview with data:', formData);
    
    if (formData.type !== 'stage' || formData.stage === undefined) {
      alert('Points preview is only available for single stage results');
      return;
    }

    setLoadingPreview(true);
    setPreview(null);

    try {
      console.log('[PREVIEW] Fetching preview for:', {
        raceSlug: formData.race,
        stage: formData.stage,
        year: formData.year,
      });

      // Ensure all required fields are present and properly typed
      const requestData = {
        raceSlug: formData.race,
        stage: Number(formData.stage),
        year: Number(formData.year),
      };
      
      console.log('[PREVIEW] Sending request data:', requestData);

      const response = await fetch('/api/games/preview-points', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      console.log('[PREVIEW] Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[PREVIEW] Response error:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('[PREVIEW] Response data:', data);
      setPreview(data);
    } catch (error) {
      console.error('[PREVIEW] Error:', error);
      setPreview({
        success: false,
        error: error instanceof Error ? error.message : 'Network error occurred',
      });
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleScrape = async (formData: ScraperFormData) => {
    setLoading(true);
    setResult(null);
    setBulkJob(null);
    setJobId(null);

    // Add user data for logging purposes
    const requestData = {
      ...formData,
      userId: user?.uid,
      userEmail: user?.email,
      userName: user?.displayName,
    };

    try {
      if (formData.type === 'all-stages') {
        // Determine number of stages based on race
        let totalStages = 21; // default for grand tours
        if (formData.race === 'tour-down-under') {
          totalStages = 6; // Tour Down Under has 6 stages
        } else if (formData.race === 'paris-nice') {
          totalStages = 8;
        } else if (formData.race === 'tirreno-adriatico') {
          totalStages = 8;
        } else if (formData.race === 'volta-a-catalunya') {
          totalStages = 7;
        } else if (formData.race === 'dauphine') {
          totalStages = 8;
        } else if (formData.race === 'vuelta-al-tachira') {
          totalStages = 10; // Vuelta al Táchira has 10 stages
        }

        // Use bulk scraping API for all stages
        const response = await fetch('/api/scraper/bulk', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            race: formData.race,
            year: formData.year,
            totalStages,
            userId: user?.uid,
            userEmail: user?.email,
            userName: user?.displayName,
          }),
        });

        const data = await response.json();
        if (data.success) {
          setJobId(data.jobId);
          // Loading will be handled by polling
        } else {
          setResult(data);
          setLoading(false);
        }
      } else {
        // Use regular API for single operations
        const response = await fetch('/api/scraper', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData),
        });

        const data = await response.json();
        setResult(data);
        setLoading(false);
      }

    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Network error occurred',
      });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Cycling Data Scraper
          </h1>
          <p className="text-lg text-gray-600">
            Scrape cycling race data and save it to the database
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Scraper Form */}
          <div>
            <ScraperForm onSubmit={handleScrape} onPreview={handlePreviewPoints} loading={loading || loadingPreview} />
          </div>

          {/* Results Panel */}
          <div>
            {loadingPreview && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                <div className="flex items-center space-x-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                  <div>
                    <h3 className="text-lg font-medium text-purple-900">
                      Calculating Points Preview...
                    </h3>
                    <p className="text-purple-700">
                      Please wait while we calculate who will get how many points.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {preview && !loadingPreview && (
              <div
                className={`border rounded-lg p-6 ${
                  preview.success
                    ? 'bg-purple-50 border-purple-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div
                    className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                      preview.success ? 'bg-purple-500' : 'bg-red-500'
                    }`}
                  >
                    {preview.success ? '👁' : '!'}
                  </div>
                  <div className="flex-1">
                    <h3
                      className={`text-lg font-medium ${
                        preview.success ? 'text-purple-900' : 'text-red-900'
                      }`}
                    >
                      {preview.success ? 'Points Preview' : 'Error'}
                    </h3>
                    
                    {preview.success ? (
                      <div className={`mt-1 text-purple-700`}>
                        <p className="mb-2">{preview.message}</p>
                        
                        <div className="space-y-2">
                          <div className="text-sm">
                            <strong>Stage:</strong> {preview.stageInfo?.raceSlug} {preview.stageInfo?.stage} ({preview.stageInfo?.year})
                          </div>
                          <div className="text-sm">
                            <strong>Games with points:</strong> {preview.stageInfo?.totalGamesWithPoints || 0}
                          </div>
                          
                          {/* Preview results per game */}
                          {preview.preview && preview.preview.length > 0 && (
                            <div className="mt-3">
                              <details className="text-sm">
                                <summary className="cursor-pointer font-medium mb-2">
                                  View Points Details ({preview.preview.length} games)
                                </summary>
                                <div className="max-h-64 overflow-y-auto space-y-3">
                                  {preview.preview.map((game: any) => (
                                    <div key={game.gameId} className="bg-white p-3 rounded border">
                                      <div className="font-medium text-gray-900 mb-2">{game.gameName}</div>
                                      <div className="space-y-2">
                                        {game.participants.map((participant: any, pIndex: number) => (
                                          <div key={pIndex} className="border-b pb-2 last:border-b-0">
                                            <div className="font-medium text-xs text-gray-700 mb-1">
                                              {participant.playerName} (total: +{participant.totalPoints} pts)
                                            </div>
                                            <div className="space-y-1">
                                              {participant.riders.slice(0, 3).map((rider: any, rIndex: number) => (
                                                <div key={rIndex} className="flex justify-between text-xs text-gray-600">
                                                  <span>{rider.riderName} (place {rider.place})</span>
                                                  <span className="font-medium">+{rider.stagePoints} pts</span>
                                                </div>
                                              ))}
                                              {participant.riders.length > 3 && (
                                                <div className="text-xs text-gray-500 italic">
                                                  ...and {participant.riders.length - 3} more riders
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </details>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-1 text-red-700">
                        {preview.error || 'An unknown error occurred'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {loading && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <div>
                      <h3 className="text-lg font-medium text-blue-900">
                        {bulkJob ? 'Scraping All Stages...' : 'Scraping Data...'}
                      </h3>
                      <p className="text-blue-700">
                        {bulkJob 
                          ? `Processing stage ${bulkJob.progress.current} of ${bulkJob.progress.total}`
                          : 'Please wait while we fetch and process the cycling data.'
                        }
                      </p>
                    </div>
                  </div>
                  
                  {bulkJob && (
                    <div className="space-y-2">
                      {/* Progress Bar */}
                      <div className="w-full bg-blue-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${bulkJob.progress.percentage}%` }}
                        ></div>
                      </div>
                      
                      {/* Progress Stats */}
                      <div className="flex justify-between text-sm text-blue-700">
                        <span>{bulkJob.progress.percentage}% complete</span>
                        <span>
                          {(bulkJob.results || []).filter(r => r.success).length} successful, {' '}
                          {(bulkJob.errors || []).length} failed
                        </span>
                      </div>
                      
                      {/* Recent Results */}
                      {(bulkJob.results || []).length > 0 && (
                        <div className="mt-3 max-h-32 overflow-y-auto">
                          <div className="text-xs text-blue-600 mb-1">Recent stages:</div>
                          {(bulkJob.results || []).slice(-5).map((stageResult) => (
                            <div 
                              key={stageResult.stage} 
                              className={`text-xs px-2 py-1 rounded mb-1 ${
                                stageResult.success 
                                  ? 'bg-green-100 text-green-700' 
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              Stage {stageResult.stage}: {stageResult.success 
                                ? `${stageResult.dataCount || 0} riders` 
                                : stageResult.error
                              }
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {result && !loading && (
              <div
                className={`border rounded-lg p-6 ${
                  result.success
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div
                    className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                      result.success ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  >
                    {result.success ? '✓' : '!'}
                  </div>
                  <div className="flex-1">
                    <h3
                      className={`text-lg font-medium ${
                        result.success ? 'text-green-900' : 'text-red-900'
                      }`}
                    >
                      {result.success ? 'Success!' : 'Error'}
                    </h3>
                    
                    {result.success ? (
                      <div className={`mt-1 text-green-700`}>
                        <p className="mb-2">{result.message}</p>
                        
                        {/* Single scrape results */}
                        {result.dataCount && !result.type && (
                          <p className="text-sm">
                            <strong>Data Count:</strong> {result.dataCount} items processed
                          </p>
                        )}
                        
                        {/* All-stages results */}
                        {result.type === 'all-stages' && (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <strong>Total Stages:</strong> {result.totalStages}
                              </div>
                              <div>
                                <strong>Successful:</strong> {result.successfulStages}
                              </div>
                              <div>
                                <strong>Failed:</strong> {result.failedStages}
                              </div>
                              <div>
                                <strong>Total Data:</strong> {result.totalDataCount} riders
                              </div>
                            </div>
                            
                            {/* Stage results summary */}
                            {result.results && result.results.length > 0 && (
                              <div className="mt-3">
                                <details className="text-sm">
                                  <summary className="cursor-pointer font-medium mb-2">
                                    View Stage Details ({result.results.length} stages)
                                  </summary>
                                  <div className="max-h-48 overflow-y-auto space-y-1">
                                    {result.results.map((stageResult) => (
                                      <div 
                                        key={stageResult.stage}
                                        className={`px-2 py-1 rounded text-xs ${
                                          stageResult.success 
                                            ? 'bg-green-100 text-green-700' 
                                            : 'bg-red-100 text-red-700'
                                        }`}
                                      >
                                        <strong>Stage {stageResult.stage}:</strong> {stageResult.success 
                                          ? `${stageResult.dataCount || 0} riders scraped` 
                                          : `Failed - ${stageResult.error}`
                                        }
                                      </div>
                                    ))}
                                  </div>
                                </details>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {result.timestamp && (
                          <p className="text-sm mt-2">
                            <strong>Completed:</strong>{' '}
                            {formatTimestamp(result.timestamp)}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="mt-1 text-red-700">
                        {result.error || 'An unknown error occurred'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>


      </div>
    </div>
  );
}