import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs/promises";
import * as path from "path";

interface FileNavigatorState {
  currentFile: string | null;
  currentLine: number;
  screenHeight: number;
  searchPattern: string | null;
  searchMatches: Array<{ line: number; content: string }>;
  currentMatchIndex: number;
}

// Global state for file navigation
const navigatorStates = new Map<string, FileNavigatorState>();

// Configuration
const DEFAULT_SCREEN_HEIGHT = 30;
const MAX_SEARCH_RESULTS = 1000; // Prevent memory issues with huge files

// Helper function to get or create navigator state
function getNavigatorState(filename: string): FileNavigatorState {
  if (!navigatorStates.has(filename)) {
    navigatorStates.set(filename, {
      currentFile: filename,
      currentLine: 1,
      screenHeight: DEFAULT_SCREEN_HEIGHT,
      searchPattern: null,
      searchMatches: [],
      currentMatchIndex: -1,
    });
  }
  return navigatorStates.get(filename)!;
}

// Helper function to read file lines efficiently
async function* readFileLines(filePath: string): AsyncGenerator<string> {
  const fileHandle = await fs.open(filePath, 'r');
  const stream = fileHandle.createReadStream({ encoding: 'utf8' });
  
  let buffer = '';
  
  for await (const chunk of stream) {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    
    for (const line of lines) {
      yield line;
    }
  }
  
  if (buffer) {
    yield buffer;
  }
  
  await fileHandle.close();
}

// Helper function to get total lines in file
async function getTotalLines(filePath: string): Promise<number> {
  let count = 0;
  for await (const _ of readFileLines(filePath)) {
    count++;
  }
  return count;
}

// Helper function to get lines from file
async function getLines(
  filePath: string,
  startLine: number,
  count: number
): Promise<Array<{ lineNumber: number; content: string }>> {
  const lines: Array<{ lineNumber: number; content: string }> = [];
  let currentLine = 1;
  
  for await (const line of readFileLines(filePath)) {
    if (currentLine >= startLine && currentLine < startLine + count) {
      lines.push({ lineNumber: currentLine, content: line });
    }
    if (currentLine >= startLine + count) {
      break;
    }
    currentLine++;
  }
  
  return lines;
}

// Helper function to format screen output
function formatScreen(
  lines: Array<{ lineNumber: number; content: string }>,
  totalLines: number
): string {
  if (lines.length === 0) {
    return "~\n(empty file)";
  }
  
  const maxLineNumWidth = Math.max(
    totalLines.toString().length,
    lines[lines.length - 1].lineNumber.toString().length
  );
  
  const formattedLines = lines.map(({ lineNumber, content }) => {
    const lineNumStr = lineNumber.toString().padStart(maxLineNumWidth, ' ');
    return `${lineNumStr} | ${content}`;
  });
  
  // Add empty lines indicator if at end of file
  const lastLineNumber = lines[lines.length - 1].lineNumber;
  if (lastLineNumber >= totalLines) {
    for (let i = lines.length; i < DEFAULT_SCREEN_HEIGHT; i++) {
      formattedLines.push('~'.padStart(maxLineNumWidth + 1, ' '));
    }
    formattedLines.push(`[END OF FILE - ${totalLines} lines total]`);
  }
  
  return formattedLines.join('\n');
}

// Create server instance
const server = new Server(
  {
    name: "file-navigator",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "go_to_line",
        description: "Navigate to a specific line number in the file",
        inputSchema: {
          type: "object",
          properties: {
            filename: {
              type: "string",
              description: "Path to the file to navigate",
            },
            line: {
              type: "number",
              description: "Line number to navigate to (1-based)",
            },
            screen_height: {
              type: "number",
              description: "Number of lines to display (default: 30)",
              default: DEFAULT_SCREEN_HEIGHT,
            },
          },
          required: ["filename", "line"],
        },
      },
      {
        name: "find",
        description: "Search for a string or regex pattern in the file",
        inputSchema: {
          type: "object",
          properties: {
            filename: {
              type: "string",
              description: "Path to the file to search",
            },
            pattern: {
              type: "string",
              description: "String or regex pattern to search for",
            },
            is_regex: {
              type: "boolean",
              description: "Whether to treat pattern as regex (default: false)",
              default: false,
            },
          },
          required: ["filename", "pattern"],
        },
      },
      {
        name: "next_match",
        description: "Navigate to the next search match",
        inputSchema: {
          type: "object",
          properties: {
            filename: {
              type: "string",
              description: "Path to the file",
            },
          },
          required: ["filename"],
        },
      },
      {
        name: "prev_match",
        description: "Navigate to the previous search match",
        inputSchema: {
          type: "object",
          properties: {
            filename: {
              type: "string",
              description: "Path to the file",
            },
          },
          required: ["filename"],
        },
      },
      {
        name: "page_up",
        description: "Move up one screen height",
        inputSchema: {
          type: "object",
          properties: {
            filename: {
              type: "string",
              description: "Path to the file",
            },
          },
          required: ["filename"],
        },
      },
      {
        name: "page_down",
        description: "Move down one screen height",
        inputSchema: {
          type: "object",
          properties: {
            filename: {
              type: "string",
              description: "Path to the file",
            },
          },
          required: ["filename"],
        },
      },
    ],
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  // Type guard for arguments
  if (!args || typeof args !== 'object') {
    throw new McpError(ErrorCode.InvalidParams, "Invalid arguments");
  }

  // Extract filename outside try block for error handling
  const filename = args.filename as string;

  try {
    // Validate file exists for all tools
    if (filename) {
      await fs.access(filename);
    }

    switch (name) {
      case "go_to_line": {
        const line = args.line as number;
        const screenHeight = args.screen_height as number | undefined;
        
        const state = getNavigatorState(filename);
        const totalLines = await getTotalLines(filename);
        
        if (screenHeight) {
          state.screenHeight = screenHeight;
        }
        
        // Handle out of bounds
        state.currentLine = Math.max(1, Math.min(line, totalLines));
        
        const lines = await getLines(
          filename,
          state.currentLine,
          state.screenHeight
        );
        
        return {
          content: [
            {
              type: "text",
              text: formatScreen(lines, totalLines),
            },
          ],
        };
      }

      case "find": {
        const pattern = args.pattern as string;
        const isRegex = args.is_regex as boolean | undefined;
        
        const state = getNavigatorState(filename);
        state.searchMatches = [];
        state.currentMatchIndex = -1;
        
        let searchRegex: RegExp;
        if (isRegex) {
          try {
            searchRegex = new RegExp(pattern, 'gi');
          } catch (e: any) {
            throw new McpError(
              ErrorCode.InvalidParams,
              `Invalid regex pattern: ${e.message}`
            );
          }
        } else {
          // Escape special regex characters for literal search
          const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          searchRegex = new RegExp(escaped, 'gi');
        }
        
        state.searchPattern = pattern;
        
        // Search through file
        let lineNum = 1;
        let firstMatchAfterCursor: { line: number; content: string } | null = null;
        
        for await (const line of readFileLines(filename)) {
          if (searchRegex.test(line)) {
            const match = { line: lineNum, content: line };
            state.searchMatches.push(match);
            
            // Track first match after current cursor
            if (!firstMatchAfterCursor && lineNum >= state.currentLine) {
              firstMatchAfterCursor = match;
              state.currentMatchIndex = state.searchMatches.length - 1;
            }
            
            // Prevent memory issues with huge files
            if (state.searchMatches.length >= MAX_SEARCH_RESULTS) {
              break;
            }
          }
          lineNum++;
        }
        
        // If no match after cursor, wrap to beginning
        if (!firstMatchAfterCursor && state.searchMatches.length > 0) {
          firstMatchAfterCursor = state.searchMatches[0];
          state.currentMatchIndex = 0;
        }
        
        if (firstMatchAfterCursor) {
          state.currentLine = firstMatchAfterCursor.line;
          const lines = await getLines(
            filename,
            state.currentLine,
            state.screenHeight
          );
          const totalLines = await getTotalLines(filename);
          
          return {
            content: [
              {
                type: "text",
                text: `Found match 1 of ${state.searchMatches.length}\n\n${formatScreen(lines, totalLines)}`,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: "text",
                text: `Pattern not found: "${pattern}"`,
              },
            ],
          };
        }
      }

      case "next_match": {
        const state = getNavigatorState(filename);
        
        if (state.searchMatches.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No active search. Use 'find' first.",
              },
            ],
          };
        }
        
        // Move to next match (with wrapping)
        state.currentMatchIndex = (state.currentMatchIndex + 1) % state.searchMatches.length;
        const match = state.searchMatches[state.currentMatchIndex];
        state.currentLine = match.line;
        
        const lines = await getLines(
          filename,
          state.currentLine,
          state.screenHeight
        );
        const totalLines = await getTotalLines(filename);
        
        return {
          content: [
            {
              type: "text",
              text: `Match ${state.currentMatchIndex + 1} of ${state.searchMatches.length}\n\n${formatScreen(lines, totalLines)}`,
            },
          ],
        };
      }

      case "prev_match": {
        const state = getNavigatorState(filename);
        
        if (state.searchMatches.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No active search. Use 'find' first.",
              },
            ],
          };
        }
        
        // Move to previous match (with wrapping)
        state.currentMatchIndex = state.currentMatchIndex - 1;
        if (state.currentMatchIndex < 0) {
          state.currentMatchIndex = state.searchMatches.length - 1;
        }
        
        const match = state.searchMatches[state.currentMatchIndex];
        state.currentLine = match.line;
        
        const lines = await getLines(
          filename,
          state.currentLine,
          state.screenHeight
        );
        const totalLines = await getTotalLines(filename);
        
        return {
          content: [
            {
              type: "text",
              text: `Match ${state.currentMatchIndex + 1} of ${state.searchMatches.length}\n\n${formatScreen(lines, totalLines)}`,
            },
          ],
        };
      }

      case "page_up": {
        const state = getNavigatorState(filename);
        state.currentLine = Math.max(1, state.currentLine - state.screenHeight);
        
        const lines = await getLines(
          filename,
          state.currentLine,
          state.screenHeight
        );
        const totalLines = await getTotalLines(filename);
        
        return {
          content: [
            {
              type: "text",
              text: formatScreen(lines, totalLines),
            },
          ],
        };
      }

      case "page_down": {
        const state = getNavigatorState(filename);
        const totalLines = await getTotalLines(filename);
        state.currentLine = Math.min(
          totalLines,
          state.currentLine + state.screenHeight
        );
        
        const lines = await getLines(
          filename,
          state.currentLine,
          state.screenHeight
        );
        
        return {
          content: [
            {
              type: "text",
              text: formatScreen(lines, totalLines),
            },
          ],
        };
      }

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new McpError(
        ErrorCode.InvalidParams,
        `File not found: ${filename}`
      );
    }
    throw error;
  }
});

// Main function
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("File Navigator MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});