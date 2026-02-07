/**
 * Drive Embedder - Plugin Settings
 */

import { DriveEmbedderSettings } from './types';

export const DEFAULT_SETTINGS: DriveEmbedderSettings = {
    // Google OAuth
    googleClientId: '',
    googleClientSecret: '',
    googleAccessToken: '',
    googleRefreshToken: '',
    tokenExpiresAt: 0,

    // OAuth redirect port
    oauthRedirectPort: 8586,

    // Drive settings
    driveFolder: 'Obsidian/DriveEmbedder',

    // Embed settings
    showTitleByDefault: true,
    defaultTheme: 'auto',

    // Default sizes per category
    defaultVideoSize: 'medium',
    defaultDocumentSize: 'medium',
    defaultImageSize: 'medium',
    defaultAudioSize: 'slim'
};
