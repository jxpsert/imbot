"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requiredEnvVars = void 0;
exports.notify = notify;
exports.requiredEnvVars = [
    'DISCORD_WEBHOOK_URL'
];
async function notify(melding) {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
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
        const response = await fetch(webhookUrl, {
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
            console.error(`Discord error: ${response.status} ${response.statusText}`);
            return false;
        }
        return true;
    }
    catch (error) {
        console.error('Discord error:', error);
        return false;
    }
}
