/**
 * game/GameState.ts
 * Manages game state (score, lives, level, etc.)
 */

import { GameState, GameCallbacks } from './types.js';

export class GameStateManager {
    private state: GameState;
    private callbacks: GameCallbacks;

    constructor(callbacks: GameCallbacks = {}) {
        console.log('GameStateManager: Constructor called');
        this.callbacks = callbacks;
        this.state = this.getInitialState();
        console.log('GameStateManager: Initial level is', this.state.level);
    }

    private getInitialState(): GameState {
        return {
            score: 0,
            lives: 3,
            level: 1,
            isGameOver: false,
            isPaused: false,
        };
    }

    // ==================================================================================
    // GETTERS
    // ==================================================================================

    public getState(): Readonly<GameState> {
        return { ...this.state };
    }

    public getScore(): number {
        return this.state.score;
    }

    public getLives(): number {
        return this.state.lives;
    }

    public getLevel(): number {
        console.log('GameStateManager: getLevel() returning', this.state.level);
        return this.state.level;
    }

    public isGameOver(): boolean {
        return this.state.isGameOver;
    }

    public isPaused(): boolean {
        return this.state.isPaused;
    }

    // ==================================================================================
    // SETTERS / MODIFIERS
    // ==================================================================================

    public addScore(points: number): void {
        this.state.score += points;
        this.callbacks.onScoreChange?.(this.state.score);
    }

    public loseLife(amount: number = 1): boolean {
        this.state.lives = Math.max(0, this.state.lives - amount);
        this.callbacks.onLivesChange?.(this.state.lives);

        if (this.state.lives <= 0) {
            this.setGameOver();
            return true;
        }
        return false;
    }

    public nextLevel(): boolean {
        console.log('GameStateManager: nextLevel() called, current level:', this.state.level);
        console.trace(); // This will show the call stack
        this.state.level++;
        this.callbacks.onLevelChange?.(this.state.level);

        if (this.state.level > 3) {
            this.setWin();
            return false;
        }
        return true;
    }

    public setPaused(paused: boolean): void {
        this.state.isPaused = paused;
    }

    public togglePause(): boolean {
        this.state.isPaused = !this.state.isPaused;
        return this.state.isPaused;
    }

    private setGameOver(): void {
        this.state.isGameOver = true;
        this.callbacks.onGameOver?.(this.state.score);
    }

    private setWin(): void {
        this.state.isGameOver = true;
        this.callbacks.onWin?.(this.state.score);
    }

    public reset(): void {
        this.state = this.getInitialState();
    }
}