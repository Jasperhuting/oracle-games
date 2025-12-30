// Dit script toont de Firestore set commando's om de renners toe te voegen
// We kunnen deze niet direct uitvoeren via dit script, maar via de MCP Firebase tools

const GAME_ID = 'qltELoRHMvweHzhM26bN';
const USER_ID = 'YxTaYrQSeiQ9b0jeQ1JXJHf4oH72';

const winnersToAdd = [
  { riderNameId: 'joao-almeida', riderName: 'João Almeida', pricePaid: 2450 },
  { riderNameId: 'davide-piganzoli', riderName: 'Davide Piganzoli', pricePaid: 712 },
  { riderNameId: 'senna-remijn', riderName: 'Senna Remijn', pricePaid: 132 },
  { riderNameId: 'markel-beloki', riderName: 'Markel Beloki', pricePaid: 122 },
  { riderNameId: 'pavel-novak', riderName: 'Pavel Novák', pricePaid: 167 },
  { riderNameId: 'georg-steinhauser', riderName: 'Georg Steinhauser', pricePaid: 165 },
  { riderNameId: 'luke-tuckwell', riderName: 'Luke Tuckwell', pricePaid: 62 },
];

const acquiredAt = '2025-12-19T16:32:53.718Z';

winnersToAdd.forEach(rider => {
  const doc = {
    gameId: GAME_ID,
    userId: USER_ID,
    riderNameId: rider.riderNameId,
    acquiredAt: acquiredAt,
    acquisitionType: 'auction',
    pricePaid: rider.pricePaid,
    riderName: rider.riderName,
    riderTeam: '',
    riderCountry: '',
    jerseyImage: '',
    active: true,
    benched: false,
    pointsScored: 0,
    stagesParticipated: 0,
  };

  console.log(`\n// ${rider.riderName}`);
  console.log(JSON.stringify(doc, null, 2));
});
