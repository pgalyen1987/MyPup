function testPhaserTypes() {
    const config = {
        type: Phaser.AUTO,
        width: 512,
        height: 512,
        parent: 'phaser-game',
        physics: {
            default: 'arcade',
            arcade: {
                gravity: { y: 1600 },
                debug: true
            }
        }
    };
    const game = new Phaser.Game(config);
    console.log('Phaser types working!', game);
}
export {};
