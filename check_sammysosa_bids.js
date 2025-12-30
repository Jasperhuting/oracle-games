// Analyse sammysosa's biedingen uit activity logs
// Laatste actieve biedingen op 19 dec 2025, 16:32

const sammysosaFinalBids = [
  { rider: 'João Almeida', riderNameId: 'joao-almeida', amount: 2450 },
  { rider: 'Florian Lipowitz', riderNameId: 'florian-lipowitz', amount: 1351 },
  { rider: 'Davide Piganzoli', riderNameId: 'davide-piganzoli', amount: 712 },
  { rider: 'Paul Lapeira', riderNameId: 'paul-lapeira', amount: 535 },
  { rider: 'Iván Romeo', riderNameId: 'ivan-romeo', amount: 523 },
  { rider: 'Pavel Novák', riderNameId: 'pavel-novak', amount: 167 },
  { rider: 'Georg Steinhauser', riderNameId: 'georg-steinhauser', amount: 165 },
  { rider: 'Senna Remijn', riderNameId: 'senna-remijn', amount: 132 },
  { rider: 'Markel Beloki', riderNameId: 'markel-beloki', amount: 122 },
  { rider: 'Luke Tuckwell', riderNameId: 'luke-tuckwell', amount: 62 },
  { rider: 'Peter Øxenberg', riderNameId: 'peter-oxenberg-hansen', amount: 55 },
];

// Gebaseerd op Firebase query resultaten:
const currentWinners = {
  'joao-almeida': null, // Geen bids gevonden - waarschijnlijk nog niet gewonnen
  'florian-lipowitz': { player: 'TI Reppie', amount: 1634 }, // sammysosa verloor (1351 < 1634)
  'davide-piganzoli': null, // Geen andere bids gevonden - sammysosa zou winnen!
  'paul-lapeira': { player: 'TI Reppie', amount: 589 }, // sammysosa verloor (535 < 589)
  'ivan-romeo': { player: 'TI Reppie', amount: 622 }, // sammysosa verloor (523 < 622)
  'pavel-novak': null, // Nog te checken
  'georg-steinhauser': null, // Nog te checken
  'senna-remijn': { highestOther: 99 }, // sammysosa zou winnen! (132 > 99)
  'markel-beloki': { highestOther: 86 }, // sammysosa zou winnen! (122 > 86)
  'luke-tuckwell': null, // Nog te checken
  'peter-oxenberg-hansen': { player: 'BrackenRidgeCycling', amount: 103 }, // sammysosa verloor (55 < 103)
};

console.log('Sammysosa zou deze renners gewonnen hebben:');
console.log('============================================\n');

sammysosaFinalBids.forEach(bid => {
  const winner = currentWinners[bid.riderNameId];

  if (!winner || (winner.highestOther && bid.amount > winner.highestOther)) {
    console.log(`✓ ${bid.rider} - €${bid.amount}`);
  }
});

console.log('\nSammysosa zou deze renners NIET gewonnen hebben:');
console.log('=================================================\n');

sammysosaFinalBids.forEach(bid => {
  const winner = currentWinners[bid.riderNameId];

  if (winner && winner.player) {
    console.log(`✗ ${bid.rider} - €${bid.amount} (verloren aan ${winner.player} met €${winner.amount})`);
  }
});
