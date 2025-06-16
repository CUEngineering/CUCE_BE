const fs = require('fs-extra');
const path = require('path');

const sourceDir = path.join(__dirname, 'templates');
const destDir = path.join(__dirname, 'dist', 'templates');

fs.copy(sourceDir, destDir)
  .then(() => console.log('✅ Template directory copied to dist.'))
  .catch((err) => console.error('❌ Error copying template directory:', err));
