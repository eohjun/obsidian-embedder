/**
 * Type declarations for Electron modules used in Obsidian
 * Obsidian runs in Electron environment, so these modules are available at runtime
 */

declare module 'electron' {
    export const shell: {
        openExternal(url: string): Promise<void>;
    };
}
