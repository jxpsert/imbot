"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initialise = initialise;
exports.notify = notify;
const CHANNEL = process.env.NOTIFY_CHANNEL || 'discord';
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const REQUIRED_ENV_VARS = {
    discord: ['DISCORD_WEBHOOK_URL'],
};
/**
 * Check whether the required environment variables for the selected channel
 * are set. If not, log an error and exit the process.
 */
function initialise() {
    const requiredVars = REQUIRED_ENV_VARS[CHANNEL];
    if (!requiredVars) {
        console.error(`Unknown channel: ${CHANNEL}`);
        process.exit(1);
    }
    const missingVars = requiredVars.filter((varName) => !process.env[varName]);
    if (missingVars.length > 0) {
        console.error(`Missing required environment variables for ${CHANNEL}: ${missingVars.join(', ')}`);
        process.exit(1);
    }
}
/**
 * Send a notification for the given melding to the selected channel.
 */
async function notify(melding) {
    switch (CHANNEL) {
        case 'discord':
            return await notifyDiscord(melding);
        default:
            console.error(`Unknown channel: ${CHANNEL}`);
            return false;
    }
}
async function notifyDiscord(melding) {
    if (!DISCORD_WEBHOOK_URL) {
        console.error('DISCORD_WEBHOOK_URL is not set.');
        return false;
    }
    const location = melding.wegnr
        ? `${melding.bps.trim()}${melding.photon.city ? ` (${melding.photon.city})` : ''}`
        : `${melding.photon.name}${melding.photon.city ? `, ${melding.photon.city}` : ''}`;
    const osmUrl = `https://www.openstreetmap.org/?mlat=${melding.latitude}` +
        `&mlon=${melding.longitude}` +
        `#map=18/${melding.latitude}/${melding.longitude}`;
    const embed = {
        title: `${melding.incident_type} — ${melding.meldnr}`,
        url: osmUrl,
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
                name: 'Melder',
                value: melding.melder || 'Onbekend',
                inline: true
            }
        ],
        footer: {
            text: `Rayon ${melding.rayon}`
        }
    };
    try {
        const response = await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: `${melding.incident_type} — ${location}`,
                embeds: [embed]
            })
        });
        if (!response.ok) {
            console.error('Error sending message to Discord:', response.statusText);
            return false;
        }
        return true;
    }
    catch (error) {
        console.error('Error sending message to Discord:', error);
        return false;
    }
}
