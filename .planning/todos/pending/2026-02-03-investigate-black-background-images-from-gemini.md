---
created: 2026-02-03T18:00:00
title: Investigate black background images from Gemini
area: api
files:
  - src/api.ts:1218-1294
---

## Problem

User reports seeing all black backgrounds in the game. The background sprite is rendering (not a visibility issue), but the images returned from Gemini API are completely black. This suggests either:
1. Gemini model is returning black/empty images
2. Base64 data is corrupted during transmission
3. Resize function is creating black images
4. Model is refusing to generate and returning invalid data

Need to add better error handling and logging to diagnose what Gemini is actually returning.

## Solution

Add comprehensive logging and validation:
1. Log raw API response structure before parsing
2. Validate base64 data integrity (check length, format)
3. Add image content analysis before and after resize
4. Check for model refusal messages in response
5. Add fallback/retry logic if images are black
6. Verify model endpoint is correct for image generation

