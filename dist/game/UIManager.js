import { CONFIG } from '../config.js';
export class UIManager {
    constructor(scene) {
        this.transitionElements = [];
        this.isTransitioning = false;
        this.scene = scene;
    }
    isSceneActive() {
        return this.scene && this.scene.sys && this.scene.sys.isActive();
    }
    updateScore(score) {
        const scoreEl = document.querySelector('#score .stat-value') || document.getElementById('score');
        if (scoreEl)
            scoreEl.textContent = score.toString();
    }
    updateLevel(level) {
        const levelEl = document.querySelector('#level .stat-value') || document.getElementById('level');
        if (levelEl)
            levelEl.textContent = `Level ${level}`;
    }
    updateLives(lives) {
        const livesEl = document.getElementById('lives');
        if (!livesEl)
            return;
        const hearts = livesEl.querySelectorAll('.heart');
        if (hearts.length > 0) {
            hearts.forEach((heart, index) => {
                if (index < lives) {
                    heart.classList.remove('lost');
                    heart.textContent = '❤️';
                }
                else {
                    heart.classList.add('lost');
                    heart.textContent = '🖤';
                }
            });
        }
        else {
            livesEl.textContent = `Lives: ${'❤️'.repeat(Math.max(0, lives))}`;
        }
    }
    updateAll(score, level, lives) {
        this.updateScore(score);
        this.updateLevel(level);
        this.updateLives(lives);
    }
    createScorePopup(x, y, text) {
        if (!this.isSceneActive())
            return;
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
    showLevelTransition(level, callback) {
        if (!this.isSceneActive()) {
            callback();
            return;
        }
        if (this.isTransitioning) {
            callback();
            return;
        }
        this.isTransitioning = true;
        const centerX = CONFIG.GAME_WIDTH / 2;
        const centerY = CONFIG.GAME_HEIGHT / 2;
        const uiDepth = (CONFIG.VISUAL?.DEPTH_PLAYER || 100) + 200;
        const overlay = this.scene.add.rectangle(centerX, centerY, CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT, 0x000000, 0.85);
        overlay.setDepth(uiDepth);
        overlay.setScrollFactor(0);
        overlay.setAlpha(0);
        this.transitionElements.push(overlay);
        const levelText = this.scene.add.text(centerX, centerY, `LEVEL ${level}`, {
            fontFamily: 'Arial Black, Impact, sans-serif',
            fontSize: '120px',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 12,
            align: 'center',
            shadow: {
                offsetX: 6,
                offsetY: 6,
                color: '#000000',
                blur: 10,
                fill: true,
            },
        });
        levelText.setOrigin(0.5);
        levelText.setDepth(uiDepth + 1);
        levelText.setScrollFactor(0);
        levelText.setAlpha(0);
        levelText.setScale(0.3);
        this.transitionElements.push(levelText);
        const lineTop = this.scene.add.rectangle(centerX, centerY - 100, 0, 6, 0xFFD700);
        lineTop.setDepth(uiDepth + 1);
        lineTop.setScrollFactor(0);
        this.transitionElements.push(lineTop);
        const lineBottom = this.scene.add.rectangle(centerX, centerY + 100, 0, 6, 0xFFD700);
        lineBottom.setDepth(uiDepth + 1);
        lineBottom.setScrollFactor(0);
        this.transitionElements.push(lineBottom);
        const getReadyText = this.scene.add.text(centerX, centerY + 160, 'GET READY!', {
            fontFamily: 'Arial Black, Impact, sans-serif',
            fontSize: '36px',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 6,
            align: 'center',
        });
        getReadyText.setOrigin(0.5);
        getReadyText.setDepth(uiDepth + 1);
        getReadyText.setScrollFactor(0);
        getReadyText.setAlpha(0);
        this.transitionElements.push(getReadyText);
        this.scene.tweens.add({
            targets: overlay,
            alpha: 0.85,
            duration: 300,
            ease: 'Power2',
        });
        this.scene.tweens.add({
            targets: [lineTop, lineBottom],
            width: 500,
            duration: 400,
            delay: 200,
            ease: 'Power3.easeOut',
        });
        this.scene.tweens.add({
            targets: levelText,
            alpha: 1,
            scale: 1,
            duration: 600,
            delay: 300,
            ease: 'Back.easeOut',
        });
        this.scene.tweens.add({
            targets: getReadyText,
            alpha: 1,
            duration: 400,
            delay: 700,
            ease: 'Power2',
        });
        this.scene.tweens.add({
            targets: levelText,
            scale: 1.05,
            duration: 300,
            delay: 1200,
            yoyo: true,
            ease: 'Sine.easeInOut',
        });
        this.scene.time.delayedCall(2000, () => {
            if (!this.isSceneActive()) {
                this.cleanupTransition();
                callback();
                return;
            }
            this.scene.tweens.add({
                targets: [lineTop, lineBottom],
                width: 0,
                duration: 300,
                ease: 'Power2.easeIn',
            });
            this.scene.tweens.add({
                targets: [overlay, levelText, getReadyText],
                alpha: 0,
                duration: 400,
                ease: 'Power2',
                onComplete: () => {
                    this.cleanupTransition();
                    callback();
                },
            });
        });
    }
    cleanupTransition() {
        for (const element of this.transitionElements) {
            if (element && element.destroy) {
                try {
                    element.destroy();
                }
                catch (e) {
                }
            }
        }
        this.transitionElements = [];
        this.isTransitioning = false;
    }
    showPauseMenu(onResume, onQuit) {
        if (document.getElementById('pause-overlay'))
            return;
        const overlay = document.createElement('div');
        overlay.id = 'pause-overlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.8); display: flex; flex-direction: column;
            justify-content: center; align-items: center; z-index: 1000;
        `;
        overlay.innerHTML = `
            <h1 style="color:#4CAF50; margin-bottom: 20px; font-family: 'Press Start 2P', monospace; font-size: 48px;">PAUSED</h1>
            <p style="margin-bottom: 30px; font-family: 'Press Start 2P', monospace; color: white; font-size: 14px;">Press ESC to resume</p>
            <button id="resume-btn" style="padding: 15px 40px; margin: 10px; background: #4CAF50; color: white; border: none; border-radius: 8px; cursor: pointer; font-family: 'Press Start 2P', monospace; font-size: 14px; transition: transform 0.1s;">Resume</button>
            <button id="quit-btn" style="padding: 15px 40px; margin: 10px; background: #ff4444; color: white; border: none; border-radius: 8px; cursor: pointer; font-family: 'Press Start 2P', monospace; font-size: 14px; transition: transform 0.1s;">Quit</button>
        `;
        document.body.appendChild(overlay);
        const buttons = overlay.querySelectorAll('button');
        buttons.forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                btn.style.transform = 'scale(1.05)';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.transform = 'scale(1)';
            });
        });
        document.getElementById('resume-btn')?.addEventListener('click', onResume);
        document.getElementById('quit-btn')?.addEventListener('click', onQuit);
    }
    hidePauseMenu() {
        document.getElementById('pause-overlay')?.remove();
    }
    updatePauseButton(isPaused) {
        const btn = document.getElementById('pause-btn');
        if (btn) {
            const textEl = btn.querySelector('.button-text');
            if (textEl) {
                textEl.textContent = isPaused ? 'Resume' : 'Pause';
            }
        }
    }
    showGameOver(score, onRestart) {
        this.showEndOverlay('GAME OVER', `Final Score: ${score}`, '#ff4444', onRestart);
    }
    showWin(score, onRestart) {
        this.showEndOverlay('YOU WIN!', `Final Score: ${score}`, '#4CAF50', onRestart);
    }
    showEndOverlay(title, subtitle, color, onRestart) {
        document.getElementById('game-overlay')?.remove();
        const overlay = document.createElement('div');
        overlay.id = 'game-overlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.9); display: flex; flex-direction: column;
            justify-content: center; align-items: center; z-index: 1000;
            animation: fadeIn 0.3s ease-out;
        `;
        overlay.innerHTML = `
            <style>
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes popIn {
                    0% { transform: scale(0.5); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                }
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            </style>
            <h1 style="
                color: ${color};
                font-family: 'Arial Black', Impact, sans-serif;
                font-size: 72px;
                text-shadow: 4px 4px 8px rgba(0,0,0,0.8);
                animation: popIn 0.5s ease-out;
                margin-bottom: 20px;
            ">${title}</h1>
            <p style="
                font-size: 24px;
                margin: 20px 0 40px 0;
                color: white;
                font-family: 'Press Start 2P', monospace;
                animation: slideUp 0.5s ease-out 0.2s both;
            ">${subtitle}</p>
            <button id="restart-btn" style="
                padding: 20px 50px;
                background: ${color};
                color: white;
                border: none;
                border-radius: 10px;
                cursor: pointer;
                font-family: 'Press Start 2P', monospace;
                font-size: 18px;
                animation: slideUp 0.5s ease-out 0.4s both;
                transition: transform 0.1s, box-shadow 0.1s;
                box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            ">Play Again</button>
        `;
        document.body.appendChild(overlay);
        const restartBtn = document.getElementById('restart-btn');
        if (restartBtn) {
            restartBtn.addEventListener('mouseenter', () => {
                restartBtn.style.transform = 'scale(1.05)';
                restartBtn.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)';
            });
            restartBtn.addEventListener('mouseleave', () => {
                restartBtn.style.transform = 'scale(1)';
                restartBtn.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
            });
            restartBtn.addEventListener('click', () => {
                overlay.remove();
                onRestart();
            });
        }
    }
    showCriticalError(message, onReturn, onRetry) {
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
            <h1 style="color: #ff6b6b; margin-bottom: 20px; font-size: 32px; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">⚠️ ERROR</h1>
            <p style="margin-bottom: 30px; max-width: 600px; line-height: 1.8; font-size: 14px; color: #ccc;">${message}</p>
            <div style="display: flex; gap: 20px; flex-wrap: wrap; justify-content: center;">
                <button id="return-menu-btn" style="
                    padding: 15px 35px;
                    background: #4CAF50;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                    font-family: inherit;
                    transition: transform 0.1s;
                ">Return to Menu</button>
                <button id="retry-game-btn" style="
                    padding: 15px 35px;
                    background: #2196F3;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                    font-family: inherit;
                    transition: transform 0.1s;
                ">Retry</button>
            </div>
        `;
        document.body.appendChild(overlay);
        const buttons = overlay.querySelectorAll('button');
        buttons.forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                btn.style.transform = 'scale(1.05)';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.transform = 'scale(1)';
            });
        });
        document.getElementById('return-menu-btn')?.addEventListener('click', () => {
            overlay.remove();
            onReturn();
        });
        document.getElementById('retry-game-btn')?.addEventListener('click', () => {
            overlay.remove();
            onRetry();
        });
    }
    removeAllOverlays() {
        document.getElementById('game-overlay')?.remove();
        document.getElementById('pause-overlay')?.remove();
        document.getElementById('critical-error-overlay')?.remove();
        this.cleanupTransition();
    }
    destroy() {
        this.removeAllOverlays();
        this.scene = null;
    }
}
