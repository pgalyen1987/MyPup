/**
 * enemies/EnemyTypes.ts
 * Enemy type definitions and configurations
 */

import { CONFIG } from '../config.js';

// ============================================================================
// TYPES
// ============================================================================

export type EnemyType = 'cat' | 'bird' | 'squirrel' | 'mailman';
export type EnemyBehavior = 'patrol' | 'chase' | 'fly' | 'jump' | 'stationary' | 'boss';
export type EnemyState = 'idle' | 'walking' | 'attacking' | 'hurt' | 'dead' | 'flying' | 'jumping';

export interface EnemyAnimationSet {
    start: number;
    end: number;
    fps: number;
}

export interface EnemyAnimations {
    walkRight: EnemyAnimationSet;
    walkLeft: EnemyAnimationSet;
    attack: EnemyAnimationSet;
    idle: EnemyAnimationSet;
    hurt?: EnemyAnimationSet;
    death?: EnemyAnimationSet;
}

export interface EnemyConfig {
    type: EnemyType;
    name: string;
    health: number;
    damage: number;
    speed: number;
    scoreValue: number;
    behavior: EnemyBehavior;

    // Visual
    scale: number;
    tint?: number;

    // Physics
    bounceX: number;
    bounceY: number;
    gravity: boolean;

    // AI
    detectionRange: number;
    attackRange: number;
    attackCooldown: number;
    patrolDistance?: number;

    // Animation frames (for 4x4 spritesheet)
    animations: EnemyAnimations;

    // Sprite
    spriteKey: string;
    fallbackAsset?: string;
}

export interface SpawnPoint {
    x: number;
    y: number;
    type: EnemyType;
    facing?: 'left' | 'right';
    patrolStart?: number;
    patrolEnd?: number;
}

// ============================================================================
// ENEMY CONFIGURATIONS
// ============================================================================

const TILE = CONFIG.TILE_SIZE;

export const ENEMY_CONFIGS: Record<EnemyType, EnemyConfig> = {
    cat: {
        type: 'cat',
        name: 'Street Cat',
        health: 1,
        damage: 1,
        speed: TILE * 1.25,
        scoreValue: 50,
        behavior: 'patrol',

        scale: 1.5,

        bounceX: 1,
        bounceY: 0,
        gravity: true,

        detectionRange: TILE * 4,
        attackRange: TILE * 1.5,
        attackCooldown: 120,
        patrolDistance: TILE * 4,

        animations: {
            walkRight: { start: 0, end: 3, fps: 10 },
            walkLeft: { start: 4, end: 7, fps: 10 },
            attack: { start: 8, end: 11, fps: 12 },
            idle: { start: 12, end: 15, fps: 8 },
        },

        spriteKey: 'cat',
        fallbackAsset: 'assets/Cat.png',
    },

    bird: {
        type: 'bird',
        name: 'Angry Bird',
        health: 1,
        damage: 1,
        speed: TILE * 2,
        scoreValue: 75,
        behavior: 'fly',

        scale: 1.2,

        bounceX: 0,
        bounceY: 0,
        gravity: false,

        detectionRange: TILE * 6,
        attackRange: TILE * 2,
        attackCooldown: 90,

        animations: {
            walkRight: { start: 0, end: 3, fps: 12 },
            walkLeft: { start: 4, end: 7, fps: 12 },
            attack: { start: 8, end: 11, fps: 15 },
            idle: { start: 12, end: 15, fps: 8 },
        },

        spriteKey: 'bird',
        fallbackAsset: 'assets/Bird.png',
    },

    squirrel: {
        type: 'squirrel',
        name: 'Speedy Squirrel',
        health: 1,
        damage: 1,
        speed: TILE * 2.5,
        scoreValue: 100,
        behavior: 'jump',

        scale: 1.0,

        bounceX: 0.5,
        bounceY: 0.3,
        gravity: true,

        detectionRange: TILE * 5,
        attackRange: TILE * 1,
        attackCooldown: 60,

        animations: {
            walkRight: { start: 0, end: 3, fps: 14 },
            walkLeft: { start: 4, end: 7, fps: 14 },
            attack: { start: 8, end: 11, fps: 16 },
            idle: { start: 12, end: 15, fps: 6 },
        },

        spriteKey: 'squirrel',
        fallbackAsset: 'assets/Squirrel.png',
    },

    mailman: {
        type: 'mailman',
        name: 'The Mailman',
        health: 5,
        damage: 2,
        speed: TILE * 1,
        scoreValue: 500,
        behavior: 'boss',

        scale: 2.5,
        tint: 0xff4444,

        bounceX: 0,
        bounceY: 0,
        gravity: true,

        detectionRange: TILE * 8,
        attackRange: TILE * 3,
        attackCooldown: 180,
        patrolDistance: TILE * 6,

        animations: {
            walkRight: { start: 0, end: 3, fps: 8 },
            walkLeft: { start: 4, end: 7, fps: 8 },
            attack: { start: 8, end: 11, fps: 10 },
            idle: { start: 12, end: 15, fps: 4 },
        },

        spriteKey: 'mailman',
        fallbackAsset: 'assets/Mailman.png',
    },
};

// ============================================================================
// LEVEL SPAWN CONFIGURATIONS
// ============================================================================

export const LEVEL_SPAWNS: Record<number, SpawnPoint[]> = {
    1: [
        { x: 550, y: 350, type: 'cat', facing: 'left' },
        { x: 900, y: 350, type: 'cat', facing: 'left' },
        { x: 1400, y: 350, type: 'cat', facing: 'right' },
        { x: 1800, y: 200, type: 'bird', facing: 'left' },
    ],

    2: [
        { x: 400, y: 350, type: 'cat', facing: 'left' },
        { x: 700, y: 350, type: 'squirrel', facing: 'right' },
        { x: 1000, y: 200, type: 'bird', facing: 'left' },
        { x: 1200, y: 350, type: 'cat', facing: 'left' },
        { x: 1500, y: 350, type: 'squirrel', facing: 'left' },
        { x: 1900, y: 150, type: 'bird', facing: 'right' },
    ],

    3: [
        { x: 400, y: 350, type: 'cat', facing: 'left' },
        { x: 800, y: 200, type: 'bird', facing: 'left' },
        { x: 1000, y: 350, type: 'squirrel', facing: 'right' },
        { x: 1400, y: 350, type: 'cat', facing: 'left' },
        { x: 2200, y: 350, type: 'mailman', facing: 'left' },
    ],
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getEnemyConfig(type: EnemyType): EnemyConfig {
    return ENEMY_CONFIGS[type];
}

export function getLevelSpawns(level: number): SpawnPoint[] {
    return LEVEL_SPAWNS[level] || LEVEL_SPAWNS[1];
}

export function getAllEnemyTypes(): EnemyType[] {
    return Object.keys(ENEMY_CONFIGS) as EnemyType[];
}