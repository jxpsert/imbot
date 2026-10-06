import type { WfsMelding } from './WfsMelding.js';

export type Melding = Omit<WfsMelding, 'datum'> & {
    datum: Date;

    photon: {
        name: string;
        city: string;
    };
};