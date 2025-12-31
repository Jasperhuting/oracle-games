'use client';

import { useState } from 'react';
import { ScraperJob } from '@/lib/types/admin';

const RACES = [
  'tour-de-france',
  'giro-d-italia', 
  'vuelta-a-espana',
  'world-championship',
  'milano-sanremo',
  'amstel-gold-race',
  'tirreno-adriatico',
  'liege-bastogne-liege',
  'il-lombardia',
  'la-fleche-wallone',
  'paris-nice',
  'paris-roubaix',
  'volta-a-catalunya',
  'dauphine',
  'ronde-van-vlaanderen',
  'gent-wevelgem',
  'san-sebastian'
];

export function ScraperRunner() {
  const [type, setType] = useState<'startlist' | 'stage-result'>('startlist');
  const [race, setRace] = useState('tour-de-france');
  const [stage, setStage] = useState('');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<ScraperJob[]>([]);

  const runScraper = async () => {
    setLoading(true);
    
    try {
      const body: { type: 'startlist' | 'stage-result'; race: string; year: number; stage?: number } = { type, race, year: parseInt(year) };
      if (type === 'stage-result' && stage) {
        body.stage = parseInt(stage);
      }

      const response = await fetch('/api/run-scraper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const result = await response.json();
      
      if (response.ok) {
        // Start polling for job status
        pollJobStatus(result.jobId);
      } else {
        console.error('Failed to start scraper:', result.error);
      }
    } catch (error) {
      console.error('Error starting scraper:', error);
    } finally {
      setLoading(false);
    }
  };

  const pollJobStatus = async (jobId: string) => {
    const poll = async () => {
      try {
        const response = await fetch(`/api/run-scraper?jobId=${jobId}`);
        const job = await response.json();
        
        setJobs(prev => {
          const index = prev.findIndex(j => j.id === jobId);
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = job;
            return updated;
          } else {
            return [job, ...prev];
          }
        });

        // Continue polling if still running
        if (job.status === 'running') {
          setTimeout(poll, 2000); // Poll every 2 seconds
        }
      } catch (error) {
        console.error('Error polling job status:', error);
      }
    };

    poll();
  };

  const loadAllJobs = async () => {
    try {
      const response = await fetch('/api/run-scraper');
      const data = await response.json();
      setJobs(data.jobs || []);
    } catch (error) {
      console.error('Error loading jobs:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border rounded-lg p-6 bg-white">
        <h2 className="text-xl font-semibold mb-4">Run Scraper</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select 
              value={type} 
              onChange={(e) => setType(e.target.value as 'startlist' | 'stage-result')}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="startlist">Startlist</option>
              <option value="stage-result">Stage Result</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Race</label>
            <select 
              value={race} 
              onChange={(e) => setRace(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            >
              {RACES.map(r => (
                <option key={r} value={r}>
                  {r.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </option>
              ))}
            </select>
          </div>

          {type === 'stage-result' && (
            <div>
              <label className="block text-sm font-medium mb-1">Stage</label>
              <input
                type="number"
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                min="1"
                max="21"
                placeholder="Stage number"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Year</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              min="2020"
              max="2030"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={runScraper}
            disabled={loading || (type === 'stage-result' && !stage)}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded transition-colors cursor-pointer"
          >
            {loading ? 'Starting...' : 'Run Scraper'}
          </button>

          <button
            onClick={loadAllJobs}
            className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded transition-colors cursor-pointer"
          >
            Refresh Jobs
          </button>
        </div>
      </div>

      {/* Job Status */}
      <div className="border rounded-lg p-6 bg-white">
        <h3 className="text-lg font-semibold mb-4">Job Status</h3>
        
        {jobs.length === 0 ? (
          <p className="text-gray-500">No jobs running</p>
        ) : (
          <div className="space-y-3">
            {jobs.map(job => (
              <div key={job.id} className={`border rounded p-3 ${
                job.status === 'completed' ? 'border-green-200 bg-green-50' :
                job.status === 'failed' ? 'border-red-200 bg-red-50' :
                'border-yellow-200 bg-yellow-50'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">
                    {job.race.replace(/-/g, ' ')} - {job.type}
                    {job.stage && ` (Stage ${job.stage})`}
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    job.status === 'completed' ? 'bg-green-100 text-green-800' :
                    job.status === 'failed' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {job.status.toUpperCase()}
                    {job.status === 'running' && '...'}
                  </span>
                </div>
                
                <div className="text-sm text-gray-600">
                  Started: {new Date(job.startTime).toLocaleString()}
                  {job.endTime && (
                    <span> • Finished: {new Date(job.endTime).toLocaleString()}</span>
                  )}
                </div>

                {job.error && (
                  <div className="mt-2 text-sm text-red-600">
                    <strong>Error:</strong> {job.error}
                  </div>
                )}

                {job.output && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-medium">Output</summary>
                    <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-32">
                      {job.output}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}