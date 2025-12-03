/**
 * Drive Embedder - Size Presets
 * Intuitive size options with Korean labels
 */

import { ContentCategory, SizeOption, SupportedFileType } from './types';

/**
 * Size presets per content category
 * Designed for non-developers with intuitive labels
 */
export const SIZE_PRESETS: Record<ContentCategory, SizeOption[]> = {
    video: [
        {
            id: 'compact',
            label: '아담하게',
            icon: '🔹',
            description: '본문 중간에 삽입하기 좋은 크기',
            width: '60%',
            height: '280px'
        },
        {
            id: 'medium',
            label: '적당히 크게',
            icon: '🔸',
            description: '일반적인 시청에 적합',
            width: '80%',
            height: '400px',
            recommended: true
        },
        {
            id: 'large',
            label: '크게',
            icon: '🔶',
            description: '상세 확인이 필요할 때',
            width: '100%',
            height: '500px'
        },
        {
            id: 'fullwidth',
            label: '아주 크게',
            icon: '🟠',
            description: '몰입감 있는 시청',
            width: '100%',
            height: '600px'
        }
    ],
    document: [
        {
            id: 'compact',
            label: '아담하게',
            icon: '🔹',
            description: '간단한 미리보기용',
            width: '70%',
            height: '400px'
        },
        {
            id: 'medium',
            label: '적당히 크게',
            icon: '🔸',
            description: '문서 읽기에 적합',
            width: '100%',
            height: '500px',
            recommended: true
        },
        {
            id: 'large',
            label: '크게',
            icon: '🔶',
            description: '편안한 열람',
            width: '100%',
            height: '650px'
        },
        {
            id: 'fullwidth',
            label: '아주 크게',
            icon: '🟠',
            description: '전체 화면 문서 뷰어',
            width: '100%',
            height: '800px'
        }
    ],
    image: [
        {
            id: 'thumbnail',
            label: '썸네일',
            icon: '🔹',
            description: '작은 미리보기 이미지',
            width: '200px',
            height: 'auto'
        },
        {
            id: 'compact',
            label: '아담하게',
            icon: '🔸',
            description: '본문에 어울리는 크기',
            width: '400px',
            height: 'auto'
        },
        {
            id: 'medium',
            label: '적당히 크게',
            icon: '🔶',
            description: '이미지 확인에 적합',
            width: '600px',
            height: 'auto',
            recommended: true
        },
        {
            id: 'large',
            label: '크게',
            icon: '🟠',
            description: '상세 보기용',
            width: '100%',
            height: 'auto'
        }
    ],
    audio: [
        {
            id: 'slim',
            label: '슬림',
            icon: '🎵',
            description: '최소 공간 차지',
            width: '100%',
            height: '100px',
            recommended: true
        },
        {
            id: 'standard',
            label: '표준',
            icon: '🎶',
            description: '약간의 여백 포함',
            width: '100%',
            height: '120px'
        }
    ]
};

/**
 * Supported file types with their categories and metadata
 */
export const SUPPORTED_FILE_TYPES: SupportedFileType[] = [
    // Video
    { extension: '.mp4', mimeType: 'video/mp4', category: 'video', icon: '🎬', label: 'MP4 비디오' },
    { extension: '.webm', mimeType: 'video/webm', category: 'video', icon: '🎬', label: 'WebM 비디오' },
    { extension: '.mov', mimeType: 'video/quicktime', category: 'video', icon: '🎬', label: 'QuickTime 비디오' },
    { extension: '.avi', mimeType: 'video/x-msvideo', category: 'video', icon: '🎬', label: 'AVI 비디오' },

    // Audio
    { extension: '.mp3', mimeType: 'audio/mpeg', category: 'audio', icon: '🎵', label: 'MP3 오디오' },
    { extension: '.wav', mimeType: 'audio/wav', category: 'audio', icon: '🎵', label: 'WAV 오디오' },
    { extension: '.ogg', mimeType: 'audio/ogg', category: 'audio', icon: '🎵', label: 'OGG 오디오' },
    { extension: '.m4a', mimeType: 'audio/mp4', category: 'audio', icon: '🎵', label: 'M4A 오디오' },

    // Document
    { extension: '.pdf', mimeType: 'application/pdf', category: 'document', icon: '📄', label: 'PDF 문서' },

    // Image
    { extension: '.jpg', mimeType: 'image/jpeg', category: 'image', icon: '🖼️', label: 'JPEG 이미지' },
    { extension: '.jpeg', mimeType: 'image/jpeg', category: 'image', icon: '🖼️', label: 'JPEG 이미지' },
    { extension: '.png', mimeType: 'image/png', category: 'image', icon: '🖼️', label: 'PNG 이미지' },
    { extension: '.gif', mimeType: 'image/gif', category: 'image', icon: '🖼️', label: 'GIF 이미지' },
    { extension: '.webp', mimeType: 'image/webp', category: 'image', icon: '🖼️', label: 'WebP 이미지' },
    { extension: '.svg', mimeType: 'image/svg+xml', category: 'image', icon: '🖼️', label: 'SVG 이미지' }
];

/**
 * Get file type info from filename
 */
export function getFileTypeInfo(fileName: string): SupportedFileType | null {
    const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
    return SUPPORTED_FILE_TYPES.find(ft => ft.extension === ext) || null;
}

/**
 * Get size presets for a category
 */
export function getSizePresets(category: ContentCategory): SizeOption[] {
    return SIZE_PRESETS[category] || SIZE_PRESETS.document;
}

/**
 * Get recommended size for a category
 */
export function getRecommendedSize(category: ContentCategory): SizeOption {
    const presets = getSizePresets(category);
    return presets.find(p => p.recommended) || presets[0];
}

/**
 * Get size by ID for a category
 */
export function getSizeById(category: ContentCategory, sizeId: string): SizeOption {
    const presets = getSizePresets(category);
    return presets.find(p => p.id === sizeId) || getRecommendedSize(category);
}

/**
 * Check if file is supported
 */
export function isFileSupported(fileName: string): boolean {
    return getFileTypeInfo(fileName) !== null;
}

/**
 * Get supported extensions as string for file input
 */
export function getSupportedExtensions(): string {
    return SUPPORTED_FILE_TYPES.map(ft => ft.extension).join(',');
}

/**
 * Supported extensions array for file input accept attribute
 */
export const SUPPORTED_EXTENSIONS: string[] = SUPPORTED_FILE_TYPES.map(ft => ft.extension);

/**
 * Get category icon
 */
export function getCategoryIcon(category: ContentCategory): string {
    const icons: Record<ContentCategory, string> = {
        video: '🎬',
        audio: '🎵',
        document: '📄',
        image: '🖼️'
    };
    return icons[category];
}

/**
 * Get category label
 */
export function getCategoryLabel(category: ContentCategory): string {
    const labels: Record<ContentCategory, string> = {
        video: '비디오',
        audio: '오디오',
        document: '문서',
        image: '이미지'
    };
    return labels[category];
}
