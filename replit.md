# JUNE-X WhatsApp Bot

## Overview
A WhatsApp bot built with Node.js using the Baileys library (@whiskeysockets/baileys). The bot provides various commands including AI integrations, group management, media tools, games, and more.

## Project Architecture
- **Runtime**: Node.js 20
- **Entry Point**: `index.js`
- **Config**: `config.js` (loads from environment variables)
- **Commands**: `commands/` directory - each file is a bot command
- **Libraries**: `lib/` directory - utility functions, database helpers, converters
- **Assets**: `assets/` directory - images and stickers
- **Data**: `data/` directory - JSON-based persistent storage for bot state

## Key Dependencies
- `@whiskeysockets/baileys` - WhatsApp Web API
- `axios` - HTTP requests
- `ffmpeg` (system) + `fluent-ffmpeg` - Media processing
- `jimp` - Image manipulation
- `dotenv` - Environment variable management

## Environment Variables
- `SESSION_ID` - WhatsApp session identifier (required for bot connection)

## Running the Bot
The bot runs as a console application via `node index.js`. On startup, it prompts for login method:
1. Enter WhatsApp number (pairing code)
2. Paste session ID

## Recent Changes
- 2026-02-13: JID/LID handling fix - created lib/jid.js with centralized normalization for dual JID format (@s.whatsapp.net and @lid), updated isAdmin, isOwner, isBanned to use it
- 2026-02-13: Welcome/goodbye fix - bound missing group-participants.update event in index.js, exported getWelcome/getGoodbye from lib/welcome.js
- 2026-02-13: Help menu reorganization - categorized commands into 14 groups (AI, Media, Group, Games, etc.)
- 2026-02-13: Performance optimizations - cached groupMetadata (120s TTL, max 200 entries), cached mode data (5s TTL), fixed call event listener leak, centralized decodeJid
- 2026-02-13: Initial Replit setup - installed Node.js 20, ffmpeg, npm dependencies, configured workflow
