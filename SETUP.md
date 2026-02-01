# Setup Guide for MyPup Platformer

## Quick Start

1. **Download or clone this repository**
   ```bash
   git clone <your-repo-url>
   cd MyPup
   ```

2. **Open the game**
   - Simply open `index.html` in your web browser
   - Or use a local server:
     ```bash
     python3 -m http.server 8000
     # Then visit http://localhost:8000
     ```

3. **Enter API key when prompted**
   - The game will ask for your Gemini 3 API key on first run
   - The key is stored in browser localStorage (not sent to any server)

## GitHub Pages Deployment

### Method 1: Automatic (Recommended)

1. Push your code to GitHub
2. Go to repository Settings → Pages
3. Select source: "GitHub Actions"
4. The workflow in `.github/workflows/pages.yml` will automatically deploy

### Method 2: Manual

1. Push your code to GitHub
2. Go to repository Settings → Pages
3. Select source: "Deploy from a branch"
4. Choose `main` or `master` branch
5. Select `/ (root)` folder
6. Click Save

Your game will be available at: `https://yourusername.github.io/MyPup/`

## Local Development

### Using Python HTTP Server
```bash
python3 -m http.server 8000
```

### Using Node.js http-server
```bash
npx http-server -p 8000
```

### Using PHP
```bash
php -S localhost:8000
```

## Troubleshooting

### API Key Not Working
- Check that the key is correctly entered
- Verify your Gemini API key has access to Imagen for image generation
- Check that the API key has sufficient credits/quota
- Check browser console for error messages
- Try clearing localStorage and re-entering the key

### Sprite Sheet Not Generating
- Check internet connection
- Verify your Gemini API key is valid and has Imagen permissions
- Ensure your API key has image generation capabilities enabled
- Check browser console for detailed error messages

### Game Not Loading
- Ensure all files are in the same directory
- Check browser console for errors
- Try a different browser
- Clear browser cache

### GitHub Pages Not Working
- Ensure `index.html` is in the root directory
- Check that all files are committed and pushed
- Verify GitHub Pages is enabled in repository settings
- Check Actions tab for deployment errors

## File Structure

```
MyPup/
├── index.html              # Main HTML file
├── styles.css              # Game styling
├── config.js              # Configuration and API keys
├── api.js                 # API integration
├── character.js           # Character customization
├── game.js                # Main game logic
├── README.md              # Project documentation
├── SETUP.md               # This file
├── .gitignore             # Git ignore rules
└── .github/
    └── workflows/
        └── pages.yml      # GitHub Pages deployment workflow
```

## Customization

### Changing Game Settings
Edit `config.js`:
- `GAME_WIDTH` / `GAME_HEIGHT`: Game canvas size
- `GRAVITY`: Physics gravity
- `PLAYER_SPEED`: Character movement speed
- `JUMP_FORCE`: Jump strength
- `SPRITE_SIZE`: Size of each sprite frame

### Adding More Levels
Edit `game.js` in the `create()` method to add more platforms, enemies, or collectibles.

### Styling
Edit `styles.css` to change colors, fonts, and layout.

## Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile browsers: ✅ Works but may need API key entry

## Security Notes

- API keys are stored in browser localStorage only
- No keys are sent to any server except the API providers
- All processing happens client-side
- For production, consider using environment variables or a backend proxy
