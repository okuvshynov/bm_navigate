# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Model Context Protocol (MCP) server that provides vim-like file navigation for large files. It implements efficient streaming-based navigation tools for files that are too large to fit in LLM context windows.

## Common Development Commands

### Build and Development
- `npm run build` - Compile TypeScript to JavaScript in `dist/` directory
- `npm run dev` - Build and run the server locally via stdio
- `npm test` - Build and run the comprehensive test suite with a 100k line test file

### Dependencies
- Main dependency: `@modelcontextprotocol/sdk` for MCP protocol implementation
- Dev dependencies: TypeScript and Node.js types

## Architecture

### Core Components

**MCP Server (`src/index.ts`)**
- Main server implementation using `@modelcontextprotocol/sdk`
- Handles stdio transport for communication with MCP clients
- Implements 6 navigation tools: `go_to_line`, `find`, `next_match`, `prev_match`, `page_up`, `page_down`

**State Management**
- Per-file navigator state stored in global `Map<string, FileNavigatorState>`
- Tracks current line, screen height, search patterns, and match results
- Persistent state across tool calls for the same file

**Memory-Efficient File Handling**
- Streaming file reader using async generators (`readFileLines`)
- Line-by-line processing to handle files with millions of lines
- Search result limiting (MAX_SEARCH_RESULTS = 1000) to prevent memory issues

### Key Design Patterns

**Tool Architecture**: Each navigation tool follows the pattern:
1. Get/create navigator state for the file
2. Validate file accessibility
3. Perform the navigation operation
4. Return formatted vim-style output

**Error Handling**: Graceful handling of file not found, invalid regex patterns, and out-of-bounds navigation with appropriate MCP error codes.

**Output Formatting**: Vim-style line numbering with EOF indicators and proper padding for readability.

## Testing

The test suite (`test/test-server.js`) creates a 100,000 line test file and demonstrates all navigation features including:
- Line jumping and boundary handling
- String and regex search with match navigation
- Page-based movement
- Out-of-bounds behavior

## Configuration for Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "file-navigator": {
      "command": "node",
      "args": ["/path/to/file-navigator-mcp/dist/index.js"]
    }
  }
}
```