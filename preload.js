const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('masaustu', {
  yedekKaydet: (veri, sonYedege, onerilenAd) => ipcRenderer.invoke('yedek:kaydet', veri, sonYedege, onerilenAd),
  yedekAc: () => ipcRenderer.invoke('yedek:ac')
});
