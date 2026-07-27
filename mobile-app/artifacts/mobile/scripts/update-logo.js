const fs = require('fs');
const path = require('path');

const imagesDir = path.join(__dirname, '..', 'assets', 'images');
const oldIconPath = path.join(imagesDir, 'icon_old_backup.png');
const iconPath = path.join(imagesDir, 'icon.png');
const newIconPath = path.join(imagesDir, 'icon2.png');

if (fs.existsSync(newIconPath)) {
  if (!fs.existsSync(oldIconPath) && fs.existsSync(iconPath)) {
    fs.copyFileSync(iconPath, oldIconPath);
  }
  fs.copyFileSync(newIconPath, iconPath);
  console.log('[Logo Sync] Successfully replaced icon.png with icon2.png (new logo)');
}
