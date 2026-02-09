/**
 * game/types.ts
 * Shared type definitions for game modules
 */

export type PhaserScene = any;
export type PhaserGame = any;
export type PhaserSprite = any;
export type PhaserGroup = any;
export type PhaserTimerEvent = any;

export interface GameState {
    score: number;
    lives: number;
    level: number;
    isGameOver: boolean;
    isPaused: boolean;
}

export interface MobileInput {
    left: boolean;
    right: boolean;
    jump: boolean;
}

export interface PlatformConfig {
    x: number;
    y: number;
    width: number;
}

export interface CollectibleConfig {
    x: number;
    y: number;
}

export interface GameConfig {
    readonly GAME_WIDTH: number;
    readonly GAME_HEIGHT: number;
    readonly TILE_SIZE: number;
    readonly GRAVITY: number;
    readonly PLAYER_SPEED: number;
    readonly JUMP_FORCE: number;
    readonly DEBUG_MODE: boolean;
    readonly PHYSICS?: {
        PLAYER_BOUNCE?: number;
        PLAYER_DRAG_X?: number;
    };
    readonly VISUAL?: {
        DEPTH_BACKGROUND?: number;
        DEPTH_PLAYER?: number;
        DEPTH_COLLECTIBLES_ENEMIES?: number;
        GROUND_COLOR?: number;
        PLATFORM_COLOR?: number;
        PLAYER_SCALE_DEFAULT?: number;
    };
    readonly TIMING?: {
        BACKGROUND_ANIMATION_SPEED?: number;
    };
}

export interface GameCallbacks {
    onScoreChange?: (score: number) => void;
    onLivesChange?: (lives: number) => void;
    onLevelChange?: (level: number) => void;
    onGameOver?: (finalScore: number) => void;
    onWin?: (finalScore: number) => void;
}