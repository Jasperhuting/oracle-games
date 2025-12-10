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
      setError('Your browser does not support passkeys. Use a modern browser like Chrome, Safari or Edge.');
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
        throw new Error(errorData.error || 'Could not register passkey');
      }

      setSuccess(true);
    } catch (error: unknown) {
      console.error('Passkey setup error:', error);
      setError(error instanceof Error ? error.message : 'Something went wrong setting up the passkey');
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
          ✓ Passkey successfully set up! You can now log in with your passkey.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
      <h3 className="font-semibold mb-2">Set up a Passkey 🔑</h3>
      <p className="text-sm text-gray-700 mb-4">
        Log in faster and more securely next time with a passkey. No password needed!
      </p>
      <Button
        className="w-full justify-center py-2 text-white"
        text={isLoading ? "Setting up..." : "Set up Passkey"}
        onClick={handleSetupPasskey}
        disabled={isLoading}
      />
      {error && <span className="text-red-500 text-xs mt-2 block">{error}</span>}
    </div>
  );
}
