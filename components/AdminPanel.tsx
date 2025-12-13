'use client';

import { useState } from 'react';
import { ScraperRunner } from './ScraperRunner';
import { DebugPanel } from './DebugPanel';
import process from "process";
import { useTranslation } from "react-i18next";



const YEAR = Number(process.env.NEXT_PUBLIC_PLAYING_YEAR || 2026);

interface ScrapeResult {
  success: boolean;
  command?: string;
  output?: string;
  timestamp?: string;
  error?: string;
}

export function AdminPanel() {
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [loading, setLoading] = useState(false);

  const commands = [
    { id: 'getRiders-Tour', label: 'Tour de France Startlist' },
    { id: 'getRiders-Giro', label: 'Giro d\'Italia Startlist' },
    { id: 'getRiders-Vuelta', label: 'Vuelta a España Startlist' },
    { id: 'getRiders-World', label: 'World Championship Startlist' },
    { id: 'stage-tour', label: 'Tour Stage Result', hasStage: true },
    { id: 'stage-vuelta', label: 'Vuelta Stage Result', hasStage: true },
  ];

  const runCommand = async (commandId: string, stage?: number, year?: number) => {
    setLoading(true);
    setResult(null);

    try {
      const body: { command: string; stage?: number; year?: number } = { command: commandId };
      if (stage) body.stage = stage;
      if (year) body.year = year;

      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <DebugPanel />
      <ScraperRunner />
      
      <div className="border rounded-lg p-6 bg-gray-50 ">
        <h2 className="text-xl font-semibold mb-4">Legacy Scraper Controls</h2>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {commands.map(cmd => (
          <CommandButton 
            key={cmd.id}
            command={cmd}
            onRun={runCommand}
            loading={loading}
          />
        ))}
      </div>

      {loading && (
        <div className="text-center py-4">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 "></div>
          <p className="mt-2 text-sm text-gray-600 ">Running scraper...</p>
        </div>
      )}

      {result && (
        <div className={`mt-4 p-4 rounded-lg ${
          result.success 
            ? 'bg-green-50 border border-green-200 text-green-800 '
            : 'bg-red-50 border border-red-200 text-red-800 '
        }`}>
          <h3 className="font-semibold mb-2">
            {result.success ? '✅ Success' : '❌ Error'}
          </h3>
          
          {result.command && (
            <p className="text-sm mb-2">
              <strong>Command:</strong> {result.command}
            </p>
          )}
          
          {result.timestamp && (
            <p className="text-sm mb-2">
              <strong>Time:</strong> {new Date(result.timestamp).toLocaleString()}
            </p>
          )}
          
          {result.output && (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm font-medium">Output</summary>
              <pre className="mt-2 p-2 bg-black/5  rounded text-xs overflow-auto max-h-40">
                {result.output}
              </pre>
            </details>
          )}
          
          {result.error && (
            <p className="text-sm mt-2">
              <strong>Error:</strong> {result.error}
            </p>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

interface CommandButtonProps {
  command: { id: string; label: string; hasStage?: boolean };
  onRun: (commandId: string, stage?: number, year?: number) => void;
  loading: boolean;
}

function CommandButton({ command, onRun, loading }: CommandButtonProps) {
  const [stage, setStage] = useState<string>('');
  const [year, setYear] = useState<string>(YEAR.toString());
  const { t } = useTranslation();

  const handleRun = () => {
    const stageNum = stage ? parseInt(stage) : undefined;
    const yearNum = year ? parseInt(year) : undefined;
    onRun(command.id, stageNum, yearNum);
  };

  return (
    <div className="border rounded p-3 bg-white ">
      <h4 className="font-medium mb-2">{command.label}</h4>
      
      {command.hasStage && (
        <div className="space-y-2 mb-3">
          <input
            type="number"
            placeholder="Stage (optional)"
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            className="w-full px-2 py-1 text-sm border rounded "
            min="1"
            max="21"
        />
          <input
            type="number"
            placeholder={t('global.year')}
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="w-full px-2 py-1 text-sm border rounded "
            min="2020"
            max="2030"
          />
        </div>
      )}
      
      <button
        onClick={handleRun}
        disabled={loading}
        className="w-full px-3 py-2 text-sm bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded transition-colors"
      >
        Run
      </button>
    </div>
  );
}