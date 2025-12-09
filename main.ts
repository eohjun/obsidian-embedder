/**
 * Drive Embedder - Main Plugin
 * Upload local files to Google Drive and embed them in Obsidian notes
 */

import { Plugin, PluginSettingTab, App, Setting, Notice, Editor, MarkdownView } from 'obsidian';
import { DriveEmbedderSettings } from './src/types';
import { DEFAULT_SETTINGS } from './src/settings';
import { GoogleOAuthFlow } from './src/google-oauth-flow';
import { GoogleDriveUploader } from './src/uploader';
import { UploadModal, UploadModalResult } from './src/upload-modal';
import { EmbedGenerator } from './src/embed-generator';

export default class DriveEmbedderPlugin extends Plugin {
    settings: DriveEmbedderSettings;
    private oauthFlow: GoogleOAuthFlow | null = null;
    private uploader: GoogleDriveUploader | null = null;
    private embedGenerator: EmbedGenerator;

    async onload() {
        await this.loadSettings();

        this.embedGenerator = new EmbedGenerator();

        // Initialize OAuth and uploader if credentials exist
        this.initializeServices();

        // Add ribbon icon
        this.addRibbonIcon('cloud-upload', 'Drive Embedder: Upload file', () => {
            this.openUploadModal();
        });

        // Add command
        this.addCommand({
            id: 'upload-and-embed',
            name: 'Upload file and embed',
            editorCallback: (editor: Editor, view: MarkdownView) => {
                this.openUploadModal(editor);
            }
        });

        // Add settings tab
        this.addSettingTab(new DriveEmbedderSettingTab(this.app, this));

        console.debug('Drive Embedder loaded');
    }

    onunload() {
        console.debug('Drive Embedder unloaded');
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        this.initializeServices();
    }

    private initializeServices() {
        if (this.settings.googleClientId && this.settings.googleClientSecret) {
            this.oauthFlow = new GoogleOAuthFlow({
                clientId: this.settings.googleClientId,
                clientSecret: this.settings.googleClientSecret,
                redirectPort: 8586
            });

            if (this.settings.googleAccessToken) {
                this.uploader = new GoogleDriveUploader({
                    clientId: this.settings.googleClientId,
                    clientSecret: this.settings.googleClientSecret,
                    accessToken: this.settings.googleAccessToken,
                    refreshToken: this.settings.googleRefreshToken,
                    tokenExpiresAt: this.settings.tokenExpiresAt,
                    onTokenRefresh: async (tokens) => {
                        this.settings.googleAccessToken = tokens.accessToken;
                        this.settings.googleRefreshToken = tokens.refreshToken;
                        this.settings.tokenExpiresAt = tokens.expiresAt;
                        await this.saveSettings();
                    }
                });
            }
        }
    }

    async startOAuthFlow(): Promise<boolean> {
        if (!this.oauthFlow) {
            new Notice('Please enter Google OAuth settings first.');
            return false;
        }

        try {
            const tokens = await this.oauthFlow.startOAuthFlow();

            this.settings.googleAccessToken = tokens.accessToken;
            this.settings.googleRefreshToken = tokens.refreshToken;
            this.settings.tokenExpiresAt = tokens.expiresAt;
            await this.saveSettings();

            new Notice('✅ Google Drive connected successfully!');
            return true;
        } catch (error) {
            console.error('OAuth flow failed:', error);
            const message = error instanceof Error ? error.message : String(error);
            new Notice(`❌ connection failed: ${message}`);
            return false;
        }
    }

    async disconnectGoogleDrive() {
        this.settings.googleAccessToken = '';
        this.settings.googleRefreshToken = '';
        this.settings.tokenExpiresAt = 0;
        this.uploader = null;
        await this.saveSettings();
        new Notice('Google Drive disconnected.');
    }

    isConnected(): boolean {
        return !!this.settings.googleAccessToken && !!this.uploader;
    }

    private openUploadModal(editor?: Editor) {
        if (!this.isConnected()) {
            new Notice('Please connect to Google Drive first. (Connect in settings)');
            return;
        }

        if (!this.uploader) {
            new Notice('Uploader initialization failed. Please check settings.');
            return;
        }

        new UploadModal(
            this.app,
            this.uploader,
            this.settings.driveFolder,
            this.settings.showTitleByDefault,
            (result: UploadModalResult) => {
                void (async () => {
                    const embedCode = this.embedGenerator.generateEmbed(
                        result.file.name,
                        result.uploadResult,
                        result.embedOptions
                    );

                    if (editor) {
                        // Insert at cursor position
                        editor.replaceSelection(embedCode);
                    } else {
                        // Copy to clipboard
                        await navigator.clipboard.writeText(embedCode);
                        new Notice('📋 embed code copied to clipboard!');
                    }
                })();
            }
        ).open();
    }
}

class DriveEmbedderSettingTab extends PluginSettingTab {
    plugin: DriveEmbedderPlugin;

    constructor(app: App, plugin: DriveEmbedderPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        // Main heading removed per Obsidian guidelines (no plugin name in settings)

        // Connection status
        this.createConnectionSection(containerEl);

        // OAuth Settings
        this.createOAuthSection(containerEl);

        // Drive Settings
        this.createDriveSection(containerEl);

        // Embed Settings
        this.createEmbedSection(containerEl);

        // Help section
        this.createHelpSection(containerEl);
    }

    private createConnectionSection(containerEl: HTMLElement) {
        const connectionDiv = containerEl.createDiv({ cls: 'drive-embedder-connection-section' });

        const isConnected = this.plugin.isConnected();

        new Setting(connectionDiv)
            .setName('Connection status')
            .setHeading();

        const statusDiv = connectionDiv.createDiv({ cls: 'connection-status' });
        if (isConnected) {
            statusDiv.createSpan({ cls: 'status-connected', text: '✅ Google Drive connected' });
        } else {
            statusDiv.createSpan({ cls: 'status-disconnected', text: '❌ not connected' });
        }

        if (isConnected) {
            new Setting(connectionDiv)
                .setName('Disconnect')
                .setDesc('Disconnect from Google Drive')
                .addButton(button => button
                    .setButtonText('Disconnect')
                    .setWarning()
                    .onClick(() => {
                        void this.plugin.disconnectGoogleDrive().then(() => {
                            this.display();
                        });
                    })
                );
        } else {
            new Setting(connectionDiv)
                .setName('Connect to Google Drive')
                .setDesc('Enter OAuth settings below, then click Connect')
                .addButton(button => button
                    .setButtonText('Connect')
                    .setCta()
                    .onClick(() => {
                        void this.plugin.startOAuthFlow().then((success) => {
                            if (success) {
                                this.display();
                            }
                        });
                    })
                );
        }
    }

    private createOAuthSection(containerEl: HTMLElement) {
        new Setting(containerEl)
            .setName('Google OAuth')
            .setHeading();

        new Setting(containerEl)
            .setName('Client ID')
            .setDesc('OAuth client ID from Google Cloud Console')
            .addText(text => text
                .setPlaceholder('xxx.apps.googleusercontent.com')
                .setValue(this.plugin.settings.googleClientId)
                .onChange((value) => {
                    this.plugin.settings.googleClientId = value;
                    void this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('Client secret')
            .setDesc('OAuth client secret from Google Cloud Console')
            .addText(text => text
                .setPlaceholder('GOCSPX-...')
                .setValue(this.plugin.settings.googleClientSecret)
                .onChange((value) => {
                    this.plugin.settings.googleClientSecret = value;
                    void this.plugin.saveSettings();
                })
            );
    }

    private createDriveSection(containerEl: HTMLElement) {
        new Setting(containerEl)
            .setName('Google Drive')
            .setHeading();

        new Setting(containerEl)
            .setName('Upload folder')
            .setDesc('Google Drive folder path for uploaded files')
            .addText(text => text
                .setPlaceholder('Obsidian/DriveEmbedder')
                .setValue(this.plugin.settings.driveFolder)
                .onChange((value) => {
                    this.plugin.settings.driveFolder = value;
                    void this.plugin.saveSettings();
                })
            );
    }

    private createEmbedSection(containerEl: HTMLElement) {
        new Setting(containerEl)
            .setName('Embed defaults')
            .setHeading();

        new Setting(containerEl)
            .setName('Show filename by default')
            .setDesc('Display filename in embed code by default')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showTitleByDefault)
                .onChange((value) => {
                    this.plugin.settings.showTitleByDefault = value;
                    void this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('Default theme')
            .setDesc('Default embed theme (auto-detects system theme)')
            .addDropdown(dropdown => dropdown
                .addOption('auto', 'Auto (follows system)')
                .addOption('light', 'Light')
                .addOption('dark', 'Dark')
                .setValue(this.plugin.settings.defaultTheme)
                .onChange((value: 'auto' | 'light' | 'dark') => {
                    this.plugin.settings.defaultTheme = value;
                    void this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('Default embed size')
            .setHeading();

        new Setting(containerEl)
            .setName('Default video size')
            .addDropdown(dropdown => dropdown
                .addOption('compact', 'Compact')
                .addOption('medium', 'Medium')
                .addOption('large', 'Large')
                .addOption('fullwidth', 'Full width')
                .setValue(this.plugin.settings.defaultVideoSize)
                .onChange((value) => {
                    this.plugin.settings.defaultVideoSize = value;
                    void this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('Default audio size')
            .addDropdown(dropdown => dropdown
                .addOption('slim', 'Slim')
                .addOption('standard', 'Standard')
                .setValue(this.plugin.settings.defaultAudioSize)
                .onChange((value) => {
                    this.plugin.settings.defaultAudioSize = value;
                    void this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('Default document size')
            .addDropdown(dropdown => dropdown
                .addOption('compact', 'Compact')
                .addOption('medium', 'Medium')
                .addOption('large', 'Large')
                .addOption('fullheight', 'Full height')
                .setValue(this.plugin.settings.defaultDocumentSize)
                .onChange((value) => {
                    this.plugin.settings.defaultDocumentSize = value;
                    void this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('Default image size')
            .addDropdown(dropdown => dropdown
                .addOption('small', 'Small')
                .addOption('medium', 'Medium')
                .addOption('large', 'Large')
                .addOption('original', 'Original size')
                .setValue(this.plugin.settings.defaultImageSize)
                .onChange((value) => {
                    this.plugin.settings.defaultImageSize = value;
                    void this.plugin.saveSettings();
                })
            );
    }

    private createHelpSection(containerEl: HTMLElement) {
        new Setting(containerEl)
            .setName('Help')
            .setHeading();

        const helpDiv = containerEl.createDiv({ cls: 'drive-embedder-help' });

        // OAuth setup guide
        const oauthDetails = helpDiv.createEl('details');
        const oauthSummary = oauthDetails.createEl('summary');
        oauthSummary.createEl('strong', { text: '📋 how to set up Google OAuth' });
        const oauthList = oauthDetails.createEl('ol');
        const oauthStep1 = oauthList.createEl('li');
        oauthStep1.appendText('Go to ');
        oauthStep1.createEl('a', { text: 'Google Cloud Console', href: 'https://console.cloud.google.com', attr: { target: '_blank' } });
        oauthList.createEl('li', { text: 'Create a new project or select an existing one' });
        oauthList.createEl('li', { text: 'Go to APIs & services → OAuth consent screen and configure' });
        oauthList.createEl('li', { text: 'Go to APIs & services → Credentials → Create credentials → OAuth client ID' });
        oauthList.createEl('li', { text: 'Select application type: desktop app' });
        oauthList.createEl('li', { text: 'Enter the generated client ID and client secret in the settings above' });
        oauthList.createEl('li', { text: 'Enable Google Drive API' });

        // Supported formats
        const formatsDetails = helpDiv.createEl('details');
        const formatsSummary = formatsDetails.createEl('summary');
        formatsSummary.createEl('strong', { text: '🎬 supported file formats' });
        const formatsList = formatsDetails.createEl('ul');
        const videoLi = formatsList.createEl('li');
        videoLi.createEl('strong', { text: 'Video: ' });
        videoLi.appendText('MP4, WebM, MOV, AVI');
        const audioLi = formatsList.createEl('li');
        audioLi.createEl('strong', { text: 'Audio: ' });
        audioLi.appendText('MP3, WAV, OGG, M4A');
        const docLi = formatsList.createEl('li');
        docLi.createEl('strong', { text: 'Document: ' });
        docLi.appendText('PDF');
        const imageLi = formatsList.createEl('li');
        imageLi.createEl('strong', { text: 'Image: ' });
        imageLi.appendText('JPG, PNG, GIF, WebP, SVG');

        // Size guide
        const sizeDetails = helpDiv.createEl('details');
        const sizeSummary = sizeDetails.createEl('summary');
        sizeSummary.createEl('strong', { text: '📐 embed size guide' });
        const sizeList = sizeDetails.createEl('ul');
        const compactLi = sizeList.createEl('li');
        compactLi.createEl('strong', { text: 'Compact: ' });
        compactLi.appendText('Good size for inline content');
        const mediumLi = sizeList.createEl('li');
        mediumLi.createEl('strong', { text: 'Medium: ' });
        mediumLi.appendText('Suitable for general viewing (recommended)');
        const largeLi = sizeList.createEl('li');
        largeLi.createEl('strong', { text: 'Large: ' });
        largeLi.appendText('When detailed view is needed');
        const fullLi = sizeList.createEl('li');
        fullLi.createEl('strong', { text: 'Full width: ' });
        fullLi.appendText('Immersive full-width display');

        // How to use
        const howtoDetails = helpDiv.createEl('details');
        const howtoSummary = howtoDetails.createEl('summary');
        howtoSummary.createEl('strong', { text: '🔗 how to use' });
        const howtoList = howtoDetails.createEl('ol');
        howtoList.createEl('li', { text: 'Click the cloud icon in the sidebar or search "Drive Embedder" in the command palette' });
        howtoList.createEl('li', { text: 'Select a file (drag & drop or use the file picker button)' });
        howtoList.createEl('li', { text: 'Choose your desired embed size' });
        howtoList.createEl('li', { text: 'Click the "Upload and embed" button' });
        howtoList.createEl('li', { text: 'The embed code will be automatically inserted after upload' });
    }
}
