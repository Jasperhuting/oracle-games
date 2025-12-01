'use client'

import { useState, useEffect } from "react";
import { Button } from "./Button";
import { TextInput } from "./TextInput";
import { PasskeySetup } from "./PasskeySetup";
import { useForm, SubmitHandler } from "react-hook-form";

interface AccountSettingsProps {
  userId: string;
  email: string;
  displayName: string;
}

interface AccountFormData {
  playername: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
}

interface PasskeyInfo {
  hasPasskey: boolean;
  lastUsedAt?: string;
  createdAt?: string;
}

export const AccountSettings = ({ userId, email, displayName }: AccountSettingsProps) => {
  const [userData, setUserData] = useState<any>(null);
  const [passkeyInfo, setPasskeyInfo] = useState<PasskeyInfo>({ hasPasskey: false });
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<AccountFormData>();

  // Fetch user data and passkey info
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // Fetch user data from Firestore
        const userResponse = await fetch(`/api/getUser?userId=${userId}`);
        if (userResponse.ok) {
          const data = await userResponse.json();
          setUserData(data);
          setValue('playername', data.playername || displayName);
          setValue('firstName', data.firstName || '');
          setValue('lastName', data.lastName || '');
          setValue('dateOfBirth', data.dateOfBirth || '');
        }

        // Check if user has passkey
        const passkeyResponse = await fetch(`/api/checkPasskey?userId=${userId}`);
        if (passkeyResponse.ok) {
          const passkeyData = await passkeyResponse.json();
          setPasskeyInfo(passkeyData);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [userId, displayName, setValue]);

  const onSubmit: SubmitHandler<AccountFormData> = async (data) => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/updateUser', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          playername: data.playername,
          firstName: data.firstName,
          lastName: data.lastName,
          dateOfBirth: data.dateOfBirth,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Kon gegevens niet bijwerken');
      }

      setSuccess('Gegevens succesvol bijgewerkt!');
      setUserData({ 
        ...userData, 
        playername: data.playername,
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: data.dateOfBirth
      });
    } catch (error: any) {
      console.error('Update error:', error);
      setError(error.message || 'Er is iets misgegaan bij het bijwerken');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Laden...</div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Account Informatie</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              E-mailadres
            </label>
            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-600">
              {email}
            </div>
            <p className="text-xs text-gray-500 mt-1">Je e-mailadres kan niet worden gewijzigd</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <TextInput
                  label="First name"
                  placeholder="First name"
                  {...register('firstName', {
                    maxLength: {
                      value: 50,
                      message: 'First name may not exceed 50 characters'
                    }
                  })}
                />
                {errors.firstName && (
                  <span className="text-red-500 text-xs mt-1 block">{errors.firstName.message}</span>
                )}
              </div>

              <div>
                <TextInput
                  label="Last name"
                  placeholder="Last name"
                  {...register('lastName', {
                    maxLength: {
                      value: 50,
                      message: 'Last name may not exceed 50 characters'
                    }
                  })}
                />
                {errors.lastName && (
                  <span className="text-red-500 text-xs mt-1 block">{errors.lastName.message}</span>
                )}
              </div>
            </div>

            <div className="mt-4">
              <TextInput
                label="Player name"
                placeholder="Player name"
                {...register('playername', {
                  required: 'Player name is required',
                  minLength: {
                    value: 2,
                    message: 'Player name must be at least 2 characters long'
                  },
                  maxLength: {
                    value: 50,
                    message: 'Player name may not exceed 50 characters'
                  }
                })}
              />
              {errors.playername && (
                <span className="text-red-500 text-xs mt-1 block">{errors.playername.message}</span>
              )}
            </div>

            <div className="mt-4">
              <TextInput
                type="date"
                label="Date of birth"
                placeholder="Date of birth"
                {...register('dateOfBirth', {
                  validate: (value) => {
                    if (!value) return true; // Optional field
                    const date = new Date(value);
                    const today = new Date();
                    const age = today.getFullYear() - date.getFullYear();
                    if (age < 13) return 'You must be at least 13 years old';
                    if (age > 120) return 'Invalid birthdate';
                    return true;
                  }
                })}
              />
              {errors.dateOfBirth && (
                <span className="text-red-500 text-xs mt-1 block">{errors.dateOfBirth.message}</span>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 mt-3">
                <span className="text-red-700 text-sm">{error}</span>
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 rounded-md p-3 mt-3">
                <span className="text-green-700 text-sm">{success}</span>
              </div>
            )}

            <Button
              className="mt-4 px-6 py-2"
              text={isSubmitting ? "Busy saving..." : "Save"}
              type="submit"
              disabled={isSubmitting}
            />
          </form>
        </div>
      </div>

      {/* Passkey Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mt-5">
        <h2 className="text-xl font-semibold mb-4">Security</h2>
        
        {passkeyInfo.hasPasskey ? (
          <div className="bg-green-50 border border-green-200 rounded-md p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">
                  Passkey active 🔑
                </h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>You have a passkey set up for faster and safer login.</p>
                  {passkeyInfo.lastUsedAt && (
                    <p className="mt-1 text-xs">
                      Last used: {new Date(passkeyInfo.lastUsedAt).toLocaleDateString('nl-NL', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <PasskeySetup 
            userId={userId} 
            email={email} 
            displayName={userData?.playername || displayName} 
          />
        )}
      </div>
    </div>
  );
}
