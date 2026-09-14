// Copy only the public presentation assets. No repository, configuration or test files.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const files = ['index.html', 'admin.html', 'app.css', 'app.js', 'demo-shell.css',
  'demo-shell.js', 'demo-store.js', 'stories.css', 'stories.js', 'admin.css',
  'admin.js', 'manifest.webmanifest', 'sw.js', 'icon.svg'];
fs.mkdirSync(output, {recursive: true});
for (const file of files) {
  fs.copyFileSync(path.join(root, file), path.join(output, file));
}
console.log(`Prepared ${files.length} public presentation assets.`);
