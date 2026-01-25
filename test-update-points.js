// Test script om renner punten te geven
// Pas de waarden hieronder aan en voer dit uit in je browser console

async function updateRiderPoints(riderNameId, pointsScored, gameId = null) {
  try {
    const response = await fetch('/api/admin/update-rider-points', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        riderNameId,
        pointsScored,
        gameId // null = alle games, specifieke gameId = alleen die game
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Succes:', result.message);
      console.log('Bijgewerkte renners:', result.riders);
    } else {
      console.error('❌ Fout:', result.error);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Network error:', error);
  }
}

// Voorbeelden - kopieer en plak wat je nodig hebt:

// Voorbeeld 1: Geef Axel Zingle 100 punten in alle games
// updateRiderPoints('axel-zingle', 100);

// Voorbeeld 2: Geef Dylan van Baarle 50 punten in specifieke game
// updateRiderPoints('dylan-van-baarle', 50, 'tG5QrMUSMBsbqfKa36Ii');

// Voorbeeld 3: Reset een renner naar 0 punten
// updateRiderPoints('fabio-jakobsen', 0);

console.log('Gebruik: updateRiderPoints("riderNameId", punten, "gameId (optioneel)");');
console.log('Voorbeeld: updateRiderPoints("axel-zingle", 100);');
