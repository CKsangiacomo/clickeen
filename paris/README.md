# Paris

Cloudflare Worker API service.

This README is a quick operational guide. For the full endpoint and behavior contract, see:

- `documentation/services/paris.md`

## Endpoints

Core shipped endpoints in this repo snapshot include:

- `GET /api/healthz`
- no public/product read routes

## Auth

Public in this repo snapshot:

- `GET /api/healthz`

Paris no longer exposes non-public account-mode product endpoints.

## Local dev

`pnpm dev:paris`

## Deploy

`pnpm --filter @clickeen/paris deploy`
