'use client'

import { useState } from "react";
import { Button } from "./Button";
import { TextInput } from "./TextInput";
import { useForm, SubmitHandler } from "react-hook-form";
import { useAuth } from "@/hooks/useAuth";

interface RaceFormData {
  race: string;
  year: number;
  description: string;
}

const AVAILABLE_RACES = [
  { value: "tour-de-france", label: "Tour de France" },
  { value: "giro-d-italia", label: "Giro d'Italia" },
  { value: "vuelta-a-espana", label: "La Vuelta ciclista a España" },
  { value: "world-championship", label: "World Championships" },
  { value: "milano-sanremo", label: "Milano-Sanremo" },
  { value: "amstel-gold-race", label: "Amstel Gold Race" },
  { value: "tirreno-adriatico", label: "Tirreno-Adriatico" },
  { value: "liege-bastogne-liege", label: "Liège-Bastogne-Liège" },
  { value: "il-lombardia", label: "Il Lombardia" },
  { value: "la-fleche-wallone", label: "La Flèche Wallonne" },
  { value: "paris-nice", label: "Paris - Nice" },
  { value: "paris-roubaix", label: "Paris-Roubaix" },
  { value: "volta-a-catalunya", label: "Volta Ciclista a Catalunya" },
  { value: "dauphine", label: "Critérium du Dauphiné" },
  { value: "ronde-van-vlaanderen", label: "Tour des Flandres" },
  { value: "gent-wevelgem", label: "Gent-Wevelgem in Flanders Fields" },
  { value: "san-sebastian", label: "Clásica Ciclista San Sebastián" },
] as const;

export const AddGameTab = () => {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<RaceFormData>();

  const onSubmit: SubmitHandler<RaceFormData> = async (data) => {
    if (!user) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      // Get the race label from the selected value
      const selectedRace = AVAILABLE_RACES.find(r => r.value === data.race);
      const raceName = selectedRace?.label || data.race;

      const response = await fetch('/api/createRace', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminUserId: user.uid,
          name: raceName,
          year: data.year,
          slug: `${data.race}_${data.year}`,
          description: data.description,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Could not create race');
      }

      setSuccess('Race successfully added and starting list is loaded!');
      reset();
    } catch (error: any) {
      console.error('Error creating race:', error);
      setError(error.message || 'Something went wrong adding the race');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Race Toevoegen</h2>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Race
            </label>
            <select
              {...register('race', {
                required: 'Race is verplicht'
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Selecteer een race</option>
              {AVAILABLE_RACES.map((race) => (
                <option key={race.value} value={race.value}>
                  {race.label}
                </option>
              ))}
            </select>
            {errors.race && (
              <span className="text-red-500 text-xs mt-1 block">{errors.race.message}</span>
            )}
          </div>

          <div>
            <TextInput
              type="number"
              label="Jaar"
              placeholder="Bijv. 2025"
              {...register('year', {
                required: 'Jaar is verplicht',
                min: {
                  value: 2020,
                  message: 'Jaar moet minimaal 2020 zijn'
                },
                max: {
                  value: 2030,
                  message: 'Jaar mag maximaal 2030 zijn'
                }
              })}
            />
            {errors.year && (
              <span className="text-red-500 text-xs mt-1 block">{errors.year.message}</span>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Beschrijving
            </label>
            <textarea
              {...register('description', {
                minLength: {
                  value: 10,
                  message: 'Beschrijving moet minimaal 10 karakters zijn'
                }
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              rows={4}
              placeholder="Beschrijf de race..."
            />
            {errors.description && (
              <span className="text-red-500 text-xs mt-1 block">{errors.description.message}</span>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-md p-3">
              <span className="text-green-700 text-sm">{success}</span>
            </div>
          )}

          <Button
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700"
            text={isSubmitting ? "Bezig met toevoegen..." : "Race Toevoegen"}
            type="submit"
            disabled={isSubmitting}
          />
        </form>
      </div>
    </div>
  );
}
