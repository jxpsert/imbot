import type { Melding } from '../types/Melding.js';

import * as discord from './discord.js';
import * as pushover from './pushover.js';

const CHANNELS = (process.env.NOTIFY_CHANNELS || 'discord')
    .split(',')
    .map(channel => channel.trim())
    .filter(Boolean);

const notifiers = {
    discord,
    pushover
};

type Channel = keyof typeof notifiers;

function isChannel(channel: string): channel is Channel {
    return channel in notifiers;
}

export function initialise(): void {
    for (const channel of CHANNELS) {
        if (!isChannel(channel)) {
            console.error(`Unknown notification channel: ${channel}`);
            process.exit(1);
        }

        const missingVars = notifiers[channel].requiredEnvVars.filter(
            varName => !process.env[varName]
        );

        if (missingVars.length > 0) {
            console.error(
                `Missing required environment variables for ${channel}: ${missingVars.join(', ')}`
            );

            process.exit(1);
        }
    }
}

export async function notify(melding: Melding): Promise<boolean> {
    const results = await Promise.all(
        CHANNELS.map(channel => {
            if (!isChannel(channel)) {
                return false;
            }

            return notifiers[channel].notify(melding);
        })
    );

    return results.every(Boolean);
}