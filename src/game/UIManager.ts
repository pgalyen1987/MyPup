/**
 * game/UIManager.ts
 * Handles all UI elements: HUD, overlays, menus
 */

import { CONFIG } from '../config.js';
import { PhaserScene } from './types.js';

export class UIManager {
    private scene: PhaserScene;

    constructor(scene: PhaserScene) {
        this.scene = scene;
    }

    // ==================================================================================
    // HUD UPDATES
    // ==================================================================================

    public updateScore(score: number): void {
        const scoreEl = document.querySelector('#score .stat-value') || document.getElementById('score');
        if (scoreEl) scoreEl.textContent = score.toString();
    }

    public updateLevel(level: number): void {
        const levelEl = document.querySelector('#level .stat-value') || document.getElementById('level');
        if (levelEl) levelEl.textContent = `Level ${level}`;
    }

    public updateLives(lives: number): void {
        const livesEl = document.getElementById('lives');
        if (!livesEl) return;

        const hearts = livesEl.querySelectorAll('.heart');
        if (hearts.length > 0) {
            hearts.forEach((heart, index) => {
                if (index < lives) {
                    heart.classList.remove('lost');
                    (heart as HTMLElement).textContent = '❤️';
                } else {
                    heart.classList.add('lost');
                    (heart as HTMLElement).textContent = '🖤';
                }
            });
        } else {
            livesEl.textContent = `Lives: ${'❤️'.repeat(Math.max(0, lives))}`;
        }
    }

    public updateAll(score: number, level: number, lives: number): void {
        this.updateScore(score);
        this.updateLevel(level);
        this.updateLives(lives);
    }

    // ==================================================================================
    // SCORE POPUP
    // ==================================================================================

    public createScorePopup(x: number, y: number, text: string): void {
        if (!this.scene) return;

        const popup = this.scene.add.text(x, y, text, {
            fontSize: '24px',
            fontFamily: 'Press Start 2P, monospace',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 4,
        });
        popup.setOrigin(0.5);
        popup.setDepth((CONFIG.VISUAL?.DEPTH_PLAYER || 100) + 10);

        this.scene.tweens.add({
            targets: popup,
            y: y - 50,
            alpha: 0,
            duration: 1000,
            ease: 'Power2',
            onComplete: () => popup.destroy(),
        });
    }

    // ==================================================================================
    // LEVEL TRANSITION
    // ==================================================================================

    public showLevelTransition(level: number, callback: () => void): void {
        if (!this.scene) {
            callback();
            return;
        }

        const overlay = this.scene.add.rectangle(
            CONFIG.GAME_WIDTH / 2,
            CONFIG.GAME_HEIGHT / 2,
            CONFIG.GAME_WIDTH,
            CONFIG.GAME_HEIGHT,
            0x000000,
            0.8
        );
        overlay.setScrollFactor(0);
        overlay.setDepth((CONFIG.VISUAL?.DEPTH_PLAYER || 100) + 100);

        const levelText = this.scene.add.text(
            CONFIG.GAME_WIDTH / 2,
            CONFIG.GAME_HEIGHT / 2,
            `Level ${level}`,
            { fontSize: '48px', fontFamily: 'Press Start 2P, monospace', color: '#FFD700' }
        );
        levelText.setOrigin(0.5);
        levelText.setScrollFactor(0);
        levelText.setDepth((CONFIG.VISUAL?.DEPTH_PLAYER || 100) + 101);

        levelText.setScale(0);
        this.scene.tweens.add({
            targets: levelText,
            scale: 1,
            duration: 500,
            ease: 'Back.easeOut',
        });

        this.scene.time.delayedCall(2000, () => {
            this.scene.tweens.add({
                targets: [overlay, levelText],
                alpha: 0,
                duration: 500,
                onComplete: () => {
                    overlay.destroy();
                    levelText.destroy();
                    callback();
                },
            });
        });
    }

    // ==================================================================================
    // PAUSE MENU
    // ==================================================================================

    public showPauseMenu(onResume: () => void, onQuit: () => void): void {
        if (document.getElementById('pause-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'pause-overlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.8); display: flex; flex-direction: column;
            justify-content: center; align-items: center; z-index: 1000;
        `;
        overlay.innerHTML = `
            <h1 style="color:#4CAF50; margin-bottom: 20px; font-family: 'Press Start 2P', monospace;">PAUSED</h1>
            <p style="margin-bottom: 20px; font-family: 'Press Start 2P', monospace; color: white;">Press ESC to resume</p>
            <button id="resume-btn" style="padding: 15px 30px; margin: 5px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; font-family: inherit;">Resume</button>
            <button id="quit-btn" style="padding: 15px 30px; margin: 5px; background: #ff4444; color: white; border: none; border-radius: 5px; cursor: pointer; font-family: inherit;">Quit</button>
        `;
        document.body.appendChild(overlay);

        document.getElementById('resume-btn')?.addEventListener('click', onResume);
        document.getElementById('quit-btn')?.addEventListener('click', onQuit);
    }

    public hidePauseMenu(): void {
        document.getElementById('pause-overlay')?.remove();
    }

    public updatePauseButton(isPaused: boolean): void {
        const btn = document.getElementById('pause-btn');
        if (btn) {
            const textEl = btn.querySelector('.button-text');
            if (textEl) {
                textEl.textContent = isPaused ? 'Resume' : 'Pause';
            }
        }
    }

    // ==================================================================================
    // GAME OVER / WIN OVERLAYS
    // ==================================================================================

    public showGameOver(score: number, onRestart: () => void): void {
        this.showEndOverlay('GAME OVER', `Final Score: ${score}`, '#ff0000', onRestart);
    }

    public showWin(score: number, onRestart: () => void): void {
        this.showEndOverlay('YOU WIN!', `Final Score: ${score}`, '#4CAF50', onRestart);
    }

    private showEndOverlay(title: string, subtitle: string, color: string, onRestart: () => void): void {
        const overlay = document.createElement('div');
        overlay.id = 'game-overlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.8); display: flex; flex-direction: column;
            justify-content: center; align-items: center; z-index: 1000;
        `;
        overlay.innerHTML = `
            <h1 style="color:${color}; font-family:'Press Start 2P', monospace; font-size: 36px;">${title}</h1>
            <p style="font-size: 18px; margin: 20px 0; color: white; font-family: 'Press Start 2P', monospace;">${subtitle}</p>
            <button id="restart-btn" style="padding: 15px 30px; background:${color}; color: white; border: none; border-radius: 5px; cursor: pointer; font-family: inherit; font-size: 14px;">Play Again</button>
        `;
        document.body.appendChild(overlay);

        document.getElementById('restart-btn')?.addEventListener('click', () => {
            overlay.remove();
            onRestart();
        });
    }

    // ==================================================================================
    // ERROR OVERLAY
    // ==================================================================================

    public showCriticalError(message: string, onReturn: () => void, onRetry: () => void): void {
        document.getElementById('critical-error-overlay')?.remove();

        const overlay = document.createElement('div');
        overlay.id = 'critical-error-overlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.95); display: flex; flex-direction: column;
            justify-content: center; align-items: center; z-index: 10000;
            color: white; font-family: 'Press Start 2P', monospace;
            text-align: center; padding: 20px;
        `;

        overlay.innerHTML = `
            <h1 style="color: #ff6b6b; margin-bottom: 20px; font-size: 24px;">Asset Load Error</h1>
            <p style="margin-bottom: 30px; max-width: 500px; line-height: 1.6; font-size: 12px;">${message}</p>
            <div style="display: flex; gap: 15px; flex-wrap: wrap; justify-content: center;">
                <button id="return-menu-btn" style="padding: 15px 30px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px; font-family: inherit;">Return to Menu</button>
                <button id="retry-game-btn" style="padding: 15px 30px; background: #2196F3; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px; font-family: inherit;">Retry</button>
            </div>
        `;

        document.body.appendChild(overlay);

        document.getElementById('return-menu-btn')?.addEventListener('click', () => {
            overlay.remove();
            onReturn();
        });

        document.getElementById('retry-game-btn')?.addEventListener('click', () => {
            overlay.remove();
            onRetry();
        });
    }

    // ==================================================================================
    // CLEANUP
    // ==================================================================================

    public removeAllOverlays(): void {
        document.getElementById('game-overlay')?.remove();
        document.getElementById('pause-overlay')?.remove();
        document.getElementById('critical-error-overlay')?.remove();
    }
}