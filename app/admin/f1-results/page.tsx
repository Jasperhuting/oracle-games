'use client'

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/Button';
import { useRouter } from 'next/navigation';
import { races2026, drivers, Driver } from '@/app/f1/data';
import { DriverSelector } from '@/app/f1/components/DriverSelector';

export default function F1ResultsAdminPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [selectedRace, setSelectedRace] = useState<number | null>(null);
    const [grid, setGrid] = useState<(Driver | null)[]>(Array(22).fill(null));
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/');
            return;
        }

        if (user) {
            checkAdminStatus();
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

    const handleDriverSelect = (position: number, driverShortName: string) => {
        const driver = drivers.find(d => d.shortName === driverShortName) || null;
        setGrid(prev => {
            const newGrid = [...prev];
            // Remove driver from old position if exists
            const oldIndex = newGrid.findIndex(d => d?.shortName === driverShortName);
            if (oldIndex !== -1) {
                newGrid[oldIndex] = null;
            }
            newGrid[position] = driver;
            return newGrid;
        });
    };

    const handleSaveResults = async () => {
        if (selectedRace === null) {
            setMessage({ type: 'error', text: 'Selecteer eerst een race' });
            return;
        }

        const filledPositions = grid.filter(d => d !== null).length;
        if (filledPositions === 0) {
            setMessage({ type: 'error', text: 'Vul minimaal 1 positie in' });
            return;
        }

        setSaving(true);
        setMessage(null);

        try {
            // TODO: Implement API call to save results
            // For now, just log and show success
            console.log('Saving F1 results:', {
                round: selectedRace,
                results: grid.map((driver, index) => ({
                    position: index + 1,
                    driver: driver?.shortName || null
                })).filter(r => r.driver !== null)
            });

            setMessage({
                type: 'success',
                text: `Uitslag voor race ${selectedRace} opgeslagen! (${filledPositions} posities)`
            });
        } catch (error) {
            console.error('Error saving results:', error);
            setMessage({ type: 'error', text: 'Fout bij opslaan van uitslag' });
        } finally {
            setSaving(false);
        }
    };

    const handleClearGrid = () => {
        setGrid(Array(22).fill(null));
    };

    const getAvailableDrivers = (currentPosition: number) => {
        const usedDrivers = grid
            .map((d, idx) => idx !== currentPosition ? d?.shortName : null)
            .filter(Boolean);
        return drivers.filter(d => !usedDrivers.includes(d.shortName));
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

    const selectedRaceData = races2026.find(r => r.round === selectedRace);

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-4xl mx-auto px-4">
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h1 className="text-2xl font-bold mb-6">F1 Race Uitslagen Invoeren</h1>

                    <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
                        <p className="text-sm text-blue-800">
                            <strong>Admin functie:</strong> Voer hier de officiële race uitslagen in.
                            De punten worden automatisch berekend op basis van de voorspellingen van de spelers.
                        </p>
                    </div>

                    {/* Race Selection */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Selecteer Race *
                        </label>
                        <select
                            value={selectedRace ?? ''}
                            onChange={(e) => {
                                setSelectedRace(e.target.value ? parseInt(e.target.value) : null);
                                setGrid(Array(22).fill(null));
                                setMessage(null);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                            <option value="">-- Kies een race --</option>
                            {races2026.map((race) => {
                                const raceEndDate = new Date(race.endDate);
                                const isPast = raceEndDate < new Date();
                                return (
                                    <option key={race.round} value={race.round}>
                                        {race.round}. {race.name} ({new Date(race.startDate).toLocaleDateString('nl-NL')})
                                        {isPast ? ' ✓' : ''}
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    {selectedRaceData && (
                        <>
                            <div className="mb-4 p-3 bg-gray-100 rounded-md">
                                <h2 className="font-semibold">{selectedRaceData.name}</h2>
                                <p className="text-sm text-gray-600">{selectedRaceData.subName}</p>
                            </div>

                            {/* Grid Input */}
                            <div className="mb-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-semibold">Uitslag invoeren</h3>
                                    <Button
                                        text="Reset"
                                        onClick={handleClearGrid}
                                        className="px-3 py-1 text-sm bg-gray-500 hover:bg-gray-600"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {Array.from({ length: 22 }, (_, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <span className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded-full text-sm font-bold">
                                                {index + 1}
                                            </span>
                                            <div className="flex-1">
                                                <DriverSelector
                                                    drivers={getAvailableDrivers(index)}
                                                    selectedDrivers={grid[index] ? [grid[index]!] : []}
                                                    setSelectedDrivers={(selected) => {
                                                        if (selected.length > 0) {
                                                            handleDriverSelect(index, selected[0].shortName);
                                                        } else {
                                                            setGrid(prev => {
                                                                const newGrid = [...prev];
                                                                newGrid[index] = null;
                                                                return newGrid;
                                                            });
                                                        }
                                                    }}
                                                    placeholder="Selecteer coureur"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Quick fill buttons */}
                            <div className="mb-6 p-4 bg-gray-50 rounded-md">
                                <h4 className="text-sm font-semibold mb-2">Snel invullen per team:</h4>
                                <div className="flex flex-wrap gap-2">
                                    {[...new Set(drivers.map(d => d.team))].map(team => (
                                        <span
                                            key={team}
                                            className="text-xs px-2 py-1 bg-gray-200 rounded cursor-default"
                                        >
                                            {team}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Message Display */}
                            {message && (
                                <div className={`p-4 rounded-md mb-4 ${message.type === 'success'
                                        ? 'bg-green-50 border border-green-200 text-green-800'
                                        : 'bg-red-50 border border-red-200 text-red-800'
                                    }`}>
                                    <p className="text-sm">{message.text}</p>
                                </div>
                            )}

                            {/* Submit Button */}
                            <Button
                                text={saving ? 'Opslaan...' : 'Uitslag Opslaan'}
                                onClick={handleSaveResults}
                                disabled={saving}
                                className="w-full px-6 py-3 bg-primary hover:bg-primary/90"
                            />
                        </>
                    )}

                    {/* Back Button */}
                    <Button
                        text="← Terug naar Admin"
                        onClick={() => router.push('/admin')}
                        className="w-full px-6 py-2 bg-gray-600 hover:bg-gray-700 mt-4"
                    />
                </div>
            </div>
        </div>
    );
}
