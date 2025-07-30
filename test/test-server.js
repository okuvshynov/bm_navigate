import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";

// Create a test file
async function createTestFile() {
  const testDir = "test-data";
  const testFile = path.join(testDir, "large-file.txt");
  
  try {
    await fs.mkdir(testDir, { recursive: true });
    
    // Create a file with 100,000 lines
    const lines = [];
    for (let i = 1; i <= 100000; i++) {
      if (i % 1000 === 0) {
        lines.push(`Line ${i}: This is a SPECIAL line with keyword FINDME`);
      } else if (i % 100 === 0) {
        lines.push(`Line ${i}: This line contains the word TEST`);
      } else {
        lines.push(`Line ${i}: This is a regular line in the file`);
      }
    }
    
    await fs.writeFile(testFile, lines.join('\n'));
    console.log(`Created test file: ${testFile} with 100,000 lines`);
    return testFile;
  } catch (error) {
    console.error("Error creating test file:", error);
    throw error;
  }
}

async function testFileNavigator() {
  const testFile = await createTestFile();
  
  const transport = new StdioClientTransport({
    command: "node",
    args: ["dist/index.js"],
  });
  
  const client = new Client(
    {
      name: "file-navigator-test-client",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );
  
  try {
    await client.connect(transport);
    console.log("Connected to File Navigator MCP Server\n");
    
    // Test 1: Go to line
    console.log("=== Test 1: Go to line 1000 ===");
    const result1 = await client.callTool("go_to_line", {
      filename: testFile,
      line: 1000,
      screen_height: 10
    });
    console.log(result1.content[0].text);
    console.log("\n");
    
    // Test 2: Go to end of file (beyond bounds)
    console.log("=== Test 2: Go to line 500000 (beyond EOF) ===");
    const result2 = await client.callTool("go_to_line", {
      filename: testFile,
      line: 500000
    });
    console.log(result2.content[0].text);
    console.log("\n");
    
    // Test 3: Search for pattern
    console.log("=== Test 3: Search for 'FINDME' ===");
    const result3 = await client.callTool("find", {
      filename: testFile,
      pattern: "FINDME",
      is_regex: false
    });
    console.log(result3.content[0].text);
    console.log("\n");
    
    // Test 4: Next match
    console.log("=== Test 4: Next match ===");
    const result4 = await client.callTool("next_match", {
      filename: testFile
    });
    console.log(result4.content[0].text);
    console.log("\n");
    
    // Test 5: Previous match
    console.log("=== Test 5: Previous match ===");
    const result5 = await client.callTool("prev_match", {
      filename: testFile
    });
    console.log(result5.content[0].text);
    console.log("\n");
    
    // Test 6: Page down
    console.log("=== Test 6: Page down ===");
    const result6 = await client.callTool("page_down", {
      filename: testFile
    });
    console.log(result6.content[0].text);
    console.log("\n");
    
    // Test 7: Page up
    console.log("=== Test 7: Page up ===");
    const result7 = await client.callTool("page_up", {
      filename: testFile
    });
    console.log(result7.content[0].text);
    console.log("\n");
    
    // Test 8: Regex search
    console.log("=== Test 8: Regex search for 'Line \\d{4}:' ===");
    const result8 = await client.callTool("find", {
      filename: testFile,
      pattern: "Line \\d{4}:",
      is_regex: true
    });
    console.log(result8.content[0].text);
    console.log("\n");
    
  } catch (error) {
    console.error("Error during testing:", error);
  } finally {
    await client.close();
  }
}

// Run the test
testFileNavigator().catch(console.error);