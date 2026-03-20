"use client";

interface BercBikePopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BercBikePopup({ isOpen, onClose }: BercBikePopupProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/berc-bike-logo.jpg"
              alt="Berc Bikes"
              className="w-12 h-12 object-contain"
            />
            <h2 className="text-lg font-bold text-gray-900">Speel mee voor de prijzen</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 cursor-pointer"
            aria-label="Sluiten"
          >
            ✕
          </button>
        </div>
        <div className="mt-4 text-sm text-gray-700 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="space-y-2">
            <div className="font-semibold text-gray-900">1e prijs</div>
            <div>&#39;Bike &amp; Pancakes&#39; arrangement voor 4 personen.</div>
            <div className="text-xs text-gray-500">(met fietsverhuur, navigatie, helm, bidon, vignet &amp; buffje*)</div>
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <img
                src="https://bercbike.nl/wp-content/uploads/2023/02/gravelbike-huren-montferland-1024x683.jpg"
                alt="1e prijs - Bike & Pancakes arrangement"
                className="w-full h-40 object-cover"
                loading="lazy"
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="font-semibold text-gray-900">2e prijs</div>
            <div>Gravel arrangement voor 2 personen.</div>
            <div className="text-xs text-gray-500">(met fietsverhuur, navigatie, helm, bidon, vignet &amp; buffje*)</div>
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <img
                src="https://bercbike.nl/wp-content/uploads/2021/11/mtb-verhuur-zeddam-montferland.jpg"
                alt="2e prijs - Gravel arrangement"
                className="w-full h-40 object-cover"
                loading="lazy"
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="font-semibold text-gray-900">3e prijs</div>
            <div>&#39;Proefritje&#39; te nuttigen in het wielercafe in Zeddam</div>
            <div className="text-xs text-gray-500">(3 speciaalbiertjes geserveerd met lokale kaas &amp; worst)</div>
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <img
                src="https://bercbike.nl/wp-content/uploads/2021/07/achterhoekse-bieren-wielercafe-1024x1024.jpg"
                alt="3e prijs - Proefritje"
                className="w-full h-40 object-cover"
                loading="lazy"
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="font-semibold text-gray-900">4e &amp; 5e prijs</div>
            <div>een &#39;Veloholic&#39; shirt</div>
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <img
                src="https://res.cloudinary.com/dtkg71eih/image/upload/v1771949728/wielershirt_z4m8wc.jpg"
                alt="4e en 5e prijs - Veloholic shirt"
                className="w-full h-40 object-cover"
                loading="lazy"
              />
            </div>
          </div>
          <div className="text-xs text-gray-500">
            * Het buffje mag je houden als aandenken aan een leuke sportieve middag!
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 cursor-pointer"
          >
            Sluiten
          </button>
          <a
            href="https://buymeacoffee.com/oraclegames"
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-center"
          >
            Betaal €5
          </a>
        </div>
      </div>
    </div>
  );
}
