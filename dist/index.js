"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const node_fs_1 = __importDefault(require("node:fs"));
const notifier = __importStar(require("./notifiers/index.js"));
const WFS_HOST = process.env.IM_WFS_HOST;
const WFS_POLL_RATE = Number(process.env.IM_WFS_POLL_RATE);
const FILTER_RAYONS = process.env.IM_FILTER_RAYON
    ? process.env.IM_FILTER_RAYON.split(',')
    : [];
const FILTER_CITIES = process.env.IM_FILTER_CITY
    ? process.env.IM_FILTER_CITY.split(',')
    : [];
notifier.initialise();
if (!WFS_HOST || !WFS_POLL_RATE) {
    console.error('Missing required environment variables. Please check your .env file.');
    process.exit(1);
}
console.log(`IM bot started: pulling from "${WFS_HOST}" every ${WFS_POLL_RATE} seconds.`);
if (FILTER_CITIES.length > 0) {
    console.log(`Filtering meldingen for cities: ${FILTER_CITIES.join(', ')}`);
}
else {
    console.log('No city filtering applied.');
}
if (FILTER_RAYONS.length > 0) {
    console.log(`Filtering meldingen for rayons: ${FILTER_RAYONS.join(', ')}`);
}
else {
    console.log('No rayon filtering applied.');
}
function getLast5Meldingen() {
    try {
        if (!node_fs_1.default.existsSync('last5meldingen.json')) {
            node_fs_1.default.writeFileSync('last5meldingen.json', JSON.stringify([]));
        }
        const data = node_fs_1.default.readFileSync('last5meldingen.json', 'utf8');
        return JSON.parse(data);
    }
    catch (err) {
        console.error('Error reading last5meldingen.json:', err);
        return [];
    }
}
function saveLast5Meldingen(meldingen) {
    try {
        if (meldingen.length > 5) {
            meldingen = meldingen.slice(0, 5);
        }
        node_fs_1.default.writeFileSync('last5meldingen.json', JSON.stringify(meldingen, null, 2));
    }
    catch (err) {
        console.error('Error writing last5meldingen.json:', err);
    }
}
/**
 * Fetches data from the WFS service and processes the meldingen.
 */
async function fetchData() {
    try {
        const response = await fetch(`${WFS_HOST}?service=WFS&request=GetFeature&typename=meldingen:actueel&version=1.1.0&srsname=EPSG:4326&outputFormat=application/json`);
        if (!response.ok) {
            throw new Error(`WFS request failed: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
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
            return (order.indexOf(b.nummer) -
                order.indexOf(a.nummer));
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
                console.error(`Melding ${melding.meldnr} could not be sent.`);
                continue;
            }
            console.info(`Melding ${melding.meldnr} successfully sent to ${process.env.NOTIFY_CHANNELS}`);
            last5Meldingen = [
                melding.meldnr,
                ...last5Meldingen
            ].slice(0, 5);
            saveLast5Meldingen(last5Meldingen);
        }
    }
    catch (error) {
        console.error('Error fetching data:', error);
    }
}
/**
 * Checks whether a melding matches the configured query.
 */
async function matchQuery(melding) {
    if (FILTER_RAYONS.length > 0 &&
        !FILTER_RAYONS.includes(melding.rayon)) {
        return false; // Filter by rayon first to avoid unnecessary Photon requests.
    }
    const photon = await getPhotonStreet(melding.latitude, melding.longitude);
    if (!photon) {
        return false;
    }
    if (FILTER_CITIES.length > 0 &&
        !FILTER_CITIES.includes(photon.city)) {
        return false;
    }
    return {
        ...melding,
        datum: new Date(melding.datum + melding.tijdstip),
        photon
    };
}
async function getPhotonStreet(lat, lon) {
    const PHOTON_HOST = process.env.PHOTON_HOST;
    if (!PHOTON_HOST) {
        throw new Error('PHOTON_HOST is not configured');
    }
    const response = await fetch(`${PHOTON_HOST}/reverse?lat=${lat}&lon=${lon}&layer=street`);
    if (!response.ok) {
        throw new Error(`Photon request failed: ${response.status} ${response.statusText}`);
    }
    const json = await response.json();
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
