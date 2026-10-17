const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const outputDir = path.join(rootDir, 'www');

const copyTargets = ['index.html', 'css', 'js'];

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

for (const target of copyTargets) {
  const sourcePath = path.join(rootDir, target);
  const destinationPath = path.join(outputDir, target);
  fs.cpSync(sourcePath, destinationPath, { recursive: true, force: true });
}

console.log('www build complete');
