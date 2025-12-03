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
        this.addRibbonIcon('cloud-upload', 'Drive Embedder: 파일 업로드', () => {
            this.openUploadModal();
        });

        // Add command
        this.addCommand({
            id: 'upload-and-embed',
            name: '파일 업로드 & 임베드',
            editorCallback: (editor: Editor, view: MarkdownView) => {
                this.openUploadModal(editor);
            }
        });

        // Add settings tab
        this.addSettingTab(new DriveEmbedderSettingTab(this.app, this));

        console.log('Drive Embedder loaded');
    }

    onunload() {
        console.log('Drive Embedder unloaded');
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
            new Notice('Google OAuth 설정을 먼저 입력해주세요.');
            return false;
        }

        try {
            const tokens = await this.oauthFlow.startOAuthFlow();

            this.settings.googleAccessToken = tokens.accessToken;
            this.settings.googleRefreshToken = tokens.refreshToken;
            this.settings.tokenExpiresAt = tokens.expiresAt;
            await this.saveSettings();

            new Notice('✅ Google Drive 연결 완료!');
            return true;
        } catch (error: any) {
            console.error('OAuth flow failed:', error);
            new Notice(`❌ 연결 실패: ${error.message}`);
            return false;
        }
    }

    async disconnectGoogleDrive() {
        this.settings.googleAccessToken = '';
        this.settings.googleRefreshToken = '';
        this.settings.tokenExpiresAt = 0;
        this.uploader = null;
        await this.saveSettings();
        new Notice('Google Drive 연결이 해제되었습니다.');
    }

    isConnected(): boolean {
        return !!this.settings.googleAccessToken && !!this.uploader;
    }

    private openUploadModal(editor?: Editor) {
        if (!this.isConnected()) {
            new Notice('먼저 Google Drive에 연결해주세요. (설정에서 연결)');
            return;
        }

        if (!this.uploader) {
            new Notice('업로더 초기화 실패. 설정을 확인해주세요.');
            return;
        }

        new UploadModal(
            this.app,
            this.uploader,
            this.settings.driveFolder,
            this.settings.showTitleByDefault,
            async (result: UploadModalResult) => {
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
                    new Notice('📋 임베드 코드가 클립보드에 복사되었습니다!');
                }
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

        containerEl.createEl('h2', { text: 'Drive Embedder 설정' });

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

        connectionDiv.createEl('h3', { text: '연결 상태' });

        const statusDiv = connectionDiv.createDiv({ cls: 'connection-status' });
        statusDiv.innerHTML = isConnected
            ? '<span class="status-connected">✅ Google Drive 연결됨</span>'
            : '<span class="status-disconnected">❌ 연결 안됨</span>';

        if (isConnected) {
            new Setting(connectionDiv)
                .setName('연결 해제')
                .setDesc('Google Drive 연결을 해제합니다')
                .addButton(button => button
                    .setButtonText('연결 해제')
                    .setWarning()
                    .onClick(async () => {
                        await this.plugin.disconnectGoogleDrive();
                        this.display();
                    })
                );
        } else {
            new Setting(connectionDiv)
                .setName('Google Drive 연결')
                .setDesc('아래에 OAuth 설정을 입력한 후 연결 버튼을 클릭하세요')
                .addButton(button => button
                    .setButtonText('연결하기')
                    .setCta()
                    .onClick(async () => {
                        const success = await this.plugin.startOAuthFlow();
                        if (success) {
                            this.display();
                        }
                    })
                );
        }
    }

    private createOAuthSection(containerEl: HTMLElement) {
        containerEl.createEl('h3', { text: 'Google OAuth 설정' });

        new Setting(containerEl)
            .setName('Client ID')
            .setDesc('Google Cloud Console에서 생성한 OAuth Client ID')
            .addText(text => text
                .setPlaceholder('xxx.apps.googleusercontent.com')
                .setValue(this.plugin.settings.googleClientId)
                .onChange(async (value) => {
                    this.plugin.settings.googleClientId = value;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('Client Secret')
            .setDesc('Google Cloud Console에서 생성한 OAuth Client Secret')
            .addText(text => text
                .setPlaceholder('GOCSPX-...')
                .setValue(this.plugin.settings.googleClientSecret)
                .onChange(async (value) => {
                    this.plugin.settings.googleClientSecret = value;
                    await this.plugin.saveSettings();
                })
            );
    }

    private createDriveSection(containerEl: HTMLElement) {
        containerEl.createEl('h3', { text: 'Google Drive 설정' });

        new Setting(containerEl)
            .setName('업로드 폴더')
            .setDesc('파일이 업로드될 Google Drive 폴더 경로')
            .addText(text => text
                .setPlaceholder('Obsidian/DriveEmbedder')
                .setValue(this.plugin.settings.driveFolder)
                .onChange(async (value) => {
                    this.plugin.settings.driveFolder = value;
                    await this.plugin.saveSettings();
                })
            );
    }

    private createEmbedSection(containerEl: HTMLElement) {
        containerEl.createEl('h3', { text: '임베드 설정' });

        new Setting(containerEl)
            .setName('파일명 기본 표시')
            .setDesc('임베드 코드에 파일명을 기본으로 표시합니다')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showTitleByDefault)
                .onChange(async (value) => {
                    this.plugin.settings.showTitleByDefault = value;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('기본 테마')
            .setDesc('임베드 기본 테마 (시스템 테마 자동 감지)')
            .addDropdown(dropdown => dropdown
                .addOption('auto', '자동 (시스템 테마)')
                .addOption('light', '라이트')
                .addOption('dark', '다크')
                .setValue(this.plugin.settings.defaultTheme)
                .onChange(async (value: 'auto' | 'light' | 'dark') => {
                    this.plugin.settings.defaultTheme = value;
                    await this.plugin.saveSettings();
                })
            );

        containerEl.createEl('h4', { text: '기본 임베드 크기' });

        new Setting(containerEl)
            .setName('동영상 기본 크기')
            .addDropdown(dropdown => dropdown
                .addOption('compact', '아담하게')
                .addOption('medium', '적당히 크게')
                .addOption('large', '크게')
                .addOption('fullwidth', '아주 크게')
                .setValue(this.plugin.settings.defaultVideoSize)
                .onChange(async (value) => {
                    this.plugin.settings.defaultVideoSize = value;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('오디오 기본 크기')
            .addDropdown(dropdown => dropdown
                .addOption('slim', '슬림')
                .addOption('standard', '표준')
                .setValue(this.plugin.settings.defaultAudioSize)
                .onChange(async (value) => {
                    this.plugin.settings.defaultAudioSize = value;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('문서 기본 크기')
            .addDropdown(dropdown => dropdown
                .addOption('compact', '아담하게')
                .addOption('medium', '적당히 크게')
                .addOption('large', '크게')
                .addOption('fullheight', '전체 높이')
                .setValue(this.plugin.settings.defaultDocumentSize)
                .onChange(async (value) => {
                    this.plugin.settings.defaultDocumentSize = value;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('이미지 기본 크기')
            .addDropdown(dropdown => dropdown
                .addOption('small', '작게')
                .addOption('medium', '중간')
                .addOption('large', '크게')
                .addOption('original', '원본 크기')
                .setValue(this.plugin.settings.defaultImageSize)
                .onChange(async (value) => {
                    this.plugin.settings.defaultImageSize = value;
                    await this.plugin.saveSettings();
                })
            );
    }

    private createHelpSection(containerEl: HTMLElement) {
        containerEl.createEl('h3', { text: '도움말' });

        const helpDiv = containerEl.createDiv({ cls: 'drive-embedder-help' });

        helpDiv.innerHTML = `
            <details>
                <summary><strong>📋 Google OAuth 설정 방법</strong></summary>
                <ol>
                    <li><a href="https://console.cloud.google.com" target="_blank">Google Cloud Console</a>에 접속</li>
                    <li>새 프로젝트 생성 또는 기존 프로젝트 선택</li>
                    <li>APIs & Services → OAuth consent screen 설정</li>
                    <li>APIs & Services → Credentials → Create Credentials → OAuth Client ID</li>
                    <li>Application type: Desktop app 선택</li>
                    <li>생성된 Client ID와 Client Secret을 위 설정에 입력</li>
                    <li>Google Drive API 활성화 필요</li>
                </ol>
            </details>

            <details>
                <summary><strong>🎬 지원 파일 형식</strong></summary>
                <ul>
                    <li><strong>동영상:</strong> MP4, WebM, MOV, AVI</li>
                    <li><strong>오디오:</strong> MP3, WAV, OGG, M4A</li>
                    <li><strong>문서:</strong> PDF</li>
                    <li><strong>이미지:</strong> JPG, PNG, GIF, WebP, SVG</li>
                </ul>
            </details>

            <details>
                <summary><strong>📐 임베드 크기 가이드</strong></summary>
                <ul>
                    <li><strong>아담하게:</strong> 본문 중간에 삽입하기 좋은 크기</li>
                    <li><strong>적당히 크게:</strong> 일반적인 시청/확인에 적합 (추천)</li>
                    <li><strong>크게:</strong> 상세 확인이 필요할 때</li>
                    <li><strong>아주 크게:</strong> 몰입감 있는 전체 폭 표시</li>
                </ul>
            </details>

            <details>
                <summary><strong>🔗 사용 방법</strong></summary>
                <ol>
                    <li>사이드바의 구름 아이콘 클릭 또는 명령어 팔레트에서 "Drive Embedder" 검색</li>
                    <li>파일 선택 (드래그&드롭 또는 파일 선택 버튼)</li>
                    <li>원하는 임베드 크기 선택</li>
                    <li>"업로드 & 임베드" 버튼 클릭</li>
                    <li>업로드 완료 후 임베드 코드가 자동으로 삽입됩니다</li>
                </ol>
            </details>
        `;
    }
}
