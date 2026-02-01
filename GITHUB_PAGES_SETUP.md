# Hosting on GitHub Pages - Security Guide

## ✅ Yes, You Can Host on GitHub Pages!

GitHub Pages is perfect for hosting this game. Here are your security options:

## Option 1: User-Entered Keys (Current Implementation) ✅ RECOMMENDED FOR GITHUB PAGES

**How it works:**
- Users enter their own API key when they first visit the site
- Key is stored in their browser's localStorage (never sent to your server)
- Each user uses their own API quota

**Pros:**
- ✅ No backend needed
- ✅ Works perfectly with GitHub Pages
- ✅ No security risk to you
- ✅ Users control their own API usage
- ✅ Free to host

**Cons:**
- ⚠️ Users need their own API keys
- ⚠️ Keys visible in browser DevTools (but that's the user's key, not yours)

**Implementation:** Already implemented! Just deploy to GitHub Pages.

## Option 2: Backend Proxy + GitHub Pages

**How it works:**
- Frontend hosted on GitHub Pages (free)
- Backend API hosted separately (Vercel, Netlify, Railway, etc.)
- API key stored only on backend

**Pros:**
- ✅ API key never exposed to users
- ✅ You control usage and can implement rate limiting
- ✅ Better security

**Cons:**
- ⚠️ Requires backend hosting (may have costs)
- ⚠️ More complex setup

**Setup:**
1. Host frontend on GitHub Pages
2. Host backend on:
   - **Vercel** (free tier available)
   - **Netlify Functions** (free tier available)
   - **Railway** (free tier available)
   - **Google Cloud Run** (pay per use)
   - **AWS Lambda** (pay per use)

## Option 3: Serverless Functions (GitHub Actions + External)

**How it works:**
- Frontend on GitHub Pages
- API calls go to serverless functions (Vercel/Netlify)
- API key in function environment variables

**Pros:**
- ✅ Free tier available
- ✅ API key secure
- ✅ Easy to set up

**Cons:**
- ⚠️ Requires external service account

## Recommended Setup for GitHub Pages

### For Personal/Portfolio Projects:
**Use Option 1 (User-Entered Keys)**
- Simplest setup
- No backend costs
- Users provide their own keys
- Perfect for GitHub Pages

### For Production/Public Apps:
**Use Option 2 (Backend Proxy)**
- Better user experience (no key entry)
- You control costs
- More professional

## Deployment Steps

### 1. Deploy to GitHub Pages (Current Setup)

```bash
# Push to GitHub
git add .
git commit -m "Initial commit"
git push origin main

# Enable GitHub Pages:
# 1. Go to repository Settings
# 2. Navigate to Pages
# 3. Select source: "Deploy from a branch"
# 4. Choose "main" branch and "/ (root)"
# 5. Click Save
```

Your game will be available at: `https://yourusername.github.io/MyPup/`

### 2. Update API Endpoints (If Using Backend)

If you implement a backend proxy, update `api.js`:

```javascript
// Instead of calling Google APIs directly:
const response = await fetch(`${CONFIG.GEMINI_API_URL}?key=${this.geminiApiKey}`, ...);

// Call your backend proxy:
const response = await fetch('https://your-backend.vercel.app/api/analyze', {
  method: 'POST',
  body: JSON.stringify({ imageBase64 })
});
```

## Security Best Practices for GitHub Pages

1. **Never commit API keys** to the repository
2. **Use .gitignore** to exclude config files with keys
3. **Add security warnings** in README (already done)
4. **For user-entered keys**: Add a note that keys are stored locally
5. **Monitor usage** if you provide a shared key (not recommended)

## Example: Adding Backend Proxy (Optional)

If you want to add a backend later, here's a simple Vercel function:

**`api/proxy-gemini.js`** (for Vercel):
```javascript
export default async function handler(req, res) {
  const { prompt, imageBase64 } = req.body;
  const apiKey = process.env.GEMINI_API_KEY; // Set in Vercel dashboard
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    }
  );
  
  const data = await response.json();
  res.json(data);
}
```

Then update your frontend to call: `https://your-app.vercel.app/api/proxy-gemini`

## Current Status

✅ **Your current setup works perfectly with GitHub Pages!**
- Users enter their own API keys
- No backend needed
- Free hosting
- Secure (each user's key stays in their browser)

Just deploy and you're good to go!
