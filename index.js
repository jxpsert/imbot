require('dotenv').config();
const fs = require('fs');
const WFS_HOST = process.env.IM_WFS_HOST; // URL without query parameters
const WFS_POLL_RATE = process.env.IM_WFS_POLL_RATE; // in seconds
const QUERY_CITIES = process.env.IM_QUERY_CITIES ? process.env.IM_QUERY_CITIES.split(',') : [];
const WEBHOOK_URL = process.env.WEBHOOK_URL;

if (!WFS_HOST || !WFS_POLL_RATE || !WEBHOOK_URL) {
    console.error('Missing required environment variables. Please check your .env file.');
    process.exit(1);
}

console.log(`IM bot started: pulling from "${WFS_HOST}" every ${WFS_POLL_RATE} seconds.`);
console.log(`Watching cities: ${QUERY_CITIES.length > 0 ? QUERY_CITIES.join(', ') : '-'}`);

function getLast5Meldingen() {
    try {
        if (!fs.existsSync('last5meldingen.json')) {
            fs.writeFileSync('last5meldingen.json', JSON.stringify([]));
        }

        const data = fs.readFileSync('last5meldingen.json', 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error reading last5meldingen.json:', err);
        return [];
    }
}

function saveLast5Meldingen(meldingen) {
    try {
        if (meldingen.length > 5) {
            meldingen = meldingen.slice(0, 5);
        }
        fs.writeFileSync('last5meldingen.json', JSON.stringify(meldingen, null, 2));
    } catch (err) {
        console.error('Error writing last5meldingen.json:', err);
    }
}

/**
 * Fetches data from the WFS service and logs the meldingen to the console
 */
async function fetchData() {
    try {
        const response = await fetch(`${WFS_HOST}?service=WFS&request=GetFeature&typename=meldingen:actueel&version=1.1.0&srsname=EPSG:4326&outputFormat=application/json`);
        const data = await response.json();
        const meldingen = data.features.map(feature => feature.properties).sort((a, b) => {
            const order = ['een', 'twee', 'drie', 'vier', 'vijf'];
            return order.indexOf(a.meldnr) - order.indexOf(b.meldnr);
        }).reverse();

        meldingen.forEach(async (melding) => {
            const matchesQuery = await matchQuery(melding);

            if (getLast5Meldingen().includes(melding.meldnr) && matchesQuery) {
                return;
            }

            if (!getLast5Meldingen().includes(melding.meldnr) && matchesQuery) {
                saveLast5Meldingen([melding.meldnr, ...getLast5Meldingen()]);
                spreadMelding(matchesQuery); // Has photon info now
            }
        });
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

/**
 * Whether or not the melding matches the meldings we want to receive
 * @param {*} melding 
 * @returns {*} melding with photon info if the melding matches, false otherwise
 */
async function matchQuery(melding) {
    if (melding.rayon != 'GL264') return false;

    const photon = await getPhotonStreet(melding.latitude, melding.longitude);

    if (!photon) return false;
    if (QUERY_CITIES.length > 0 && !QUERY_CITIES.includes(photon.city)) return false;

    melding.datum = new Date(melding.datum + melding.tijdstip);

    return { ...melding, photon };
}

async function getPhotonStreet(lat, lon) {
    const response = await fetch(`${process.env.PHOTON_HOST}/reverse?lat=${lat}&lon=${lon}&layer=street`);
    const json = await response.json();
    return json.features[0]?.properties || null;
}

function spreadMelding(melding) {
    const location = melding.wegnr
        ? `${melding.bps.trim()}${melding.photon.city ? ` (${melding.photon.city})` : ''}`
        : `${melding.photon.name}${melding.photon.city ? `, ${melding.photon.city}` : ''}`;

    const aankomst = melding.aankomst !== "Onbek" ? melding.aankomst.substring(0, 5) : 'Onbekend';

    const embed = {
        title: `${melding.incident_type} — ${melding.meldnr}`,
        description: `**${location}**`,
        color: melding.incident_type === 'Ongeval'
            ? 0xED4245
            : melding.incident_type === 'Pech'
                ? 0xFEE75C
                : 0x5865F2,
        fields: [
            {
                name: 'Gemeld',
                value: melding.tijdstip.substring(0, 5),
                inline: true
            },
            {
                name: 'Berger',
                value: melding.berger || 'Onbekend',
                inline: true
            },
            {
                name: 'Verwacht',
                value: aankomst,
                inline: true
            }
        ],
        footer: {
            text: `Rayon ${melding.rayon}`
        }
    };

    fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            embeds: [embed]
        })
    })
        .then(response => {
            if (!response.ok) {
                console.error(
                    'Error sending message to Discord:',
                    response.statusText
                );
            }
        })
        .catch(error => {
            console.error('Error sending message to Discord:', error);
        });

    console.info(`Melding ${melding.meldnr} sent`);
}

fetchData(); // Initial fetch on startup

setInterval(fetchData, WFS_POLL_RATE * 1000);