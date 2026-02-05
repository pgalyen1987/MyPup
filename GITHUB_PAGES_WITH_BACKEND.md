# Hosting on GitHub Pages with Google Cloud Backend

Yes, you can absolutely still host your frontend on GitHub Pages! The architecture works like this:

## Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  GitHub Pages   │────────▶│  Google Cloud    │────────▶│   Gemini API    │
│  (Frontend)     │  HTTPS  │  Functions       │  HTTPS  │                 │
│                 │         │  (Backend Proxy) │         │                 │
└─────────────────┘         └──────────────────┘         └─────────────────┘
     Public                    Secure (API Key)              Google Service
```

- **Frontend**: Hosted on GitHub Pages (free, public)
- **Backend**: Google Cloud Function (handles API key securely)
- **API**: Gemini API (called by backend, not frontend)

## Setup Steps

### 1. Deploy Backend (One-time setup)

Follow the instructions in `backend/README.md` to deploy your Google Cloud Function.

After deployment, you'll get a URL like:
```
https://apiProxy-xxxxx-uc.a.run.app
```

### 2. Configure Frontend

Update `src/config.ts` with your backend URL:

```typescript
// In src/config.ts
BACKEND_API_URL: 'https://apiProxy-xxxxx-uc.a.run.app', // Your Cloud Function URL
USE_BACKEND_PROXY: true, // Enable backend proxy
```

### 3. Deploy to GitHub Pages

The frontend deployment to GitHub Pages remains exactly the same:

```bash
# Build the project
npm run build

# Deploy to GitHub Pages (if using gh-pages)
npm run deploy

# Or push to main branch and enable GitHub Pages in settings
```

## Benefits

✅ **Free frontend hosting** on GitHub Pages  
✅ **Secure API key** stored only on Google Cloud  
✅ **No API key in frontend code** - safe to commit to GitHub  
✅ **CORS handled** by backend  
✅ **Scalable** - Google Cloud Functions auto-scale  

## Configuration Options

You have two modes:

### Mode 1: Backend Proxy (Recommended for Production)
```typescript
USE_BACKEND_PROXY: true,
BACKEND_API_URL: 'https://apiProxy-xxxxx-uc.a.run.app',
```
- ✅ API key never exposed to users
- ✅ Safe to commit to GitHub
- ✅ Better security
- ⚠️ Requires Google Cloud setup (one-time)

### Mode 2: Direct API (Development/Fallback)
```typescript
USE_BACKEND_PROXY: false,
GEMINI_API_KEY: 'your-key-here', // Stored in localStorage
```
- ✅ No backend needed
- ✅ Quick setup
- ⚠️ API key visible in browser DevTools
- ⚠️ Not recommended for production

## Switching Between Modes

The frontend automatically detects which mode to use based on `USE_BACKEND_PROXY`:

- If `true`: All requests go to your backend proxy
- If `false`: Requests go directly to Gemini API (requires API key)

## Cost

- **GitHub Pages**: Free (unlimited)
- **Google Cloud Functions**: 
  - Free tier: 2 million invocations/month
  - After free tier: ~$0.40 per million invocations
  - Typical game usage: < $10/month

## Security Notes

1. **CORS**: The backend allows all origins by default. For production, update `backend/index.js` to restrict to your GitHub Pages domain:
   ```javascript
   'Access-Control-Allow-Origin': 'https://yourusername.github.io'
   ```

2. **API Key**: Never commit your API key to GitHub. It's stored as an environment variable in Google Cloud.

3. **Rate Limiting**: Consider adding rate limiting to prevent abuse (see `backend/README.md`).

## Troubleshooting

### CORS Errors
- Verify backend CORS headers allow your GitHub Pages domain
- Check that `USE_BACKEND_PROXY` is set to `true`
- Ensure `BACKEND_API_URL` is correct

### API Errors
- Check backend logs: `gcloud functions logs read apiProxy --gen2 --region=us-central1`
- Verify API key is set in Cloud Function environment variables
- Test backend directly with curl (see `backend/README.md`)

### Frontend Not Working
- Check browser console for errors
- Verify `USE_BACKEND_PROXY` matches your setup
- Ensure backend URL is accessible (not blocked by firewall)

## Example Workflow

1. **Development**: Use direct API mode locally
   ```typescript
   USE_BACKEND_PROXY: false
   ```

2. **Production**: Use backend proxy on GitHub Pages
   ```typescript
   USE_BACKEND_PROXY: true,
   BACKEND_API_URL: 'https://apiProxy-xxxxx-uc.a.run.app'
   ```

3. **Deploy**: Push to GitHub, GitHub Pages automatically deploys

That's it! Your game is now securely hosted on GitHub Pages with a secure backend.
