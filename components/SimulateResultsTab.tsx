'use client'

import { useRouter } from 'next/navigation';
import { Button } from './Button';

export const SimulateResultsTab = () => {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">🎲 Race Results Simulator</h2>

        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
          <p className="text-sm text-blue-800">
            <strong>Test functie:</strong> Genereer random race results om Marginal Gains en andere spellen te testen zonder echte PCS scraping.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-gray-700 mb-2">Wat doet deze tool?</h3>
            <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
              <li>Genereert random renners uit de rankings collectie</li>
              <li>Maakt fake stage results aan in Firestore</li>
              <li>Triggert automatisch de points calculation</li>
              <li>Update seasonPoints voor alle renners</li>
              <li>Update Marginal Gains games automatisch</li>
            </ul>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <h3 className="font-semibold text-gray-700 mb-3">Gebruik de simulator:</h3>
            <Button
              text="Open Race Results Simulator →"
              onClick={() => router.push('/admin/simulate-results')}
              className="px-6 py-3 bg-primary hover:bg-primary/90"
            />
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>⚠️ Let op:</strong> Dit maakt echte data aan in Firestore. Gebruik alleen voor testing!
        </p>
      </div>
    </div>
  );
};
