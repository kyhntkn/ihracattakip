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

// ---- Ek dokümanlar: seçilen dosyaları kullanıcının belirlediği klasöre kopyalar ----
const TEHLIKELI_UZANTI = /\.(exe|bat|cmd|com|msi|scr|vbs|vbe|js|jse|wsf|ps1|lnk|reg|hta|jar)$/i;
function guvenliAd(s) {
  return String(s || '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/[. ]+$/, '').trim() || 'Diger';
}
function benzersizYol(dir, ad) {
  let yol = path.join(dir, ad);
  if (!fs.existsSync(yol)) return yol;
  const { name, ext } = path.parse(ad);
  for (let i = 2; i < 1000; i++) {
    yol = path.join(dir, `${name} (${i})${ext}`);
    if (!fs.existsSync(yol)) return yol;
  }
  return path.join(dir, `${name}-${Date.now()}${ext}`);
}
function ekKopyala(klasor, alt, kaynak) {
  const dir = path.join(klasor, guvenliAd(alt));
  fs.mkdirSync(dir, { recursive: true });
  // dosya zaten bu klasördeyse yeniden kopyalama
  if (path.resolve(path.dirname(kaynak)) === path.resolve(dir)) return { ad: path.basename(kaynak), yol: kaynak };
  const hedef = benzersizYol(dir, path.basename(kaynak));
  fs.copyFileSync(kaynak, hedef);
  return { ad: path.basename(hedef), yol: hedef };
}
ipcMain.handle('ek:klasorSec', async (e) => {
  try {
    const win = BrowserWindow.fromWebContents(e.sender);
    const r = await dialog.showOpenDialog(win, {
      title: 'Eklerin kaydedileceği klasörü seçin',
      defaultPath: app.getPath('documents'),
      properties: ['openDirectory', 'createDirectory']
    });
    if (r.canceled || !r.filePaths.length) return { iptal: true };
    return { ok: true, yol: r.filePaths[0] };
  } catch (err) {
    return { ok: false, hata: String(err.message || err) };
  }
});
ipcMain.handle('ek:ekle', async (e, klasor, alt) => {
  try {
    if (!klasor || !fs.existsSync(klasor)) return { ok: false, hata: 'Ek klasörü bulunamadı. Lütfen "Ek klasörünü seç" ile yeniden seçin.' };
    const win = BrowserWindow.fromWebContents(e.sender);
    const r = await dialog.showOpenDialog(win, {
      title: 'Eklenecek dosyaları seçin',
      defaultPath: app.getPath('documents'),
      properties: ['openFile', 'multiSelections']
    });
    if (r.canceled || !r.filePaths.length) return { iptal: true };
    return { ok: true, dosyalar: r.filePaths.map((k) => ekKopyala(klasor, alt, k)) };
  } catch (err) {
    return { ok: false, hata: String(err.message || err) };
  }
});
ipcMain.handle('ek:ac', async (e, yol) => {
  try {
    if (!yol || !fs.existsSync(yol)) return { ok: false, hata: 'Dosya bulunamadı (taşınmış veya silinmiş olabilir):\n' + yol };
    if (TEHLIKELI_UZANTI.test(yol)) return { ok: false, hata: 'Güvenlik nedeniyle bu dosya türü programdan açılamaz.' };
    const hata = await shell.openPath(yol);
    return hata ? { ok: false, hata } : { ok: true };
  } catch (err) {
    return { ok: false, hata: String(err.message || err) };
  }
});

// alert()/confirm() kapandıktan sonra pencere klavye odağını kaybediyor (Windows/Electron hatası);
// pencereyi yeniden odaklayarak giriş alanlarının tekrar çalışmasını sağlar.
ipcMain.on('pencere:odakla', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (!win || win.isDestroyed()) return;
  win.blur();
  win.focus();
  e.sender.focus();
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
