#!/usr/bin/env bash
# One-shot deploy of the static site to Google Cloud Run.
# Usage:
#   ./deploy/deploy.sh <PROJECT_ID> [REGION] [SERVICE] [REPO]
# Example:
#   ./deploy/deploy.sh my-gcp-project europe-west3 java-prep java-prep
#
# Prerequisites (one-time):
#   gcloud auth login
#   gcloud config set project <PROJECT_ID>
#   gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com
#   gcloud artifacts repositories create <REPO> --repository-format=docker --location=<REGION>
#
set -eo pipefail

PROJECT_ID="${1:-$PROJECT_ID}"
REGION="${2:-europe-west3}"
SERVICE="${3:-java-prep}"
REPO="${4:-java-prep}"

export PROJECT_ID REGION SERVICE REPO

if [[ -z "$PROJECT_ID" ]]; then
  echo "Usage: $0 <PROJECT_ID> [REGION] [SERVICE] [REPO]" >&2
  exit 1
fi

IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/site:$(date +%Y%m%d-%H%M%S)"

echo "▶ Project : $PROJECT_ID"
echo "▶ Region  : $REGION"
echo "▶ Service : $SERVICE"
echo "▶ Image   : $IMAGE"
echo

# Make sure required APIs are on
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com \
  --project="$PROJECT_ID"

# Create Artifact Registry repo if missing
if ! gcloud artifacts repositories describe "$REPO" --location="$REGION" --project="$PROJECT_ID" >/dev/null 2>&1; then
  echo "▶ Creating Artifact Registry repo '$REPO' in $REGION…"
  gcloud artifacts repositories create "$REPO" \
    --repository-format=docker \
    --location="$REGION" \
    --description="Java Senior Prep static site" \
    --project="$PROJECT_ID"
fi

# Build with Cloud Build (no local Docker needed)
echo "▶ Submitting build to Cloud Build…"
gcloud builds submit --tag "$IMAGE" --project "$PROJECT_ID" .

# Deploy to Cloud Run
echo "▶ Deploying to Cloud Run…"
gcloud run deploy "$SERVICE" \
  --image="$IMAGE" \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --cpu=1 \
  --memory=256Mi \
  --min-instances=0 \
  --max-instances=3 \
  --concurrency=80 \
  --timeout=30 \
  --project="$PROJECT_ID"

URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT_ID" --format="value(status.url)")
echo
echo "✅ Deployed:   $URL"
echo "✅ Site:       $URL/site/"
echo "✅ Healthcheck: $URL/healthz"
