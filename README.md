# 🐕 MyPup - Retro 16-Bit Platformer

A retro-style 16-bit platformer game featuring your custom dog as the main character! Built with Phaser.js and powered by Gemini 3 API for image analysis and sprite sheet generation.

## 🎮 Features

- **Custom Dog Character**: Upload a photo of your dog and generate a custom sprite sheet
- **AI-Powered Analysis**: Uses Gemini 3 API to analyze your dog's unique features and create detailed generation prompts
- **Sprite Sheet Creation**: Google GenAI (gemini-3-pro-image-preview) generates a complete sprite sheet maintaining your dog's characteristics
- **Classic Platformer Gameplay**: Similar to Super Mario Bros with jumping, enemies, and collectibles
- **Retro 16-Bit Style**: Authentic pixel art graphics and styling

## ⚠️ SECURITY WARNING

**IMPORTANT**: This is a client-side application. API keys stored in JavaScript are visible to anyone who views the source code.

**If you shared your API key publicly (including in this conversation), you MUST:**
1. **Revoke it immediately** in [Google Cloud Console](https://console.cloud.google.com/)
2. **Generate a new key** with restrictions enabled
3. **Never commit API keys to public repositories**

See [SECURITY.md](SECURITY.md) for detailed security best practices and solutions.

## 🚀 Getting Started

### Prerequisites

- A web browser (Chrome, Firefox, Safari, or Edge)
- Gemini 3 API key (with image generation access)

### Setup

1. **Clone or download this repository**

2. **Add your API key**:
   - Open `config.js`
   - Add your Gemini 3 API key
   - Or enter it when prompted on first run (it will be saved in localStorage)

3. **Open `index.html` in your web browser**

   Or for GitHub Pages:
   - Push to GitHub
   - Enable GitHub Pages in repository settings
   - Access via `https://yourusername.github.io/MyPup/`
   - See [GITHUB_PAGES_SETUP.md](GITHUB_PAGES_SETUP.md) for detailed instructions

## 🎯 How to Play

1. **Customize Your Dog**:
   - Click "Upload Your Dog's Photo"
   - Select an image of your dog
   - Click "Generate Sprite Sheet" (this uses AI to create your custom character)
   - Wait for the sprite sheet to be generated

2. **Start Playing**:
   - Click "Start Game"
   - Use arrow keys to move left/right
   - Press spacebar or up arrow to jump
   - Collect yellow items to increase your score
   - Avoid red enemies
   - Don't fall off the platforms!

## 🛠️ Technical Details

### Technologies Used

- **Phaser.js 3.80.1**: Game framework
- **Gemini 1.5 Pro**: AI analysis of dog images and prompt creation
- **Gemini 3 Pro Image Preview**: Image generation for sprite sheets
- **HTML5/CSS3/JavaScript**: Frontend

### Project Structure

```
MyPup/
├── index.html          # Main HTML file
├── styles.css          # Styling
├── config.js           # Configuration and API keys
├── api.js              # API integration (Gemini & Nanobanana)
├── character.js        # Character customization logic
├── game.js             # Main game logic (Phaser)
└── README.md           # This file
```

### Game Configuration

Edit `config.js` to customize:
- Game dimensions
- Player speed and jump force
- Gravity
- Sprite sheet dimensions

## 🔧 API Setup

### Gemini 3 API

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create an API key
3. Add it to `config.js` or enter when prompted when you first run the game
4. The API key will be saved in your browser's localStorage for future use

**Note**: The game uses:
- **Gemini 1.5 Pro**: Analyzes uploaded dog images and extracts unique features (breed, colors, markings), then creates a detailed prompt for sprite generation
- **Gemini 3 Pro Image Preview**: Generates the actual sprite sheet image based on the prompt created by Gemini

**Important**: Your Gemini API key needs access to both models. Make sure your API key has permissions for:
- `gemini-1.5-pro` (for text analysis)
- `gemini-3-pro-image-preview` (for image generation)

### Alternative: Manual API Key Entry

You can also manually edit `config.js` and add your key:
```javascript
const CONFIG = {
    GEMINI_API_KEY: 'your-gemini-key-here',
    // ... other config
};
```

## 📝 Notes

- Sprite sheets are cached in localStorage for faster loading
- The game uses pixel-perfect rendering for authentic retro feel
- All game data is stored locally (no server required)

## 🐛 Troubleshooting

- **API errors**: Make sure your Gemini API key is correct and has access to both `gemini-2.0-flash-exp` and `gemini-3-pro-image-preview` models
- **Sprite sheet not generating**: Check that your API key has permissions for the `gemini-3-pro-image-preview` model for image generation
- **Sprite sheet not loading**: Check browser console for errors
- **Game not starting**: Ensure all files are in the same directory

## 📄 License

This project is open source and available for personal use.

## 🙏 Credits

- Built with [Phaser.js](https://phaser.io)
- Powered by [Google Gemini 3](https://deepmind.google/technologies/gemini/) for analysis and [Google GenAI](https://ai.google.dev/) for image generation

---

Enjoy playing with your custom dog character! 🐕🎮
