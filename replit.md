# VIC Genesis V1

VIC is an Android-first, landscape digital companion with a cinematic character presence, natural conversation states, and persistent local memory.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Mobile: Expo Router, React Native, AsyncStorage, SecureStore, Expo Speech

## Where things live

- `artifacts/vic-genesis/app/index.tsx` — main landscape presence, double-tap control overlay, and first-build interaction shell
- `artifacts/vic-genesis/context/VicContext.tsx` — local memory, settings, conversation persistence, and the provider seam for the future live brain
- `artifacts/vic-genesis/lib/voice.ts` — text-to-speech adapter kept separate from the VIC core
- `artifacts/vic-genesis/constants/colors.ts` — Velmora dark palette

## Architecture decisions

- V1 is frontend-first and stores memory, settings, and recent conversation locally with AsyncStorage.
- API keys are saved with SecureStore and are not placed in source code or normal app storage.
- The main surface intentionally has no permanent tabs; double-tap opens the secondary command layer.
- The current conversation response is an honest local shell until a live provider adapter is connected.

## Product

- A cinematic VIC presence with idle, listening, thinking, speaking, and sleeping visual states.
- Double-tap dashboard, memory, settings, and history overlay.
- Explicit “remember that…” memory capture and retrieval.
- Groq/OpenRouter brain selection, English/Hindi/Gujarati language settings, and female system voice output settings.

## User preferences

- Use the supplied VIC visual reference as inspiration; do not generate replacement character images.
- Keep the architecture beginner-friendly, incremental, and clear about unfinished provider integrations.

## Gotchas

- The live STT/LLM pipeline is not connected in the first shell; the composer is a temporary testable fallback for the conversation and memory loop.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
