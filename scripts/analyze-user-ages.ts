/**
 * Script to analyze user birth dates and ages
 * Run with: npx tsx scripts/analyze-user-ages.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccountPath = '/Users/jasperhuting/serviceAccountKey.json';

const app = initializeApp({
  credential: cert(serviceAccountPath),
});

const db = getFirestore(app);

interface UserAgeData {
  playername: string;
  dateOfBirth: string;
  age: number;
  birthYear: number;
  birthMonth: number;
}

function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birth = new Date(dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function getMonthName(month: number): string {
  const months = [
    'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
    'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'
  ];
  return months[month];
}

async function analyzeUserAges() {
  console.log('📊 Gebruikers Leeftijdsanalyse - Oracle Games\n');
  console.log('='.repeat(70));

  const usersSnapshot = await db.collection('users').get();
  console.log(`\nTotaal aantal gebruikers: ${usersSnapshot.docs.length}`);

  const usersWithDob: UserAgeData[] = [];
  const usersWithoutDob: string[] = [];

  for (const doc of usersSnapshot.docs) {
    const data = doc.data();
    if (data.dateOfBirth) {
      const age = calculateAge(data.dateOfBirth);
      const birth = new Date(data.dateOfBirth);
      usersWithDob.push({
        playername: data.playername || data.email || doc.id,
        dateOfBirth: data.dateOfBirth,
        age,
        birthYear: birth.getFullYear(),
        birthMonth: birth.getMonth(),
      });
    } else {
      usersWithoutDob.push(data.playername || data.email || doc.id);
    }
  }

  console.log(`Gebruikers met geboortedatum: ${usersWithDob.length}`);
  console.log(`Gebruikers zonder geboortedatum: ${usersWithoutDob.length}`);

  if (usersWithDob.length === 0) {
    console.log('\n⚠️  Geen gebruikers met geboortedatum gevonden!');
    return;
  }

  // Sort by age (oldest first)
  usersWithDob.sort((a, b) => b.age - a.age);

  // === GEMIDDELDE LEEFTIJD ===
  const totalAge = usersWithDob.reduce((sum, u) => sum + u.age, 0);
  const avgAge = totalAge / usersWithDob.length;
  const medianAge = usersWithDob[Math.floor(usersWithDob.length / 2)].age;

  console.log('\n' + '='.repeat(70));
  console.log('📈 STATISTIEKEN');
  console.log('='.repeat(70));
  console.log(`  Gemiddelde leeftijd:  ${avgAge.toFixed(1)} jaar`);
  console.log(`  Mediaan leeftijd:     ${medianAge} jaar`);
  console.log(`  Jongste leeftijd:     ${usersWithDob[usersWithDob.length - 1].age} jaar`);
  console.log(`  Oudste leeftijd:      ${usersWithDob[0].age} jaar`);

  // === OUDSTE & JONGSTE ===
  console.log('\n' + '='.repeat(70));
  console.log('🏆 OUDSTE GEBRUIKER');
  console.log('='.repeat(70));
  const oldest = usersWithDob[0];
  console.log(`  ${oldest.playername} — ${oldest.age} jaar (geboren: ${oldest.dateOfBirth})`);

  console.log('\n' + '='.repeat(70));
  console.log('👶 JONGSTE GEBRUIKER');
  console.log('='.repeat(70));
  const youngest = usersWithDob[usersWithDob.length - 1];
  console.log(`  ${youngest.playername} — ${youngest.age} jaar (geboren: ${youngest.dateOfBirth})`);

  // === LEEFTIJDSVERDELING ===
  console.log('\n' + '='.repeat(70));
  console.log('📊 LEEFTIJDSVERDELING (per 5 jaar)');
  console.log('='.repeat(70));

  const ageBuckets: Record<string, number> = {};
  for (const user of usersWithDob) {
    const bucketStart = Math.floor(user.age / 5) * 5;
    const bucketEnd = bucketStart + 4;
    const key = `${bucketStart}-${bucketEnd}`;
    ageBuckets[key] = (ageBuckets[key] || 0) + 1;
  }

  const maxCount = Math.max(...Object.values(ageBuckets));
  const barWidth = 40;

  // Sort buckets by age range
  const sortedBuckets = Object.entries(ageBuckets).sort((a, b) => {
    return parseInt(a[0].split('-')[0]) - parseInt(b[0].split('-')[0]);
  });

  for (const [range, count] of sortedBuckets) {
    const barLength = Math.round((count / maxCount) * barWidth);
    const bar = '█'.repeat(barLength) + '░'.repeat(barWidth - barLength);
    const percentage = ((count / usersWithDob.length) * 100).toFixed(1);
    console.log(`  ${range.padStart(6)} jaar  ${bar}  ${String(count).padStart(3)} (${percentage}%)`);
  }

  // === GEBOORTEMAAND VERDELING ===
  console.log('\n' + '='.repeat(70));
  console.log('📅 GEBOORTEMAAND VERDELING');
  console.log('='.repeat(70));

  const monthBuckets: Record<number, number> = {};
  for (let i = 0; i < 12; i++) monthBuckets[i] = 0;
  for (const user of usersWithDob) {
    monthBuckets[user.birthMonth]++;
  }

  const maxMonthCount = Math.max(...Object.values(monthBuckets));

  for (let i = 0; i < 12; i++) {
    const count = monthBuckets[i];
    const barLength = Math.round((count / maxMonthCount) * barWidth);
    const bar = '█'.repeat(barLength) + '░'.repeat(barWidth - barLength);
    const percentage = ((count / usersWithDob.length) * 100).toFixed(1);
    console.log(`  ${getMonthName(i).padStart(11)}  ${bar}  ${String(count).padStart(3)} (${percentage}%)`);
  }

  // === GEBOORTEJAAR VERDELING ===
  console.log('\n' + '='.repeat(70));
  console.log('📅 GEBOORTEJAAR VERDELING');
  console.log('='.repeat(70));

  const yearBuckets: Record<number, number> = {};
  for (const user of usersWithDob) {
    yearBuckets[user.birthYear] = (yearBuckets[user.birthYear] || 0) + 1;
  }

  const maxYearCount = Math.max(...Object.values(yearBuckets));
  const sortedYears = Object.entries(yearBuckets).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

  for (const [year, count] of sortedYears) {
    const barLength = Math.round((count / maxYearCount) * barWidth);
    const bar = '█'.repeat(barLength) + '░'.repeat(barWidth - barLength);
    const percentage = ((count / usersWithDob.length) * 100).toFixed(1);
    console.log(`  ${year}  ${bar}  ${String(count).padStart(3)} (${percentage}%)`);
  }

  // === GENERATIE VERDELING ===
  console.log('\n' + '='.repeat(70));
  console.log('👥 GENERATIE VERDELING');
  console.log('='.repeat(70));

  const generations: Record<string, { count: number; users: string[] }> = {
    'Baby Boomers (1946-1964)': { count: 0, users: [] },
    'Generatie X (1965-1980)': { count: 0, users: [] },
    'Millennials (1981-1996)': { count: 0, users: [] },
    'Generatie Z (1997-2012)': { count: 0, users: [] },
    'Generatie Alpha (2013+)': { count: 0, users: [] },
  };

  for (const user of usersWithDob) {
    if (user.birthYear <= 1964) {
      generations['Baby Boomers (1946-1964)'].count++;
      generations['Baby Boomers (1946-1964)'].users.push(user.playername);
    } else if (user.birthYear <= 1980) {
      generations['Generatie X (1965-1980)'].count++;
      generations['Generatie X (1965-1980)'].users.push(user.playername);
    } else if (user.birthYear <= 1996) {
      generations['Millennials (1981-1996)'].count++;
      generations['Millennials (1981-1996)'].users.push(user.playername);
    } else if (user.birthYear <= 2012) {
      generations['Generatie Z (1997-2012)'].count++;
      generations['Generatie Z (1997-2012)'].users.push(user.playername);
    } else {
      generations['Generatie Alpha (2013+)'].count++;
      generations['Generatie Alpha (2013+)'].users.push(user.playername);
    }
  }

  const maxGenCount = Math.max(...Object.values(generations).map(g => g.count));

  for (const [gen, data] of Object.entries(generations)) {
    if (data.count === 0) continue;
    const barLength = Math.round((data.count / maxGenCount) * barWidth);
    const bar = '█'.repeat(barLength) + '░'.repeat(barWidth - barLength);
    const percentage = ((data.count / usersWithDob.length) * 100).toFixed(1);
    console.log(`  ${gen.padEnd(30)}  ${bar}  ${String(data.count).padStart(3)} (${percentage}%)`);
  }

  // === ALLE GEBRUIKERS GESORTEERD OP LEEFTIJD ===
  console.log('\n' + '='.repeat(70));
  console.log('📋 ALLE GEBRUIKERS (gesorteerd op leeftijd, oudste eerst)');
  console.log('='.repeat(70));
  console.log(`  ${'#'.padStart(3)}  ${'Speler'.padEnd(25)} ${'Leeftijd'.padStart(8)}  Geboortedatum`);
  console.log('  ' + '-'.repeat(65));

  for (let i = 0; i < usersWithDob.length; i++) {
    const u = usersWithDob[i];
    console.log(`  ${String(i + 1).padStart(3)}  ${u.playername.padEnd(25)} ${String(u.age).padStart(5)} jr  ${u.dateOfBirth}`);
  }

  // === GEBRUIKERS ZONDER GEBOORTEDATUM ===
  if (usersWithoutDob.length > 0) {
    console.log('\n' + '='.repeat(70));
    console.log(`⚠️  GEBRUIKERS ZONDER GEBOORTEDATUM (${usersWithoutDob.length})`);
    console.log('='.repeat(70));
    for (const name of usersWithoutDob) {
      console.log(`  - ${name}`);
    }
  }

  // === LEUK FEITJES ===
  console.log('\n' + '='.repeat(70));
  console.log('🎉 LEUKE FEITJES');
  console.log('='.repeat(70));

  // Leeftijdsverschil oudste en jongste
  const ageDiff = oldest.age - youngest.age;
  console.log(`  📏 Leeftijdsverschil oudste en jongste: ${ageDiff} jaar`);

  // Meest voorkomende geboortejaar
  const mostCommonYear = sortedYears.reduce((a, b) => (parseInt(b[1] as any) > parseInt(a[1] as any) ? b : a));
  console.log(`  📅 Meest voorkomende geboortejaar: ${mostCommonYear[0]} (${mostCommonYear[1]} gebruikers)`);

  // Meest voorkomende geboortemaand
  const mostCommonMonth = Object.entries(monthBuckets).reduce((a, b) => (b[1] > a[1] ? b : a));
  console.log(`  📅 Meest voorkomende geboortemaand: ${getMonthName(parseInt(mostCommonMonth[0]))} (${mostCommonMonth[1]} gebruikers)`);

  // Wie is binnenkort jarig?
  const today = new Date();
  const upcoming = usersWithDob
    .map(u => {
      const birth = new Date(u.dateOfBirth);
      const nextBday = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
      if (nextBday < today) nextBday.setFullYear(nextBday.getFullYear() + 1);
      const daysUntil = Math.ceil((nextBday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return { ...u, daysUntil };
    })
    .sort((a, b) => a.daysUntil - b.daysUntil);

  console.log(`\n  🎂 Eerstvolgende verjaardagen:`);
  for (let i = 0; i < Math.min(5, upcoming.length); i++) {
    const u = upcoming[i];
    const bday = new Date(u.dateOfBirth);
    const day = bday.getDate();
    const month = getMonthName(bday.getMonth());
    console.log(`     ${u.playername} — ${day} ${month} (over ${u.daysUntil} dagen, wordt ${u.age + 1})`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ Analyse voltooid!');
  console.log('='.repeat(70));
}

analyzeUserAges()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
