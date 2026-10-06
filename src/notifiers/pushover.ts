import type { Melding } from '../types/Melding.js';

export const requiredEnvVars = [
    'PUSHOVER_TOKEN',
    'PUSHOVER_USER_KEY'
];

export async function notify(melding: Melding): Promise<boolean> {
    const token = process.env.PUSHOVER_TOKEN;
    const user = process.env.PUSHOVER_USER_KEY;

    if (!token || !user) {
        return false;
    }

    const location = melding.wegnr
        ? `${melding.bps.trim()}${melding.photon.city ? ` (${melding.photon.city})` : ''}`
        : `${melding.photon.name}${melding.photon.city ? `, ${melding.photon.city}` : ''}`;

    const osmUrl =
        `https://www.openstreetmap.org/?mlat=${melding.latitude}` +
        `&mlon=${melding.longitude}` +
        `#map=18/${melding.latitude}/${melding.longitude}`;

    try {
        const response = await fetch(
            'https://api.pushover.net/1/messages.json',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    token,
                    user,
                    title: `${melding.incident_type} — ${melding.meldnr}`,
                    message: [
                        location,
                        `Gemeld: ${melding.tijdstip.substring(0, 5)}`,
                        `Berger: ${melding.berger || 'Onbekend'}`,
                        `Melder: ${melding.melder || 'Onbekend'}`
                    ].join('\n'),
                    url: osmUrl,
                    url_title: 'OpenStreetMap'
                })
            }
        );

        if (!response.ok) {
            console.error(
                `Pushover error: ${response.status} ${response.statusText}`
            );

            return false;
        }

        return true;
    } catch (error) {
        console.error('Pushover error:', error);
        return false;
    }
}