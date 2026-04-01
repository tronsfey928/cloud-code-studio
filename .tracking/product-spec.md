# Product Specification — CloudCode Studio

## Overview
CloudCode Studio is a web-based AI-powered coding environment that allows users to create workspaces, manage files, and interact with AI coding assistants (OpenCode, Claude Code) through a chat interface in real time.

## Core Features
1. **Authentication**: JWT-based login/register with refresh token rotation
2. **Workspace Management**: Create, list, delete workspaces backed by Git repositories
3. **File Explorer**: Browse, read, write files within workspaces
4. **AI Chat**: Real-time chat with AI coding assistants via WebSocket
5. **OpenCode/Claude Code Integration**: Configurable LLM provider, model, API key per workspace
6. **MCP Server Support**: Configure MCP servers (SSE/stdio) per workspace

## Architecture
- **Backend**: NestJS + TypeORM (MySQL)
- **Frontend**: React 19 + TailwindCSS v4 + shadcn/ui + Zustand
- **Real-time**: Socket.IO WebSocket gateway
- **Auth**: JWT access tokens + opaque refresh tokens

## Status
- Backend: Migrated to NestJS + TypeORM ✅
- Frontend: Migrated to TailwindCSS v4 + shadcn/ui ✅
