# Gemini Reflection Journal

A secure, user-authenticated reflection and journaling web application powered by **Next.js 15 App Router**, **Cloud Firestore**, **Firebase Authentication**, and the **Gemini 3.6 Flash API**.

---

## Architecture & Security Highlights

- **User Identity Isolation**: Integrated with Firebase Authentication (Google Sign-In). No plain passwords or sensitive emails are stored directly.
- **Echoes Semantic Memory (Level-3 RAG)**: Client-side vector similarity search and Gemini-powered contextual reasoning across historical reflections using high-dimensional embeddings (`gemini-embedding-2-preview` and `text-embedding-004`). User maintains absolute consent authority before historical context is active.
- **Owner-Bound Cloud Firestore**: All journal reflections, multi-turn dialogue streams, embeddings, and confirmed echo contexts are saved to Firestore subcollections restricted by security rules (`request.auth.uid == userId`), completely isolating user records.
- **Resilient AI Model Ladder**: Built-in fallback ladder (`gemini-3.6-flash` &rarr; `gemini-3.1-flash-lite` &rarr; `gemini-flash-latest` &rarr; `gemini-3.7-flash`) with error status code recovery.
- **Server-Side Key Protection**: `GEMINI_API_KEY` is kept strictly server-side, never exposed to the client browser.

---

## Threat Summary & Security Controls

| Threat Zone | Identified Risk | Countermeasure Implemented |
| :--- | :--- | :--- |
| **Input Surfaces** | Malicious injection / malformed JSON payloads | Defensive null-safe payload ingestion, strict schema sanitization, and input truncation. |
| **Planning & Reasoning** | System prompt hijacking / instruction override | Explicit role separation, system instructions in `GenerateContentConfig`, and defensive system prompts. |
| **Tool / API Execution** | Resource exhaustion (429/503) & SSRF | Automated 4-tier model fallback ladder with exponential backoff logging and server-side isolation. |
| **Memory & State (RAG & Echoes)** | Cross-user data leakage / IDOR in vector searches | Vector queries and embedding generation are strictly confined to the authenticated user's corpus in Firestore (`users/{userId}/journalEntries`). Vector similarity is NEVER used as an authorization bypass. |
| **Inter-System Communication** | API token leakage & CORS bypass | Server-side API proxying (`/api/gemini/*`) using Google Cloud Secret Manager / environment variables. |

---

## Prerequisites

1. **Google Cloud Project** with billing enabled.
2. **Google Cloud SDK (`gcloud` CLI)** installed and authenticated.
3. **Node.js 20+** and `npm` installed locally.

---

## Step 1: Enable Google Cloud APIs

```bash
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  aiplatform.googleapis.com \
  cloudbuild.googleapis.com \
  --project="YOUR_PROJECT_ID"
```

---

## Step 2: Secret Management Setup

Create and securely store your Gemini API Key in Google Cloud Secret Manager:

```bash
# 1. Create and populate the secret
gcloud secrets create GEMINI_API_KEY \
  --replication-policy="automatic" \
  --project="YOUR_PROJECT_ID"

echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY \
  --data-file=- \
  --project="YOUR_PROJECT_ID"

# 2. Grant the default Cloud Run service account access to read the secret
PROJECT_NUMBER=$(gcloud projects describe YOUR_PROJECT_ID --format="value(projectNumber)")

gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project="YOUR_PROJECT_ID"
```

---

## Step 3: Cloud Firestore Security Rules

Deploy the owner-bound Firestore security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /journalEntries/{entryId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      match /interactions/{interactionId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      match /{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

Deploy rules using Firebase CLI:
```bash
firebase deploy --only firestore:rules
```

---

## Step 4: Deploying to Google Cloud Run

Deploy directly from source:

```bash
gcloud run deploy gemini-reflection-journal \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" \
  --project="YOUR_PROJECT_ID"
```

---

## Step 5: Required Campaign Verification Label

Apply the mandatory verification label to register your Cloud Run deployment for challenge verification:

```bash
gcloud run services update gemini-reflection-journal \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=us-central1 \
  --project="YOUR_PROJECT_ID"
```

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file and configure GEMINI_API_KEY
cp .env.example .env.local

# 3. Start local development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.
