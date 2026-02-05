# MyPup Backend - Google Cloud Functions

This backend service securely proxies Gemini API requests, keeping the API key on the server side.

**Having issues?** See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common problems and solutions.

## Setup Instructions

### Prerequisites

1. **Google Cloud Account**: Sign up at https://cloud.google.com
2. **Google Cloud SDK**: Install from https://cloud.google.com/sdk/docs/install
3. **Node.js 20+**: Required for local development

### Initial Setup

#### Option 1: Use the Setup Script (Recommended)

The easiest way to set everything up:

```bash
cd backend
./setup.sh
```

The script will:
- Show your existing projects
- Let you choose or create a project
- Check billing status
- Enable all required APIs
- Guide you through deployment

#### Option 2: Manual Setup

1. **Authenticate with Google Cloud** (if not already done):
   ```bash
   gcloud auth login
   ```

2. **List your existing projects**:
   ```bash
   gcloud projects list
   ```
   
   You should see your project(s). Example output:
   ```
   PROJECT_ID      NAME   PROJECT_NUMBER
   mypup-485916    MyPup  405732840874
   ```

3. **Set the active project**:
   ```bash
   # Use your actual project ID from the list above
   gcloud config set project mypup-485916
   
   # Verify it's set correctly:
   gcloud config get-value project
   ```
   
   **Note**: Replace `mypup-485916` with your actual project ID if different.

4. **Set up billing** (required for Cloud Functions):
   - Go to https://console.cloud.google.com/billing
   - Select your project (`mypup-485916` or your project ID)
   - Link a billing account
   - **Important**: Cloud Functions requires billing to be enabled
   - Wait 2-3 minutes for billing to activate

5. **Enable required APIs**:
   ```bash
   gcloud services enable cloudfunctions.googleapis.com
   gcloud services enable cloudbuild.googleapis.com
   gcloud services enable run.googleapis.com
   ```
   
   **Troubleshooting**:
   - If you get "PERMISSION_DENIED": Make sure billing is enabled and wait a few minutes
   - If you get "Project not found": Verify project ID with `gcloud config get-value project`
   - If APIs fail to enable: Try enabling them via the web console at https://console.cloud.google.com/apis/library

6. **Verify APIs are enabled**:
   ```bash
   gcloud services list --enabled --filter="name:cloudfunctions.googleapis.com OR name:cloudbuild.googleapis.com OR name:run.googleapis.com"
   ```
   
   You should see all three APIs listed.

### Deploy the Function

1. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set your Gemini API key**:
   ```bash
   # Replace YOUR_API_KEY_HERE with your actual Gemini API key
   # Get your key from: https://aistudio.google.com/app/apikey
   export GEMINI_API_KEY="YOUR_API_KEY_HERE"
   
   # Verify it's set (don't worry, this won't show the full key)
   echo "API key is set: ${GEMINI_API_KEY:0:10}..."
   ```

4. **Deploy the function**:
   ```bash
   gcloud functions deploy apiProxy \
     --gen2 \
     --runtime=nodejs20 \
     --region=us-central1 \
     --source=. \
     --entry-point=apiProxy \
     --trigger-http \
     --allow-unauthenticated \
     --set-env-vars GEMINI_API_KEY=$GEMINI_API_KEY \
     --memory=512MB \
     --timeout=540s
   ```
   
   **Note**: 
   - First deployment may take 3-5 minutes
   - Make sure you're in the `backend/` directory
   - The function name `apiProxy` must match the function name in `index.js`

5. **Get the function URL**:
   ```bash
   gcloud functions describe apiProxy \
     --gen2 \
     --region=us-central1 \
     --format="value(serviceConfig.uri)"
   ```

   This will output something like:
   ```
   https://apiProxy-xxxxx-uc.a.run.app
   ```
   
   **Save this URL** - you'll need it for the frontend configuration!

6. **Test the function** (optional):
   ```bash
   # Replace URL with your actual function URL
   curl -X POST https://apiProxy-xxxxx-uc.a.run.app \
     -H "Content-Type: application/json" \
     -d '{
       "endpoint": "generateContent",
       "model": "gemini-2.5-flash",
       "requestBody": {
         "contents": [{
           "parts": [{"text": "Say hello"}]
         }]
       }
     }'
   ```
   
   If successful, you should see a JSON response with text from Gemini.

### Update Frontend Configuration

1. **Get your function URL** (if you haven't already):
   ```bash
   gcloud functions describe apiProxy \
     --gen2 \
     --region=us-central1 \
     --format="value(serviceConfig.uri)"
   ```

2. **Update `src/config.ts`**:
   ```typescript
   // In src/config.ts, find the backend configuration section:
   BACKEND_API_URL: 'https://apiProxy-xxxxx-uc.a.run.app', // Your actual URL from step 1
   USE_BACKEND_PROXY: true, // Set to true to use backend proxy
   ```
   
   **Important**: 
   - Replace `https://apiProxy-xxxxx-uc.a.run.app` with your actual function URL
   - Set `USE_BACKEND_PROXY: true` to enable the backend proxy
   - When `USE_BACKEND_PROXY` is `false`, the frontend will use direct API calls (requires API key in localStorage)

3. **Rebuild and deploy**:
   ```bash
   # Build the frontend
   npm run build
   
   # Deploy to GitHub Pages (or your hosting)
   npm run deploy
   ```

4. **Verify it works**:
   - Open your game in a browser
   - Check the browser console for any errors
   - Try generating a sprite or background
   - The API calls should now go through your backend proxy

## Security Best Practices

### 1. Restrict CORS (Production)

For production, update `backend/index.js` to restrict CORS to your GitHub Pages domain:

```javascript
// In backend/index.js, find the corsHeaders section:
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://yourusername.github.io', // Your GitHub Pages URL
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '3600'
};
```

Then redeploy:
```bash
gcloud functions deploy apiProxy --gen2 --runtime=nodejs20 --region=us-central1 --source=. --entry-point=apiProxy --trigger-http --allow-unauthenticated --set-env-vars GEMINI_API_KEY=$GEMINI_API_KEY
```

### 2. Add Rate Limiting

Consider adding rate limiting to prevent abuse:
- Use Cloud Armor
- Implement request quotas in the function
- Add authentication for production use

### 3. Monitor Usage

Set up monitoring and alerts:
```bash
# View logs
gcloud functions logs read apiProxy --gen2 --region=us-central1

# Set up alerts in Cloud Console
# https://console.cloud.google.com/monitoring/alerting
```

### 4. Cost Management

- Set up billing alerts
- Monitor function invocations
- Consider request quotas for free tier users

## Local Development

1. **Install dependencies**:
   ```bash
   cd backend
   npm install
   ```

2. **Set environment variable**:
   ```bash
   export GEMINI_API_KEY="your-api-key-here"
   ```

3. **Run locally**:
   ```bash
   npm start
   ```

4. **Test the function**:
   ```bash
   curl -X POST http://localhost:8080 \
     -H "Content-Type: application/json" \
     -d '{
       "endpoint": "generateContent",
       "model": "gemini-2.5-flash",
       "requestBody": {
         "contents": [{
           "parts": [{"text": "Hello"}]
         }]
       }
     }'
   ```

## Updating the Function

After making changes to `backend/index.js` or `backend/package.json`:

```bash
cd backend

# If you changed package.json, reinstall dependencies locally (optional, Cloud Build will do this)
npm install

# Redeploy (don't forget to include the API key environment variable)
gcloud functions deploy apiProxy \
  --gen2 \
  --runtime=nodejs20 \
  --region=us-central1 \
  --source=. \
  --entry-point=apiProxy \
  --trigger-http \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=$GEMINI_API_KEY
```

**Note**: If you update the API key, you need to redeploy with the new key in the environment variables.

## Troubleshooting

### Function not deploying
- Check billing is enabled
- Verify APIs are enabled
- Check quota limits

### CORS errors
- Verify CORS headers in `index.js`
- Check function URL is correct
- Ensure `allow-unauthenticated` flag is set

### API key errors
- Verify `GEMINI_API_KEY` is set correctly
- Check environment variables: `gcloud functions describe apiProxy --gen2 --region=us-central1`
- Re-deploy with correct key if needed

## Cost Estimation

Cloud Functions (2nd gen) pricing:
- **Free tier**: 2 million invocations/month
- **After free tier**: $0.40 per million invocations
- **Compute time**: $0.0000025 per GB-second
- **Memory**: $0.0000025 per GB-second

For a game with moderate usage, expect < $10/month.
