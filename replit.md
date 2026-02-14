# JUNE-X WhatsApp Bot

## Overview
A WhatsApp bot built with Node.js using the Baileys library (@whiskeysockets/baileys). The bot provides various automated commands for WhatsApp groups and individual chats.

## Project Architecture
- **Entry Point**: `server.js` - Express web server (port 5000) that serves the status page and loads the bot (`index.js`)
- **Bot Core**: `index.js` - Main bot logic, WhatsApp connection handling, session management
- **Config**: `config.js` - API endpoints and keys; `settings.js` - Bot settings (name, owner, mode)
- **Commands**: `commands/` - Individual command modules (168+ commands)
- **Libraries**: `lib/` - Utility functions, data helpers, store management
- **Data**: `data/` - JSON-based data storage for bot state
- **Assets**: `assets/` - Media files used by the bot

## Key Dependencies
- `@whiskeysockets/baileys` - WhatsApp Web API
- `express` - Status page web server
- `dotenv` - Environment variable management
- `openai` - OpenAI API client (via Replit AI Integrations)
- `gtts` - Google Text-to-Speech for voice replies
- `ffmpeg` (system) - Media processing and audio/video conversion

## Chatbot (commands/chatbot.js)
The chatbot uses OpenAI via Replit AI Integrations for multi-media responses:
- **Text chat**: gpt-5-mini for conversational responses
- **Image understanding**: Multimodal gpt-5-mini analyzes images/stickers sent to the bot
- **Audio transcription**: gpt-4o-mini-transcribe transcribes voice messages, bot responds to content
- **Video transcription**: Extracts audio from videos via ffmpeg, transcribes with OpenAI
- **Image generation**: Detects "generate/create image" intent, uses gpt-image-1
- **Voice replies**: Detects "voice/audio reply" intent, generates TTS via gtts as WhatsApp voice note
- Activated per-group with `.chatbot on/off` command
- Responds when bot is @mentioned or replied to

## Environment Variables
- `SESSION_ID` - WhatsApp session ID (must start with "JUNE-MD:~" prefix followed by base64 session data)

## Running
- Development: `node server.js` (serves status page on port 5000, starts bot)
- The bot requires a valid SESSION_ID to connect to WhatsApp

## Deployment
- Configured as VM deployment (always-on) since the bot maintains persistent WebSocket connections
