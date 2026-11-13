const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('masaustu', {
  yedekKaydet: (veri, sonYedege, onerilenAd) => ipcRenderer.invoke('yedek:kaydet', veri, sonYedege, onerilenAd),
  yedekAc: () => ipcRenderer.invoke('yedek:ac'),
  odakla: () => ipcRenderer.send('pencere:odakla'),
  ekKlasorSec: (baslangic) => ipcRenderer.invoke('ek:klasorSec', baslangic),
  ekEkle: (klasor) => ipcRenderer.invoke('ek:ekle', klasor),
  ekKlasorAc: (klasor) => ipcRenderer.invoke('ek:klasorAc', klasor),
  ekAc: (yol) => ipcRenderer.invoke('ek:ac', yol)
});
