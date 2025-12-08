'use client';

import { useState, useEffect } from 'react';
import ScraperForm, { type ScraperFormData } from '@/components/ScraperForm';

interface ScrapingResult {
  success: boolean;
  message?: string;
  error?: string;
  dataCount?: number;
  timestamp?: string;
  // For all-stages results
  type?: string;
  totalStages?: number;
  successfulStages?: number;
  failedStages?: number;
  totalDataCount?: number;
  results?: Array<{
    stage: number;
    success: boolean;
    dataCount?: number;
    error?: string;
  }>;
}

interface BulkJob {
  id: string;
  race: string;
  year: number;
  totalStages: number;
  status: 'running' | 'completed' | 'failed';
  progress: {
    current: number;
    total: number;
    percentage: number;
  };
  results: Array<{
    stage: number;
    success: boolean;
    dataCount?: number;
    error?: string;
  }>;
  errors: Array<{
    stage: number;
    error: string;
  }>;
}

export default function ScraperPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScrapingResult | null>(null);
  const [bulkJob, setBulkJob] = useState<BulkJob | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

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
          setResult({
            success: jobData.status === 'completed',
            message: `All stages completed. ${jobData.results?.filter((r: any) => r.success).length || 0} successful, ${jobData.errors?.length || 0} failed.`, // eslint-disable-line @typescript-eslint/no-explicit-any
            type: 'all-stages',
            totalStages: jobData.totalStages,
            successfulStages: jobData.results?.filter((r: any) => r.success).length || 0, // eslint-disable-line @typescript-eslint/no-explicit-any
            failedStages: jobData.errors?.length || 0,
            totalDataCount: jobData.results?.reduce((sum: number, r: any) => sum + (r.dataCount || 0), 0) || 0, // eslint-disable-line @typescript-eslint/no-explicit-any
            results: jobData.results,
          });
        }
      } catch (error) {
        console.error('Error polling job status:', error);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [jobId]);

  const handleScrape = async (formData: ScraperFormData) => {
    setLoading(true);
    setResult(null);
    setBulkJob(null);
    setJobId(null);

    try {
      if (formData.type === 'all-stages') {
        // Use bulk scraping API for all stages
        const response = await fetch('/api/scraper/bulk', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            race: formData.race,
            year: formData.year,
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
          body: JSON.stringify(formData),
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
            <ScraperForm onSubmit={handleScrape} loading={loading} />
          </div>

          {/* Results Panel */}
          <div>
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
                          {bulkJob.results.filter(r => r.success).length} successful, {' '}
                          {bulkJob.errors.length} failed
                        </span>
                      </div>
                      
                      {/* Recent Results */}
                      {bulkJob.results.length > 0 && (
                        <div className="mt-3 max-h-32 overflow-y-auto">
                          <div className="text-xs text-blue-600 mb-1">Recent stages:</div>
                          {bulkJob.results.slice(-5).map((stageResult) => (
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
                            {new Date(result.timestamp).toLocaleString()}
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