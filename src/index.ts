import 'dotenv/config';
import fs from 'node:fs';
import type { WfsMelding } from './types/WfsMelding.js';
import type { Melding } from './types/Melding.js';
import * as notifier from './notifiers/index.js';

const WFS_HOST = process.env.IM_WFS_HOST;
const WFS_POLL_RATE = Number(process.env.IM_WFS_POLL_RATE);
const FILTER_RAYONS: string[] = process.env.IM_FILTER_RAYON
    ? process.env.IM_FILTER_RAYON.split(',')
    : [];

const FILTER_CITIES: string[] = process.env.IM_FILTER_CITY
    ? process.env.IM_FILTER_CITY.split(',')
    : [];

notifier.initialise();

if (!WFS_HOST || !WFS_POLL_RATE) {
    console.error(
        'Missing required environment variables. Please check your .env file.'
    );
    process.exit(1);
}

console.log(
    `IM bot started: pulling from "${WFS_HOST}" every ${WFS_POLL_RATE} seconds.`
);
if(FILTER_CITIES.length > 0) {
    console.log(
        `Filtering meldingen for cities: ${FILTER_CITIES.join(', ')}`
    );
} else {
    console.log(
        'No city filtering applied.'
    );
}

if(FILTER_RAYONS.length > 0) {
    console.log(
        `Filtering meldingen for rayons: ${FILTER_RAYONS.join(', ')}`
    );
} else {
    console.log(
        'No rayon filtering applied.'
    );
}

function getLast5Meldingen(): string[] {
    try {
        if (!fs.existsSync('last5meldingen.json')) {
            fs.writeFileSync(
                'last5meldingen.json',
                JSON.stringify([])
            );
        }

        const data = fs.readFileSync(
            'last5meldingen.json',
            'utf8'
        );

        return JSON.parse(data) as string[];
    } catch (err) {
        console.error(
            'Error reading last5meldingen.json:',
            err
        );

        return [];
    }
}

function saveLast5Meldingen(meldingen: string[]): void {
    try {
        if (meldingen.length > 5) {
            meldingen = meldingen.slice(0, 5);
        }

        fs.writeFileSync(
            'last5meldingen.json',
            JSON.stringify(meldingen, null, 2)
        );
    } catch (err) {
        console.error(
            'Error writing last5meldingen.json:',
            err
        );
    }
}

type WfsResponse = {
    features: Array<{
        properties: WfsMelding;
    }>;
};

/**
 * Fetches data from the WFS service and processes the meldingen.
 */
async function fetchData(): Promise<void> {
    try {
        const response = await fetch(
            `${WFS_HOST}?service=WFS&request=GetFeature&typename=meldingen:actueel&version=1.1.0&srsname=EPSG:4326&outputFormat=application/json`
        );

        if (!response.ok) {
            throw new Error(
                `WFS request failed: ${response.status} ${response.statusText}`
            );
        }

        const data = await response.json() as WfsResponse;

        const meldingen = data.features
            .map(feature => feature.properties)
            .sort((a, b) => {
                const order = [
                    'een',
                    'twee',
                    'drie',
                    'vier',
                    'vijf'
                ];

                return (
                    order.indexOf(b.nummer) -
                    order.indexOf(a.nummer)
                );
            });

        let last5Meldingen = getLast5Meldingen();

        for (const melding of meldingen) {
            // We already handled this melding.
            if (last5Meldingen.includes(melding.meldnr)) {
                continue;
            }

            const matchedMelding = await matchQuery(melding);

            if (!matchedMelding) {
                continue;
            }

            const sent = await notifier.notify(matchedMelding);

            if (!sent) {
                console.error(
                    `Melding ${melding.meldnr} could not be sent.`
                );

                continue;
            }

            console.info(
                `Melding ${melding.meldnr} successfully sent to ${process.env.NOTIFY_CHANNELS}`
            );

            last5Meldingen = [
                melding.meldnr,
                ...last5Meldingen
            ].slice(0, 5);

            saveLast5Meldingen(last5Meldingen);
        }
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

/**
 * Checks whether a melding matches the configured query.
 */
async function matchQuery(
    melding: WfsMelding
): Promise<Melding | false> {
    if (
        FILTER_RAYONS.length > 0 &&
        !FILTER_RAYONS.includes(melding.rayon)
    ) {
        return false; // Filter by rayon first to avoid unnecessary Photon requests.
    }

    const photon = await getPhotonStreet(
        melding.latitude,
        melding.longitude
    );

    if (!photon) {
        return false;
    }

    if (
        FILTER_CITIES.length > 0 &&
        !FILTER_CITIES.includes(photon.city)
    ) {
        return false;
    }

    return {
        ...melding,
        datum: new Date(melding.datum + melding.tijdstip),
        photon
    };
}

type PhotonProperties = {
    street?: string;
    name?: string;
    city?: string;
};

type PhotonResponse = {
    features: Array<{
        properties: PhotonProperties;
    }>;
};

async function getPhotonStreet(
    lat: number,
    lon: number
): Promise<Melding['photon'] | null> {
    const PHOTON_HOST = process.env.PHOTON_HOST;

    if (!PHOTON_HOST) {
        throw new Error('PHOTON_HOST is not configured');
    }

    const response = await fetch(
        `${PHOTON_HOST}/reverse?lat=${lat}&lon=${lon}&layer=street`
    );

    if (!response.ok) {
        throw new Error(
            `Photon request failed: ${response.status} ${response.statusText}`
        );
    }

    const json = await response.json() as PhotonResponse;
    const properties = json.features[0]?.properties;

    if (!properties) {
        return null;
    }

    return {
        name: properties.street ?? properties.name ?? '',
        city: properties.city ?? ''
    };
}

fetchData();

setInterval(fetchData, WFS_POLL_RATE * 1000);