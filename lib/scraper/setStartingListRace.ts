import * as cheerio from 'cheerio';

export async function setStartingListRace({year, race}: {year: number, race: string}) {

    const url = `https://www.procyclingstats.com/race.php?id1=${race}&id2=${year}&p=startlist`;

    const res = await fetch(url, { 
        headers: { 'User-Agent': 'Mozilla/5.0 (Node Script)' } 
    });
    
    if (!res.ok) {
        throw new Error(`Request failed: ${res.status} ${res.statusText}`);
    }
    
    const html = await res.text();
    const $ = cheerio.load(html);

    const riders: Array<{name: string, dnf?: number, dns?: number}> = [];
    
$('ul.startlist_v4').find('li').each((i, el) => {
    const $li = $(el);
    const $a = $li.find('a').not('.team');
    const aHref = $a.attr('href')?.split('/');
    const isRider = aHref?.[0] === 'rider';
    const rider = aHref?.[1];
    
    if (rider && isRider) {
        const liText = $li.text();
        const riderData: {name: string, dnf?: number, dns?: number} = { name: rider };
        
        // Check for DNF with number: (DNF #10)
        const dnfMatch = liText.match(/DNF\s*#(\d+)/);
        if (dnfMatch) {
            riderData.dnf = parseInt(dnfMatch[1], 10);
        }
        
        // Check for DNS with number: (DNS #10)
        const dnsMatch = liText.match(/DNS\s*#(\d+)/);
        if (dnsMatch) {
            riderData.dns = parseInt(dnsMatch[1], 10);
        }
        
        riders.push(riderData);
    }
})

return {
    riders: riders,
    race: race,
    year: year,
    scrapedAt: new Date().toISOString(),
};
}
