const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const ayarDosyasi = () => path.join(app.getPath('userData'), 'son-yedek.json');
function sonYolOku() {
  try { return JSON.parse(fs.readFileSync(ayarDosyasi(), 'utf8')).yol || null; } catch (e) { return null; }
}
function sonYolYaz(yol) {
  try { fs.writeFileSync(ayarDosyasi(), JSON.stringify({ yol })); } catch (e) {}
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: path.join(__dirname, 'build', 'icon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  // Word/Excel çıktısı kaydedilince bilgisayardaki varsayılan programda otomatik aç
  win.webContents.session.on('will-download', (ev, item) => {
    item.once('done', (e2, durum) => {
      const yol = item.getSavePath();
      if (durum === 'completed' && /\.(docx|xlsx)$/i.test(yol)) shell.openPath(yol);
    });
  });
  win.loadFile('index.html');
}

// Yedek kaydet: sonYedege=true ise daha önce seçilen dosyanın üzerine yazar,
// dosya henüz seçilmediyse kaydetme penceresi açar.
ipcMain.handle('yedek:kaydet', async (e, veri, sonYedege, onerilenAd) => {
  try {
    let yol = sonYedege ? sonYolOku() : null;
    if (yol && !fs.existsSync(path.dirname(yol))) yol = null;
    if (!yol) {
      const win = BrowserWindow.fromWebContents(e.sender);
      const r = await dialog.showSaveDialog(win, {
        title: 'Yedek dosyasını kaydet',
        defaultPath: path.join(app.getPath('documents'), sonYedege ? 'ihracat-yedek.json' : onerilenAd),
        filters: [{ name: 'JSON yedek dosyası', extensions: ['json'] }]
      });
      if (r.canceled || !r.filePath) return { iptal: true };
      yol = r.filePath;
      if (sonYedege) sonYolYaz(yol);
    }
    fs.writeFileSync(yol, veri, 'utf8');
    return { ok: true, yol };
  } catch (err) {
    return { ok: false, hata: String(err.message || err) };
  }
});

ipcMain.handle('yedek:ac', async (e) => {
  try {
    const win = BrowserWindow.fromWebContents(e.sender);
    const r = await dialog.showOpenDialog(win, {
      title: 'Yedek dosyasını seç',
      defaultPath: app.getPath('documents'),
      properties: ['openFile'],
      filters: [{ name: 'JSON yedek dosyası', extensions: ['json'] }]
    });
    if (r.canceled || !r.filePaths.length) return { iptal: true };
    return { ok: true, icerik: fs.readFileSync(r.filePaths[0], 'utf8') };
  } catch (err) {
    return { ok: false, hata: String(err.message || err) };
  }
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
