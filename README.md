# File Navigator MCP Server

A Model Context Protocol (MCP) server that provides vim-like file navigation capabilities for large files that don't fit in LLM context. Navigate through files with millions of lines using familiar editor commands.

## Features

- **Efficient Navigation**: Navigate large files (millions of lines) without loading the entire file into memory
- **Vim-like Commands**: Familiar navigation patterns including line jumps, search, and page movements
- **Search Capabilities**: String and regex search with next/previous match navigation
- **Smart Handling**: Graceful handling of EOF, empty files, and out-of-bounds navigation
- **Stateful Navigation**: Maintains cursor position and search state per file

## Tools

### 1. `go_to_line`
Navigate to a specific line number in the file.

**Parameters:**
- `filename` (string, required): Path to the file to navigate
- `line` (number, required): Line number to navigate to (1-based)
- `screen_height` (number, optional): Number of lines to display (default: 30)

**Behavior:**
- Shows N lines starting from the specified line
- Handles out-of-bounds gracefully (clamps to file boundaries)
- Shows line numbers in vim-style format

### 2. `find`
Search for a string or regex pattern in the file.

**Parameters:**
- `filename` (string, required): Path to the file to search
- `pattern` (string, required): String or regex pattern to search for
- `is_regex` (boolean, optional): Whether to treat pattern as regex (default: false)

**Behavior:**
- Finds all matches in the file (up to 1000 for memory safety)
- Moves cursor to first match after current position
- Wraps around to beginning if no match found after cursor
- Returns total match count

### 3. `next_match`
Navigate to the next search match.

**Parameters:**
- `filename` (string, required): Path to the file

**Behavior:**
- Moves to next match in the search results
- Wraps around to first match after last
- Shows match number (e.g., "Match 3 of 10")

### 4. `prev_match`
Navigate to the previous search match.

**Parameters:**
- `filename` (string, required): Path to the file

**Behavior:**
- Moves to previous match in the search results
- Wraps around to last match after first
- Shows match number

### 5. `page_up`
Move up one screen height.

**Parameters:**
- `filename` (string, required): Path to the file

**Behavior:**
- Moves cursor up by screen_height lines
- Stops at beginning of file

### 6. `page_down`
Move down one screen height.

**Parameters:**
- `filename` (string, required): Path to the file

**Behavior:**
- Moves cursor down by screen_height lines
- Shows EOF indicator when at end

## Installation

1. Clone or create the project directory:
```bash
mkdir file-navigator-mcp
cd file-navigator-mcp
```

2. Create the project structure:
```
file-navigator-mcp/
├── src/
│   └── index.ts        # Main server code
├── test/
│   └── test-server.js  # Test script
├── package.json
├── tsconfig.json
└── README.md
```

3. Copy the provided files into their respective locations

4. Install dependencies:
```bash
npm install
```

5. Build the server:
```bash
npm run build
```

## Usage

### Running the Server

```bash
npm run dev
```

### Testing the Server

```bash
npm test
```

This will create a test file with 100,000 lines and demonstrate all navigation features.

### Configuring with Claude Desktop

Add to your `~/Library/Application Support/Claude/claude_desktop_config.json`:

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

## Example Usage in Claude

Once configured, you can use the file navigator in Claude like this:

```
"Please navigate to line 5000 in /path/to/large-file.log"
"Search for ERROR in the file"
"Go to the next match"
"Page down to see more"
```

## Output Format

The server returns vim-style formatted output:

```
  997 | Line 997: This is a regular line in the file
  998 | Line 998: This is a regular line in the file
  999 | Line 999: This is a regular line in the file
 1000 | Line 1000: This is a SPECIAL line with keyword FINDME
 1001 | Line 1001: This is a regular line in the file
 1002 | Line 1002: This is a regular line in the file
```

With EOF indicator when at end:
```
99998 | Line 99998: This is a regular line in the file
99999 | Line 99999: This is a regular line in the file
100000 | Line 100000: This is a SPECIAL line with keyword FINDME
~
~
~
[END OF FILE - 100000 lines total]
```

## Technical Details

- **Memory Efficient**: Uses streaming to read files line by line
- **Async/Await**: All file operations are asynchronous
- **Error Handling**: Graceful handling of file not found, invalid regex, etc.
- **State Management**: Maintains separate navigation state for each file

## Limitations

- Search results are limited to 1000 matches to prevent memory issues
- File must be readable as UTF-8 text
- No support for binary files

## Development

To modify the server:

1. Edit `src/index.ts`
2. Run `npm run build` to compile
3. Test with `npm test`

## License

MIT