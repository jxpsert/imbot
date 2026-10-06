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
Object.defineProperty(exports, "__esModule", { value: true });
exports.initialise = initialise;
exports.notify = notify;
const discord = __importStar(require("./discord.js"));
const pushover = __importStar(require("./pushover.js"));
const CHANNELS = (process.env.NOTIFY_CHANNELS || 'discord')
    .split(',')
    .map(channel => channel.trim())
    .filter(Boolean);
const notifiers = {
    discord,
    pushover
};
function isChannel(channel) {
    return channel in notifiers;
}
function initialise() {
    for (const channel of CHANNELS) {
        if (!isChannel(channel)) {
            console.error(`Unknown notification channel: ${channel}`);
            process.exit(1);
        }
        const missingVars = notifiers[channel].requiredEnvVars.filter(varName => !process.env[varName]);
        if (missingVars.length > 0) {
            console.error(`Missing required environment variables for ${channel}: ${missingVars.join(', ')}`);
            process.exit(1);
        }
    }
}
async function notify(melding) {
    const results = await Promise.all(CHANNELS.map(channel => {
        if (!isChannel(channel)) {
            return false;
        }
        return notifiers[channel].notify(melding);
    }));
    return results.every(Boolean);
}
