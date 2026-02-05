#!/bin/bash

# MyPup Backend Setup Script
# This script helps set up your Google Cloud project for the backend

set -e  # Exit on error

echo "🚀 MyPup Backend Setup"
echo "======================"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: gcloud CLI is not installed"
    echo "Install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# List projects
echo "📋 Your Google Cloud projects:"
gcloud projects list
echo ""

# Get current project
CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null || echo "")

if [ -n "$CURRENT_PROJECT" ]; then
    echo "Current active project: $CURRENT_PROJECT"
    read -p "Use this project? (y/n): " USE_CURRENT
    if [ "$USE_CURRENT" != "y" ]; then
        CURRENT_PROJECT=""
    fi
fi

# Set project if needed
if [ -z "$CURRENT_PROJECT" ]; then
    echo "Available projects:"
    gcloud projects list --format="table(PROJECT_ID,NAME)"
    echo ""
    read -p "Enter PROJECT ID (not project number) to use: " PROJECT_ID
    if [ -z "$PROJECT_ID" ]; then
        echo "❌ Error: Project ID is required"
        exit 1
    fi
    echo "Setting project to: $PROJECT_ID"
    gcloud config set project $PROJECT_ID
    CURRENT_PROJECT=$PROJECT_ID
fi

# Verify project is set to ID, not number
VERIFY_PROJECT=$(gcloud config get-value project 2>/dev/null)
if [[ "$VERIFY_PROJECT" =~ ^[0-9]+$ ]]; then
    echo "⚠️  WARNING: Project is set to a number, not an ID!"
    echo "Current value: $VERIFY_PROJECT"
    echo "Please set it to the PROJECT_ID (e.g., mypup-485916)"
    echo ""
    read -p "Enter correct PROJECT ID: " CORRECT_ID
    if [ -n "$CORRECT_ID" ]; then
        gcloud config set project $CORRECT_ID
        CURRENT_PROJECT=$CORRECT_ID
        echo "✅ Project set to: $CORRECT_ID"
    fi
fi

echo ""
echo "✅ Using project: $CURRENT_PROJECT"
echo ""

# Check billing
echo "💳 Checking billing status..."
BILLING=$(gcloud billing projects describe $CURRENT_PROJECT --format="value(billingAccountName)" 2>/dev/null || echo "")

if [ -z "$BILLING" ]; then
    echo "⚠️  WARNING: Billing is not enabled for this project!"
    echo "Cloud Functions requires billing to be enabled."
    echo ""
    echo "Please enable billing:"
    echo "1. Go to: https://console.cloud.google.com/billing"
    echo "2. Link a billing account to project: $CURRENT_PROJECT"
    echo "3. Wait a few minutes for it to activate"
    echo ""
    read -p "Press Enter after you've enabled billing, or Ctrl+C to cancel..."
else
    echo "✅ Billing is enabled"
fi

echo ""
echo "🔧 Enabling required APIs..."
echo "This may take a minute..."

# Enable APIs
gcloud services enable cloudfunctions.googleapis.com || echo "⚠️  Failed to enable Cloud Functions API"
gcloud services enable cloudbuild.googleapis.com || echo "⚠️  Failed to enable Cloud Build API"
gcloud services enable run.googleapis.com || echo "⚠️  Failed to enable Cloud Run API"

echo ""
echo "✅ APIs enabled!"
echo ""

# Check if APIs are enabled
echo "Verifying API status..."
gcloud services list --enabled --filter="name:cloudfunctions.googleapis.com OR name:cloudbuild.googleapis.com OR name:run.googleapis.com"

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Set your Gemini API key:"
echo "   export GEMINI_API_KEY='your-api-key-here'"
echo ""
echo "2. Deploy the function:"
echo "   cd backend"
echo "   npm install"
echo "   gcloud functions deploy apiProxy --gen2 --runtime=nodejs20 --region=us-central1 --source=. --entry-point=apiProxy --trigger-http --allow-unauthenticated --set-env-vars GEMINI_API_KEY=\$GEMINI_API_KEY"
echo ""
