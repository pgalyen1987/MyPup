export class GameStateManager {
    constructor(callbacks = {}) {
        console.log('GameStateManager: Constructor called');
        this.callbacks = callbacks;
        this.state = this.getInitialState();
        console.log('GameStateManager: Initial level is', this.state.level);
    }
    getInitialState() {
        return {
            score: 0,
            lives: 3,
            level: 1,
            isGameOver: false,
            isPaused: false,
        };
    }
    getState() {
        return { ...this.state };
    }
    getScore() {
        return this.state.score;
    }
    getLives() {
        return this.state.lives;
    }
    getLevel() {
        console.log('GameStateManager: getLevel() returning', this.state.level);
        return this.state.level;
    }
    isGameOver() {
        return this.state.isGameOver;
    }
    isPaused() {
        return this.state.isPaused;
    }
    addScore(points) {
        this.state.score += points;
        this.callbacks.onScoreChange?.(this.state.score);
    }
    loseLife(amount = 1) {
        this.state.lives = Math.max(0, this.state.lives - amount);
        this.callbacks.onLivesChange?.(this.state.lives);
        if (this.state.lives <= 0) {
            this.setGameOver();
            return true;
        }
        return false;
    }
    nextLevel() {
        console.log('GameStateManager: nextLevel() called, current level:', this.state.level);
        console.trace();
        this.state.level++;
        this.callbacks.onLevelChange?.(this.state.level);
        if (this.state.level > 3) {
            this.setWin();
            return false;
        }
        return true;
    }
    setPaused(paused) {
        this.state.isPaused = paused;
    }
    togglePause() {
        this.state.isPaused = !this.state.isPaused;
        return this.state.isPaused;
    }
    setGameOver() {
        this.state.isGameOver = true;
        this.callbacks.onGameOver?.(this.state.score);
    }
    setWin() {
        this.state.isGameOver = true;
        this.callbacks.onWin?.(this.state.score);
    }
    reset() {
        this.state = this.getInitialState();
    }
}
