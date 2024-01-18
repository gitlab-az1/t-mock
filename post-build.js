/* eslint-disable */
/* eslint-enable semi, indent */
"use strict";

const path = require('node:path');
const fs = require('node:fs');

const buildDir = path.resolve(process.cwd(), 'dist');
const srcDir = path.resolve(process.cwd(), 'src');

async function recursiveRemoveDirectoryFiles(dir) {
  if(!fs.existsSync(dir)) return;

  for(const filename of (await fs.promises.readdir(dir))) {
    const stats = await fs.promises.stat(path.join(dir, filename));

    if(stats.isDirectory()) {
      await recursiveRemoveDirectoryFiles(path.join(dir, filename));
    } else {
      await fs.promises.unlink(path.join(dir, filename));
    }
  }

  await fs.promises.rmdir(dir);
}


async function recursiveRemoveUnnecessaryFiles(dir) {
  if(!fs.existsSync(dir)) return;

  for(const filename of (await fs.promises.readdir(dir))) {
    const stats = await fs.promises.stat(path.join(dir, filename));
    
    if(stats.isDirectory()) {
      await recursiveRemoveUnnecessaryFiles(path.join(dir, filename));
    } else if(
      /.spec./.test(filename) /* ||
      filename === '_types.js'*/ ||
      filename.endsWith('.tmp') ||
      filename.indexOf('.d.js') > -1 ||
      //   filename === 'test.js' ||
      filename === 'test.d.ts'
    ) {
      await fs.promises.unlink(path.join(dir, filename));
    }
  }
}


async function main() {
//   await recursiveRemoveDirectoryFiles(path.join(buildDir, 'types'));
  await recursiveRemoveUnnecessaryFiles(buildDir);
  
  if(process.env.NODE_ENV === 'production') {
    await recursiveRemoveDirectoryFiles(path.join(process.cwd(), '.vscode'));
  }
}

main().catch(console.error);