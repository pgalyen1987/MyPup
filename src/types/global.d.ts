/**
 * global.d.ts
 * Global type declarations
 */

export {};

declare global {
    interface Window {
        // Character Manager
        characterManager?: import('../character.js').CharacterManager;

        // Debug utilities
        clearBackgroundCache?: () => Promise<void>;
        getAssetStatus?: () => {
            characterManager: {
                sprite: boolean;
                background: boolean;
                canStart: boolean;
            };
            backgroundFramesLength: number;
            backgroundMeta: string | null;
            hasCustomCharacter: string | null;
        };
        clearAllCaches?: () => Promise<void>;
        retryBackgroundGeneration?: () => Promise<void>;
        updateDebugIndicators?: () => void;
        testGeminiModels?: () => Promise<void>;
    }
}