# Agent Session Management API

## responsibility

Agent session management APIs are exposed through dedicated session services.

## implementation notes

`platform-chat-service` calls `platform-agent-runtime-service` for session reads and turn/run control.

Session setup writes go through the shared session repository, not this management API.
