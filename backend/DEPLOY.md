# Quick Deploy Guide

## Step 1: Set Your Gemini API Key

Get your API key from: https://aistudio.google.com/app/apikey

```bash
export GEMINI_API_KEY="your-actual-api-key-here"
```

Verify it's set:
```bash
echo "API key is set: ${GEMINI_API_KEY:0:10}..."
```

## Step 2: Deploy the Function

Make sure you're in the `backend/` directory:

```bash
cd backend
```

Then deploy:

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

**Note**: First deployment takes 3-5 minutes. Be patient!

## Step 3: Get Your Function URL

After deployment completes, get the URL:

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

**Save this URL!** You'll need it for the frontend configuration.

## Step 4: Test the Function (Optional)

Test that it works:

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

If successful, you should see a JSON response.

## Step 5: Update Frontend

1. Open `src/config.ts`
2. Find the backend configuration section
3. Update:
   ```typescript
   BACKEND_API_URL: 'https://apiProxy-xxxxx-uc.a.run.app', // Your actual URL
   USE_BACKEND_PROXY: true,
   ```
4. Rebuild: `npm run build`
5. Deploy to GitHub Pages: `npm run deploy`

## Troubleshooting

### Deployment fails
- Check you're in the `backend/` directory
- Verify API key is set: `echo $GEMINI_API_KEY`
- Check project: `gcloud config get-value project`
- View logs: `gcloud functions logs read apiProxy --gen2 --region=us-central1`

### Function URL not working
- Wait a few minutes after deployment
- Check function status: `gcloud functions describe apiProxy --gen2 --region=us-central1`
- Test with curl (see Step 4)

### CORS errors
- The function allows all origins by default
- For production, update `backend/index.js` to restrict CORS
- Then redeploy
