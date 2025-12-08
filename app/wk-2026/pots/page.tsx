'use client';
import { useEffect, useState } from 'react';

export default function PotsPage() {

    const [pots, setPots] = useState<unknown[]>([]);

    // TODO: Fetch and display pot data from API
    const fetchPots = async () => {
        try {
            const response = await fetch('/api/wk-2026/getPots');
            const data = await response.json();
            setPots(data.poules || []);
        } catch (error) {
            console.error('Error fetching pots:', error);
        }
    };

    // Call fetchPots when component mounts
    useEffect(() => {
        fetchPots();
    }, []);

    console.log('pots', pots[0]?.teams)

    return (
        <div className="container mx-auto py-8">
            <h1 className="text-2xl font-bold mb-4">Pots Page</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {pots.map((pot) => (
                    <div key={pot.id} className="bg-white p-4 rounded shadow">
                        <h2 className="text-lg font-semibold">Pot {pot.pouleId}</h2>
                        {Object.values(pot.teams || {}).length > 0 ? Object.values(pot.teams || {}).map((team: any) => team.name).join(', ') : 'No teams'} {/* eslint-disable-line @typescript-eslint/no-explicit-any */}
                        {/* <p>Teams: {pot.teams?.map((team: any) => team.name).join(', ') || 'No teams'}</p> // eslint-disable-line @typescript-eslint/no-explicit-any */}
                    </div>
                ))}
            </div>
        </div>
    );

}
