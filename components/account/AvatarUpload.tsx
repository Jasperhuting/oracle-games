'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

interface AvatarUploadProps {
  currentAvatarUrl?: string;
  onUploadSuccess: (url: string) => void;
  size?: number;
}

declare global {
  interface Window {
    cloudinary?: {
      createUploadWidget: (
        options: Record<string, unknown>,
        callback: (error: Error | null, result: { event: string; info: { secure_url: string } }) => void
      ) => { open: () => void };
    };
  }
}

export function AvatarUpload({ currentAvatarUrl, onUploadSuccess, size = 80 }: AvatarUploadProps) {
  const [isLoading, setIsLoading] = useState(false);
  const widgetRef = useRef<{ open: () => void } | null>(null);

  useEffect(() => {
    // Load Cloudinary upload widget script
    const script = document.createElement('script');
    script.src = 'https://upload-widget.cloudinary.com/global/all.js';
    script.async = true;
    document.body.appendChild(script);

    script.onload = () => {
      if (window.cloudinary) {
        widgetRef.current = window.cloudinary.createUploadWidget(
          {
            cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'oracle-games',
            uploadPreset: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'avatar_uploads',
            sources: ['local', 'camera'],
            multiple: false,
            maxFiles: 1,
            cropping: true,
            croppingAspectRatio: 1,
            croppingShowDimensions: true,
            showSkipCropButton: false,
            resourceType: 'image',
            clientAllowedFormats: ['png', 'jpg', 'jpeg', 'gif', 'webp'],
            maxFileSize: 5000000, // 5MB
            folder: 'avatars',
            styles: {
              palette: {
                window: '#FFFFFF',
                windowBorder: '#90A0B3',
                tabIcon: '#0078FF',
                menuIcons: '#5A616A',
                textDark: '#000000',
                textLight: '#FFFFFF',
                link: '#0078FF',
                action: '#FF620C',
                inactiveTabIcon: '#0E2F5A',
                error: '#F44235',
                inProgress: '#0078FF',
                complete: '#20B832',
                sourceBg: '#E4EBF1',
              },
            },
          },
          (error, result) => {
            if (error) {
              console.error('Upload error:', error);
              setIsLoading(false);
              return;
            }

            if (result.event === 'success') {
              onUploadSuccess(result.info.secure_url);
              setIsLoading(false);
            }
          }
        );
      }
    };

    return () => {
      document.body.removeChild(script);
    };
  }, [onUploadSuccess]);

  const handleClick = () => {
    if (widgetRef.current) {
      setIsLoading(true);
      widgetRef.current.open();
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative cursor-pointer group"
        onClick={handleClick}
        style={{ width: size, height: size }}
      >
        {currentAvatarUrl ? (
          <div
            className="rounded-full overflow-hidden border-2 border-gray-200"
            style={{ width: size, height: size }}
          >
            <Image
              src={currentAvatarUrl}
              alt="Avatar"
              width={size}
              height={size}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div
            className="rounded-full bg-gray-200 flex items-center justify-center border-2 border-gray-300"
            style={{ width: size, height: size }}
          >
            <svg
              className="w-1/2 h-1/2 text-gray-400"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </div>
        )}

        {/* Overlay on hover */}
        <div className="absolute inset-0 rounded-full bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <svg
            className="w-6 h-6 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </div>

        {isLoading && (
          <div className="absolute inset-0 rounded-full bg-white bg-opacity-75 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleClick}
        className="text-sm text-primary hover:underline"
        disabled={isLoading}
      >
        {currentAvatarUrl ? 'Wijzig avatar' : 'Upload avatar'}
      </button>
    </div>
  );
}
