const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
  fs.readdir(dir, (err, files) => {
    if (err) return;
    files.forEach((file) => {
      const filepath = path.join(dir, file);
      fs.stat(filepath, (err, stats) => {
        if (err) return;
        if (stats.isDirectory()) {
          if (file === 'node_modules' && dir !== process.cwd()) {
            // Only traverse top-level node_modules, avoid nested ones if not needed
          }
          // Do not traverse certain folders to save time
          if (file !== '.git' && file !== '.expo' && file !== '.expo-shared') {
            walk(filepath, callback);
          }
        } else if (stats.isFile() && (file.endsWith('.js') || file.endsWith('.mjs') || file.endsWith('.ts') || file.endsWith('.tsx'))) {
          callback(filepath);
        }
      });
    });
  });
}

const nodeModulesPath = path.join(process.cwd(), 'node_modules');

console.log('Searching for private fields/methods in node_modules...');

walk(nodeModulesPath, (filepath) => {
  // Read file content
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    // Remove comments first to avoid false positives (both single line and multi-line comments)
    const cleanContent = content
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*/g, '');

    // Match private fields/methods like #privateField or #privateMethod
    // Look for `#` followed by a valid JS identifier, where it is not part of a color hex, a URL hash, a markdown link, etc.
    // In JS, private fields usually appear as:
    // class X { #field; ... }
    // or this.#field
    const regex = /(?:class\s+\w+[\s\S]*?\{[\s\S]*?\s+#\w+[\s;=]|\bthis\.#\w+)/g;
    
    if (regex.test(cleanContent)) {
      // Find exact lines
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        const cleanLine = line.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
        if (/(?:\bthis\.#\w+|#\w+\s*[=;()])/g.test(cleanLine)) {
          // Exclude template literals/strings containing '#' just in case
          console.log(`Found in: ${path.relative(process.cwd(), filepath)} (line ${idx + 1}):`);
          console.log(`  ${line.trim()}`);
        }
      });
    }
  } catch (e) {
    // Ignore errors
  }
});
