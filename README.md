# GPT Realtime Whisper + Translate on Azure

This repo is a pitch-ready Webslides deck for explaining and demonstrating the
new `gpt-realtime-whisper` and `gpt-realtime-translate` models on Azure using
Microsoft Foundry.

The deck is meant for customer conversations, internal demos, and solution
walkthroughs where the story matters as much as the technology. It combines
slides, speaker-friendly copy, and a built-in browser microphone demo so a
presenter can show the models live without leaving the presentation.

## What the demo shows

- **Realtime transcription**: browser microphone audio streams to
  `gpt-realtime-whisper`, and transcript text appears live in the slide.
- **Realtime translation**: one microphone stream produces both the raw source
  transcript and translated output side by side using `gpt-realtime-translate`.
- **Foundry-ready architecture**: the browser talks to a local FastAPI proxy,
  which connects to Azure OpenAI Realtime endpoints.
- **Presenter workflow**: run the interactive deck locally, export private
  PDF/PPTX versions, or publish the static slide deck when the content is safe to
  share publicly.

For the detailed behind-the-scenes flow, protocol differences, and source-linked
walkthrough, see
[`docs/realtime-technical-walkthrough.md`](docs/realtime-technical-walkthrough.md).

## Getting started

### 1. Prerequisites

- Node.js and npm for the Webslides deck.
- Python 3.13 and `uv` for the local FastAPI demo server.
- Azure CLI and Azure Developer CLI (`azd`) for provisioning Azure OpenAI.
- An Azure identity that can create Azure OpenAI resources and role assignments.

### 2. Provision the Foundry models

This repo includes azd-deployable Bicep infrastructure in `infra/`. It creates an
Azure OpenAI resource in **France Central** and deploys:

- `gpt-realtime-whisper` version `2026-05-06`
- `gpt-realtime-translate` version `2026-05-06`

Before running provisioning, confirm the subscription has available
GlobalStandard realtime model quota in France Central. If another deployment
already consumes the quota, keep using that existing resource or free capacity
outside this workflow before running `azd up`.

Sign in, create/select an azd environment, then provision:

```pwsh
azd auth login
az login
azd env new realtime-speech-demo
azd up
```

During `azd up`, Bicep outputs are captured into the azd environment. The
post-provision hook then updates `server/.env` with the created resource name and
deployment names:

```env
AZURE_OPENAI_RESOURCE_NAME=<created-resource-name>
AZURE_OPENAI_REALTIME_DEPLOYMENT=gpt-realtime-whisper
AZURE_OPENAI_REALTIME_TRANSLATION_MODEL=gpt-realtime-translate
AZURE_OPENAI_REALTIME_TRANSLATION_INPUT_TRANSCRIPTION_MODEL=gpt-realtime-whisper
```

Authentication is keyless. The infrastructure assigns the current azd principal
the `Cognitive Services OpenAI User` role on the Azure OpenAI resource so the
server can use `DefaultAzureCredential`.

### 3. Run the local demo

Install and start the slide deck:

```pwsh
npm install
npm run dev
```

Start the local demo server in a second terminal:

```pwsh
cd server
uv sync
uv run fastapi dev
```

Open http://localhost:5173 and use the realtime transcription and translation
slides.

## Run locally

Start the slide deck:

```pwsh
npm install
npm run dev
```

Start the local demo server in a second terminal:

```pwsh
uv sync
uv run fastapi dev
```

Open http://localhost:5173.

The realtime demo requires Azure OpenAI / Microsoft Foundry configuration for
the local server. Start from `server/.env.example`, and see `server/README.md`
for the server-specific setup notes.

## Demo slides

- **Realtime transcription** uses `/realtime/whisper` and can send an optional
  language hint for controlled single-language tests.
- **Realtime translation** uses `/realtime/translation` and lets the presenter
  choose the target output language.

Both demos are local-first: microphone audio stays in the browser and local
proxy path before being sent to the configured Azure Realtime endpoint.

## Present, export, and share

- Use arrow keys to move between slides.
- Use swipe navigation on mobile.
- Use the local export menu to create private files:
  - `exports/webslides.pdf`
  - `exports/webslides.pptx`

Generated files in `exports/` are ignored by git so private presentation
artifacts are not pushed accidentally.

GitHub Pages can host the static slide deck, but the live FastAPI-backed demo
only runs locally unless you point the frontend at a hosted server.

## Customize the deck

Slides live in `src/components/slides/<slide-id>/`, shared UI primitives live in
`src/components/ui`, and theme tokens live in `src/index.css`.

The deck is designed to be edited with GitHub Copilot: ask for slide copy,
layout, theme, or demo changes, then iterate visually in the browser.
