/**
 * Simple runner for OCR E2E tests
 * Captures output and writes to file for debugging
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const testFile = path.join(__dirname, 'ocr-e2e-test.ts');
const outputFile = path.join(__dirname, 'ocr-test-output.log');

console.log('Starting OCR E2E tests...');
console.log(`Test file: ${testFile}`);
console.log(`Output will be logged to: ${outputFile}`);

// Check if test file exists
if (!fs.existsSync(testFile)) {
  console.error(`Test file not found: ${testFile}`);
  process.exit(1);
}

// Run the test
const child = spawn('npx', ['ts-node', testFile], {
  cwd: path.join(__dirname, '..'),
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true
});

let stdout = '';
let stderr = '';

child.stdout.on('data', (data) => {
  const text = data.toString();
  stdout += text;
  process.stdout.write(text); // Also write to console
});

child.stderr.on('data', (data) => {
  const text = data.toString();
  stderr += text;
  process.stderr.write(text); // Also write to console
});

child.on('close', (code) => {
  // Write output to file
  const output = `=== STDOUT ===\n${stdout}\n\n=== STDERR ===\n${stderr}\n\n=== EXIT CODE ===\n${code}\n`;
  fs.writeFileSync(outputFile, output);
  
  console.log(`\n\nTest completed with exit code: ${code}`);
  console.log(`Full output saved to: ${outputFile}`);
  
  process.exit(code);
});

child.on('error', (error) => {
  console.error('Failed to start test process:', error);
  process.exit(1);
});

