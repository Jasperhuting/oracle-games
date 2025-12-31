'use client'

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/Button';
import { useRouter } from 'next/navigation';
import { SimulateRace as Race } from '@/lib/types/pages';

export default function SimulateResultsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [races, setRaces] = useState<Race[]>([]);
  const [selectedRace, setSelectedRace] = useState<string>('');
  const [stage, setStage] = useState<string>('1');
  const [numRiders, setNumRiders] = useState<string>('20');
  const [simulating, setSimulating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
      return;
    }

    if (user) {
      checkAdminStatus();
      fetchRaces();
    }
  }, [user, authLoading, router]);

  const checkAdminStatus = async () => {
    try {
      const response = await fetch(`/api/getUser?userId=${user?.uid}`);
      if (response.ok) {
        const data = await response.json();
        if (data.userType === 'admin') {
          setIsAdmin(true);
        } else {
          router.push('/');
        }
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const fetchRaces = async () => {
    if (!user?.uid) return;

    try {
      const response = await fetch(`/api/getRaces?userId=${user.uid}`);
      if (response.ok) {
        const data = await response.json();
        setRaces(data.races || []);
      }
    } catch (error) {
      console.error('Error fetching races:', error);
    }
  };

  const handleSimulate = async () => {
    if (!selectedRace || !stage || !numRiders) {
      setMessage({ type: 'error', text: 'Vul alle velden in' });
      return;
    }

    setSimulating(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/simulate-stage-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.uid,
          raceSlug: selectedRace,
          stage: parseInt(stage),
          numRiders: parseInt(numRiders),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({
          type: 'success',
          text: `✅ Stage ${stage} gesimuleerd! ${data.ridersGenerated} renners gegenereerd. Points berekend voor ${data.gamesAffected || 0} spellen.`
        });
      } else {
        setMessage({ type: 'error', text: data.error || 'Fout bij simuleren' });
      }
    } catch (error) {
      console.error('Error simulating:', error);
      setMessage({ type: 'error', text: 'Fout bij simuleren van resultaten' });
    } finally {
      setSimulating(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Laden...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold mb-6">🎲 Simuleer Race Results</h1>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
            <p className="text-sm text-blue-800">
              <strong>Test functie:</strong> Genereer random race results om Marginal Gains en andere spellen te testen.
              Deze tool maakt fake stage results aan en triggert automatisch de points calculation.
            </p>
          </div>

          <div className="space-y-4">
            {/* Race Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Selecteer Race *
              </label>
              <select
                value={selectedRace}
                onChange={(e) => setSelectedRace(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">-- Kies een race --</option>
                {races.map((race) => (
                  <option key={race.id} value={race.id}>
                    {race.name} {race.year}
                  </option>
                ))}
              </select>
            </div>

            {/* Stage Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Stage Nummer *
              </label>
              <input
                type="number"
                min="1"
                max="21"
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="1"
              />
            </div>

            {/* Number of Riders */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Aantal Renners *
              </label>
              <input
                type="number"
                min="1"
                max="200"
                value={numRiders}
                onChange={(e) => setNumRiders(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="20"
              />
              <p className="text-xs text-gray-500 mt-1">
                Aantal random renners die finish positions krijgen (max 200)
              </p>
            </div>

            {/* Message Display */}
            {message && (
              <div className={`p-4 rounded-md ${
                message.type === 'success'
                  ? 'bg-green-50 border border-green-200 text-green-800'
                  : 'bg-red-50 border border-red-200 text-red-800'
              }`}>
                <p className="text-sm">{message.text}</p>
              </div>
            )}

            {/* Submit Button */}
            <Button
              text={simulating ? 'Simuleren...' : '🎲 Simuleer Stage Result'}
              onClick={handleSimulate}
              disabled={simulating || !selectedRace || !stage || !numRiders}
              className="w-full px-6 py-3 bg-primary hover:bg-primary/90"
            />

            {/* Info Section */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="font-semibold text-gray-700 mb-2">ℹ️ Wat doet deze tool?</h3>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• Genereert random renners uit de rankings collectie</li>
                <li>• Maakt een fake stage result aan in Firestore (raceSlug/stages/results)</li>
                <li>• Triggert automatisch de points calculation API</li>
                <li>• Update seasonPoints voor alle renners</li>
                <li>• Update Marginal Gains games automatisch</li>
                <li>• Perfect om te testen zonder echte PCS scraping</li>
              </ul>
            </div>

            {/* Back Button */}
            <Button
              text="← Terug naar Admin"
              onClick={() => router.push('/admin')}
              className="w-full px-6 py-2 bg-gray-600 hover:bg-gray-700 mt-4"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
