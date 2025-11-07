'use client'

import { useState } from "react";
import { Button } from "./Button";
import { createPasskey, isPasskeySupported } from "@/lib/passkey";

interface PasskeySetupProps {
  userId: string;
  email: string;
  displayName: string;
}

export const PasskeySetup = ({ userId, email, displayName }: PasskeySetupProps) => {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSetupPasskey = async () => {
    if (!isPasskeySupported()) {
      setError('Je browser ondersteunt geen passkeys. Gebruik een moderne browser zoals Chrome, Safari of Edge.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Create passkey
      const { credentialId, publicKey, challenge } = await createPasskey(email, displayName, userId);

      // Register passkey with backend
      const response = await fetch('/api/registerPasskey', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          credentialId,
          publicKey,
          email,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Kon passkey niet registreren');
      }

      setSuccess(true);
    } catch (error: any) {
      console.error('Passkey setup error:', error);
      setError(error.message || 'Er is iets misgegaan bij het instellen van de passkey');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isPasskeySupported()) {
    return null;
  }

  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-md p-4">
        <p className="text-green-800 text-sm">
          ✓ Passkey succesvol ingesteld! Je kunt nu inloggen met je passkey.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
      <h3 className="font-semibold mb-2">Stel een Passkey in 🔑</h3>
      <p className="text-sm text-gray-700 mb-4">
        Log in de volgende keer sneller en veiliger met een passkey. Geen wachtwoord meer nodig!
      </p>
      <Button
        className="w-full justify-center py-2  text-white "
        text={isLoading ? "Bezig met instellen..." : "Passkey instellen"}
        onClick={handleSetupPasskey}
        disabled={isLoading}
      />
      {error && <span className="text-red-500 text-xs mt-2 block">{error}</span>}
    </div>
  );
}
