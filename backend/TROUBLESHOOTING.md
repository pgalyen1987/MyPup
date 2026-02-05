# Troubleshooting Google Cloud Setup

## Project Not Found Error

If you see:
```
ERROR: (gcloud.services.enable) PERMISSION_DENIED: Project 'xxx' not found or permission denied.
```

### Solution 1: Check Your Projects

List all projects you have access to:
```bash
gcloud projects list
```

### Solution 2: Create a New Project

**Option A: Via Command Line**
```bash
# Generate a unique project ID (project IDs must be globally unique)
PROJECT_ID="mypup-game-$(date +%s)"
gcloud projects create $PROJECT_ID --name="MyPup Game"
gcloud config set project $PROJECT_ID
```

**Option B: Via Web Console (Recommended)**
1. Go to https://console.cloud.google.com/projectcreate
2. Enter a project name (e.g., "MyPup Game")
3. Note the Project ID that Google generates (it will be unique)
4. Click "Create"
5. Set it as your active project:
   ```bash
   gcloud config set project YOUR_PROJECT_ID
   ```

### Solution 3: Use an Existing Project

If you have existing projects:
```bash
# List projects
gcloud projects list

# Set one as active
gcloud config set project EXISTING_PROJECT_ID

# Verify
gcloud config get-value project
```

## Permission Denied Errors

### Check Your Role

You need "Owner" or "Editor" role on the project:

1. Go to https://console.cloud.google.com/iam-admin/iam
2. Select your project
3. Find your email address
4. Verify you have "Owner" or "Editor" role

### Enable Billing

Cloud Functions requires billing to be enabled:

1. Go to https://console.cloud.google.com/billing
2. Select your project
3. Link a billing account
4. Wait a few minutes for it to activate

### Verify Project Settings

```bash
# Check current project
gcloud config get-value project

# Check if billing is enabled
gcloud billing projects describe $(gcloud config get-value project)

# If billing is not linked, you'll see an error
```

## API Enable Errors

If APIs fail to enable:

1. **Wait a few minutes** - Sometimes there's a delay after project creation
2. **Check billing** - APIs won't enable without billing
3. **Try enabling via console**:
   - Go to https://console.cloud.google.com/apis/library
   - Search for "Cloud Functions API"
   - Click "Enable"
   - Repeat for "Cloud Build API" and "Cloud Run API"

## Common Issues

### Issue: "Project not found"
- **Cause**: Wrong project ID or project doesn't exist
- **Fix**: Create new project or use existing one

### Issue: "Permission denied"
- **Cause**: No billing or insufficient permissions
- **Fix**: Enable billing and verify you have Owner/Editor role

### Issue: "API not enabled"
- **Cause**: Billing not enabled or project just created
- **Fix**: Enable billing, wait a few minutes, try again

### Issue: "Quota exceeded"
- **Cause**: Too many projects or API calls
- **Fix**: Wait a few minutes or use existing project

## Quick Setup Script

Run this to set up everything:

```bash
#!/bin/bash

# 1. List existing projects
echo "Your projects:"
gcloud projects list

# 2. Ask user to choose
read -p "Enter project ID to use (or press Enter to create new): " PROJECT_ID

if [ -z "$PROJECT_ID" ]; then
    # Create new project
    PROJECT_ID="mypup-game-$(date +%s)"
    echo "Creating project: $PROJECT_ID"
    gcloud projects create $PROJECT_ID --name="MyPup Game"
fi

# 3. Set as active
echo "Setting project to: $PROJECT_ID"
gcloud config set project $PROJECT_ID

# 4. Verify
echo "Current project: $(gcloud config get-value project)"

# 5. Check billing
echo "Checking billing..."
gcloud billing projects describe $PROJECT_ID || echo "⚠️  Billing not enabled! Enable it at: https://console.cloud.google.com/billing"

# 6. Enable APIs
echo "Enabling APIs..."
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com

echo "✅ Setup complete!"
```

Save as `setup.sh`, make executable (`chmod +x setup.sh`), and run it.
