'use client'

import { useState } from "react";
import { Button } from "./Button";
import { TextInput } from "./TextInput";
import { useForm, SubmitHandler } from "react-hook-form";
import { useAuth } from "@/hooks/useAuth";
import { t } from "i18next";

interface RaceFormData {
  race: string;
  customSlug: string;
  raceName: string;
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
  const [isCustomRace, setIsCustomRace] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<RaceFormData>();

  // Update isCustomRace when race selection changes
  const handleRaceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setIsCustomRace(e.target.value === 'custom');
  };

  const onSubmit: SubmitHandler<RaceFormData> = async (data) => {
    if (!user) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      let raceSlug: string;
      let raceName: string;

      if (data.race === 'custom') {
        // Custom race: use the custom slug and name
        if (!data.customSlug || !data.raceName) {
          throw new Error('Custom slug en race naam zijn verplicht voor custom races');
        }
        raceSlug = data.customSlug.toLowerCase().trim();
        raceName = data.raceName.trim();

        // Validate slug format
        if (!/^[a-z0-9-]+$/.test(raceSlug)) {
          throw new Error('Slug mag alleen kleine letters, cijfers en streepjes bevatten');
        }
      } else {
        // Predefined race: use the selected value
        const selectedRace = AVAILABLE_RACES.find(r => r.value === data.race);
        raceSlug = data.race;
        raceName = selectedRace?.label || data.race;
      }

      const response = await fetch('/api/createRace', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminUserId: user.uid,
          name: raceName,
          year: data.year,
          slug: `${raceSlug}_${data.year}`,
          description: data.description,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Could not create race');
      }

      setSuccess('Race successfully added and starting list is loaded!');
      reset();
      setIsCustomRace(false);
    } catch (error: unknown) {
      console.error('Error creating race:', error);
      setError(error instanceof Error ? error.message : 'Something went wrong adding the race');
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
                required: 'Race is verplicht',
                onChange: handleRaceChange
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Selecteer een race</option>
              {AVAILABLE_RACES.map((race) => (
                <option key={race.value} value={race.value}>
                  {race.label}
                </option>
              ))}
              <option value="custom">-- Custom Race (PCS slug) --</option>
            </select>
            {errors.race && (
              <span className="text-red-500 text-xs mt-1 block">{errors.race.message}</span>
            )}
          </div>

          {isCustomRace && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  PCS Slug
                </label>
                <input
                  type="text"
                  {...register('customSlug', {
                    required: isCustomRace ? 'Slug is verplicht voor custom races' : false,
                    pattern: {
                      value: /^[a-z0-9-]+$/,
                      message: 'Alleen kleine letters, cijfers en streepjes toegestaan'
                    }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="bijv. nc-australia-mj-itt"
                />
                <span className="text-gray-500 text-xs mt-1 block">
                  De slug uit de PCS URL: procyclingstats.com/race/<strong>nc-australia-mj-itt</strong>/2026/result
                </span>
                {errors.customSlug && (
                  <span className="text-red-500 text-xs mt-1 block">{errors.customSlug.message}</span>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Race Naam
                </label>
                <input
                  type="text"
                  {...register('raceName', {
                    required: isCustomRace ? 'Race naam is verplicht voor custom races' : false
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="bijv. NC Australia MJ ITT"
                />
                {errors.raceName && (
                  <span className="text-red-500 text-xs mt-1 block">{errors.raceName.message}</span>
                )}
              </div>
            </>
          )}

          <div>
            <TextInput
              type="number"
              label={t('global.year')}
              placeholder={`Bijv. 2026`}
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
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
            className="px-6 py-2 bg-primary hover:bg-primary"
            text={isSubmitting ? "Busy adding..." : "Add Race"}
            type="submit"
            disabled={isSubmitting}
          />
        </form>
      </div>
    </div>
  );
}
