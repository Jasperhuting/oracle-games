'use client'

import { useState } from "react";
import { Button } from "../Button";
import { TextInput } from "../TextInput";
import { useForm, SubmitHandler, Controller } from "react-hook-form";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useTranslation } from "react-i18next";
import i18n from "i18next";
import { listenTranslations } from "@/lib/i18n/firestore";
import { AvatarUpload } from "./AvatarUpload";

interface AccountInfoTabProps {
  userId: string;
  email: string;
  displayName: string;
  userData: any;
  setUserData: (data: any) => void;
}

interface AccountFormData {
  playername: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  preferredLanguage: 'en' | 'nl';
  emailNotifications: boolean;
}

export const AccountInfoTab = ({ userId, email, displayName, userData, setUserData }: AccountInfoTabProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const dateOfBirth = userData?.dateOfBirth;
  const today = new Date();
  const isBirthdayToday = dateOfBirth && new Date(dateOfBirth).getMonth() === today.getMonth() && new Date(dateOfBirth).getDate() === today.getDate();

  const { t } = useTranslation();

  const handleAvatarUpload = async (avatarUrl: string) => {
    setIsUploadingAvatar(true);
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
          playername: userData?.playername || displayName,
          avatarUrl,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Kon avatar niet bijwerken');
      }

      setSuccess('Avatar succesvol bijgewerkt!');
      setUserData({
        ...userData,
        avatarUrl,
      });
    } catch (error: unknown) {
      console.error('Avatar upload error:', error);
      setError(error instanceof Error ? error.message : 'Er is iets misgegaan bij het uploaden');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const { register, handleSubmit, control, formState: { errors } } = useForm<AccountFormData>({
    defaultValues: {
      playername: userData?.playername || displayName,
      firstName: userData?.firstName || '',
      lastName: userData?.lastName || '',
      dateOfBirth: userData?.dateOfBirth || '',
      preferredLanguage: userData?.preferredLanguage || 'nl',
      emailNotifications: userData?.emailNotifications !== false,
    }
  });

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
          preferredLanguage: data.preferredLanguage,
          emailNotifications: data.emailNotifications,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Kon gegevens niet bijwerken');
      }

      setSuccess('Gegevens succesvol bijgewerkt!');

      // Apply language changes without refresh
      if (userData?.preferredLanguage !== data.preferredLanguage) {
        await new Promise<void>((resolve) => {
          listenTranslations(data.preferredLanguage, (translations) => {
            i18n.addResourceBundle(data.preferredLanguage, 'translation', translations, true, true);
            resolve();
          });
        });
        await i18n.changeLanguage(data.preferredLanguage);
      }

      setUserData({
        ...userData,
        playername: data.playername,
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: data.dateOfBirth,
        preferredLanguage: data.preferredLanguage,
        emailNotifications: data.emailNotifications
      });
    } catch (error: unknown) {
      console.error('Update error:', error);
      setError(error instanceof Error ? error.message : 'Er is iets misgegaan bij het bijwerken');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative">
      {isBirthdayToday && <img src="/happy-birthday.png" alt="Happy Birthday" className="absolute right-0 top-0 w-full max-w-[100px] md:max-w-[200px] h-auto mb-4 object-contain" />}

      <div className="space-y-4">
        {/* Avatar Upload */}
        <div className="flex flex-col items-center pb-4 border-b border-gray-200">
          <AvatarUpload
            currentAvatarUrl={userData?.avatarUrl}
            onUploadSuccess={handleAvatarUpload}
            size={100}
          />
          {isUploadingAvatar && (
            <p className="text-sm text-gray-500 mt-2">Avatar wordt opgeslagen...</p>
          )}
        </div>

        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('account.emailAddress')}
          </label>
          <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-600">
            {email}
          </div>
          <p className="text-xs text-gray-500 mt-1">{t('account.emailAddressCannotBeChanged')}</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <TextInput
                label={t('global.firstName')}
                placeholder={t('global.firstName')}
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
                label={t('global.lastName')}
                placeholder={t('global.lastName')}
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
              label={t('global.playerName')}
              placeholder={t('global.playerName')}
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('global.dateOfBirth')}
            </label>
            <Controller
              name="dateOfBirth"
              control={control}
              rules={{
                validate: (value) => {
                  if (!value) return true;
                  const date = new Date(value);
                  const today = new Date();
                  const age = today.getFullYear() - date.getFullYear();
                  if (age < 13) return 'You must be at least 13 years old';
                  if (age > 120) return 'Invalid birthdate';
                  return true;
                }
              }}
              render={({ field }) => (
                <DatePicker
                  selected={field.value ? new Date(field.value) : null}
                  onChange={(date) => {
                    if (date) {
                      const year = date.getFullYear();
                      const month = String(date.getMonth() + 1).padStart(2, '0');
                      const day = String(date.getDate()).padStart(2, '0');
                      field.onChange(`${year}-${month}-${day}`);
                    } else {
                      field.onChange('');
                    }
                  }}
                  dateFormat="dd/MM/yyyy"
                  showYearDropdown
                  scrollableYearDropdown
                  yearDropdownItemNumber={100}
                  maxDate={new Date()}
                  placeholderText={t('global.selectDateOfBirth')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  wrapperClassName="w-full"
                />
              )}
            />
            {errors.dateOfBirth && (
              <span className="text-red-500 text-xs mt-1 block">{errors.dateOfBirth.message}</span>
            )}
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('account.preferredLanguage')}
            </label>
            <select
              {...register('preferredLanguage', { required: 'Please select a language' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="nl">{t('global.dutch')}</option>
              <option value="en">{t('global.english')}</option>
            </select>
            {errors.preferredLanguage && (
              <span className="text-red-500 text-xs mt-1 block">{errors.preferredLanguage.message}</span>
            )}
          </div>

          <div className="mt-4">
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                {...register('emailNotifications')}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                {t('account.emailNotifications')}
              </span>
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-7">
              {t('account.emailNotificationsDescription')}
            </p>
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
            text={isSubmitting ? t('global.busySaving') : t('global.save')}
            type="submit"
            disabled={isSubmitting}
          />
        </form>
      </div>
    </div>
  );
};
