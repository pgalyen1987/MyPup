// Type declarations for Phaser.js 3.80.1 loaded from CDN
// Phaser is loaded globally via script tag in index.html

declare namespace Phaser {
  // Constants
  const AUTO: number;
  const CANVAS: number;
  const WEBGL: number;
  
  // Game Configuration
  interface GameConfig {
    type?: number;
    width?: number;
    height?: number;
    parent?: string | HTMLElement;
    physics?: {
      default?: string;
      arcade?: Physics.Arcade.ArcadePhysicsConfig;
    };
    scene?: any;
    pixelArt?: boolean;
    backgroundColor?: string;
    transparent?: boolean;
  }
  
  // Game Class
  class Game {
    constructor(config: GameConfig);
    destroy(removeCanvas?: boolean): void;
  }
  
  // Scene
  class Scene {
    load: Loader.LoaderPlugin;
    add: GameObjects.GameObjectFactory;
    physics: Physics.Physics;
    input: Input.InputPlugin;
    cameras: Cameras.Scene2D.CameraManager;
    anims: Animations.AnimationManager;
    textures: Textures.TextureManager;
  }
  
  // Physics
  namespace Physics {
    namespace Arcade {
      interface ArcadePhysicsConfig {
        gravity?: { x?: number; y?: number };
        debug?: boolean;
      }
      
      class ArcadePhysics {
        world: ArcadeWorld;
      }
      
      class ArcadeWorld {
        setBounds(x: number, y: number, width: number, height: number, checkLeft?: boolean, checkRight?: boolean, checkUp?: boolean, checkDown?: boolean): void;
        drawDebug: boolean;
        debugGraphic: any;
      }
      
      class ArcadeBody {
        setSize(width: number, height: number, center?: boolean): void;
        setOffset(x: number, y: number): void;
        setImmovable(value?: boolean): void;
        setCollideWorldBounds(value?: boolean): void;
      }
    }
    
    class Physics {
      arcade: Arcade.ArcadePhysics;
      world: Arcade.ArcadeWorld;
    }
  }
  
  // Input
  namespace Input {
    class InputPlugin {
      keyboard: Keyboard.KeyboardPlugin;
    }
    
    namespace Keyboard {
      class KeyboardPlugin {
        addKey(key: number): Key;
        createCursorKeys(): CursorKeys;
      }
      
      class Key {
        isDown: boolean;
        isUp: boolean;
      }
      
      class CursorKeys {
        left: Key;
        right: Key;
        up: Key;
        down: Key;
        space: Key;
      }
      
      class KeyCodes {
        static readonly LEFT: number;
        static readonly RIGHT: number;
        static readonly UP: number;
        static readonly DOWN: number;
        static readonly SPACE: number;
        static readonly ESC: number;
        static readonly D: number;
      }
    }
  }
  
  // Game Objects
  namespace GameObjects {
    class GameObjectFactory {
      sprite(x: number, y: number, texture: string, frame?: string | number): Sprite;
      image(x: number, y: number, texture: string, frame?: string | number): Image;
      group(config?: any): Group;
      text(x: number, y: number, text: string, style?: any): Text;
    }
    
    class Sprite extends Container {
      body: Physics.Arcade.ArcadeBody | null;
      setScale(x: number, y?: number): this;
      setFlipX(value: boolean): this;
      setFlipY(value: boolean): this;
      setVisible(value: boolean): this;
      setAlpha(value: number): this;
      setDepth(value: number): this;
      play(key: string, ignoreIfPlaying?: boolean): this;
    }
    
    class Image extends Container {
      body: Physics.Arcade.ArcadeBody | null;
      setScale(x: number, y?: number): this;
      setVisible(value: boolean): this;
      setAlpha(value: number): this;
      setDepth(value: number): this;
    }
    
    class Container {
      x: number;
      y: number;
      visible: boolean;
      alpha: number;
      depth: number;
    }
    
    class Group {
      children: { size: number; entries: any[] };
      add(child: any): this;
      clear(removeFromScene?: boolean): void;
    }
    
    class Text extends Container {
      setText(text: string): this;
      setStyle(style: any): this;
    }
  }
  
  // Loader
  namespace Loader {
    class LoaderPlugin {
      image(key: string, url: string): this;
      on(event: string, callback: Function): this;
      start(): void;
    }
  }
  
  // Textures
  namespace Textures {
    class TextureManager {
      exists(key: string): boolean;
      get(key: string): Texture;
      addSpriteSheet(key: string, source: HTMLImageElement, config: { frameWidth: number; frameHeight: number; startFrame?: number; endFrame?: number; margin?: number; spacing?: number }): Texture;
    }
    
    class Texture {
      source: TextureSource[];
      image?: HTMLImageElement;
    }
    
    class TextureSource {
      image: HTMLImageElement;
    }
  }
  
  // Animations
  namespace Animations {
    class AnimationManager {
      create(config: AnimationConfig): Animation;
      exists(key: string): boolean;
      generateFrameNumbers(key: string, config?: { start?: number; end?: number; first?: number; frames?: number[] }): AnimationFrame[];
    }
    
    interface AnimationConfig {
      key: string;
      frames: AnimationFrame[] | string | number[];
      frameRate?: number;
      repeat?: number;
      yoyo?: boolean;
    }
    
    class Animation {
      key: string;
    }
    
    interface AnimationFrame {
      key: string;
      frame: string | number;
    }
  }
  
  // Cameras
  namespace Cameras {
    namespace Scene2D {
      class CameraManager {
        main: Camera;
      }
      
      class Camera {
        setBounds(x: number, y: number, width: number, height: number, centerOn?: boolean): void;
        startFollow(target: any, roundPixels?: boolean, lerpX?: number, lerpY?: number, offsetX?: number, offsetY?: number): void;
      }
    }
  }
}

// Global Phaser declaration
declare const Phaser: typeof Phaser;
