const fs = require('fs');
const path = require('path');

const imagesDir = path.join(__dirname, '..', 'assets', 'images');
const oldIconPath = path.join(imagesDir, 'icon_old_backup.png');
const iconPath = path.join(imagesDir, 'icon.png');

if (fs.existsSync(oldIconPath)) {
  fs.copyFileSync(oldIconPath, iconPath);
  console.log('[Logo Sync] Successfully replaced icon.png with icon_old_backup.png');
}

