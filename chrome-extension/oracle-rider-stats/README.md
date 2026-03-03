# Oracle Rider Stats (Chrome extensie)

Deze extensie draait op Oracle Games op `/rankings/season/2026` en toont ProCyclingStats-gegevens via een knop per renner.

## Installatie (unpacked)

1. Open `chrome://extensions`.
2. Zet `Developer mode` aan.
3. Klik `Load unpacked`.
4. Selecteer deze map:
   - `/Users/jasperhuting/Documents/projecten/oracle games/oracle-games/chrome-extension/oracle-rider-stats`

## Gebruik

1. Open Oracle Games op `/rankings/season/2026`.
2. Klik op `PCS stats` naast een renner.
3. Rechtsonder verschijnt een paneel met stats van ProCyclingStats.

## Betrouwbaarheid verbeteren (optioneel)

De extensie werkt al met tekstdetectie, maar wordt nog betrouwbaarder als een klikbaar element een van deze attributen heeft:

- `data-rider-id="tadej-pogacar"` (voorkeur)
- `data-rider-name="Tadej Pogacar"`
- `data-rider-slug="tadej-pogacar"`

Dan gebruikt de extensie exact die waarde voor de PCS-opvraag.
