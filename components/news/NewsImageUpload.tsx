'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

interface NewsImageUploadProps {
  currentImageUrl?: string;
  onUploadSuccess: (url: string) => void;
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

export function NewsImageUpload({ currentImageUrl, onUploadSuccess }: NewsImageUploadProps) {
  const [isLoading, setIsLoading] = useState(false);
  const widgetRef = useRef<{ open: () => void } | null>(null);

  useEffect(() => {
    const existingScript = document.querySelector('script[src="https://upload-widget.cloudinary.com/global/all.js"]');
    const script = existingScript || document.createElement('script');

    if (!existingScript) {
      script.src = 'https://upload-widget.cloudinary.com/global/all.js';
      script.async = true;
      document.body.appendChild(script);
    }

    const initializeWidget = () => {
      if (!window.cloudinary) return;

      widgetRef.current = window.cloudinary.createUploadWidget(
        {
          cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'oracle-games',
          uploadPreset: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'avatar_uploads',
          sources: ['local', 'camera'],
          multiple: false,
          maxFiles: 1,
          cropping: true,
          croppingAspectRatio: 16 / 9,
          croppingShowDimensions: true,
          showSkipCropButton: true,
          resourceType: 'image',
          clientAllowedFormats: ['png', 'jpg', 'jpeg', 'gif', 'webp'],
          maxFileSize: 8000000,
          folder: 'news',
          styles: {
            palette: {
              window: '#FFFFFF',
              windowBorder: '#90A0B3',
              tabIcon: '#0078FF',
              menuIcons: '#5A616A',
              textDark: '#000000',
              textLight: '#FFFFFF',
              link: '#0078FF',
              action: '#02554D',
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
            console.error('News image upload error:', error);
            setIsLoading(false);
            return;
          }

          if (result.event === 'success') {
            onUploadSuccess(result.info.secure_url);
            setIsLoading(false);
          }
        }
      );
    };

    if (window.cloudinary) {
      initializeWidget();
    } else {
      script.addEventListener('load', initializeWidget);
    }

    return () => {
      script.removeEventListener?.('load', initializeWidget);
      if (!existingScript && script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [onUploadSuccess]);

  const handleOpen = () => {
    if (!widgetRef.current) return;
    setIsLoading(true);
    widgetRef.current.open();
  };

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
        {currentImageUrl ? (
          <div className="relative aspect-[16/9] w-full">
            <Image
              src={currentImageUrl}
              alt="Nieuwsafbeelding"
              fill
              className="object-cover"
            />
          </div>
        ) : (
          <div className="flex aspect-[16/9] items-center justify-center text-sm text-gray-500">
            Nog geen headerafbeelding
          </div>
        )}

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleOpen}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          disabled={isLoading}
        >
          {currentImageUrl ? 'Vervang afbeelding' : 'Upload afbeelding'}
        </button>

        {currentImageUrl && (
          <button
            type="button"
            onClick={() => onUploadSuccess('')}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            Verwijder afbeelding
          </button>
        )}
      </div>
    </div>
  );
}
