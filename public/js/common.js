/**
 * WeaselParts - Gemeinsame Funktionen für alle Seiten
 * Mit Apple-Style Scanner-Logik
 */

document.addEventListener('DOMContentLoaded', function() {
  // Prüfen, ob API verfügbar ist
  testApiConnection();
  
  // Navigation-Links aktivieren
  highlightActiveNavLink();
  
  // Global Search Setup
  setupGlobalSearch();
  
  // Tastatur-Shortcuts
  setupKeyboardShortcuts();
  
  // Globaler Scanner initialisieren
  initializeGlobalScanner();
});

/**
 * Testet die Verbindung zur API
 */
async function testApiConnection() {
  try {
    await api.testConnection();
    console.log('✅ WeaselParts API-Verbindung erfolgreich hergestellt');
  } catch (error) {
    console.error('❌ WeaselParts API-Verbindung fehlgeschlagen:', error);
    showMessage('Verbindung zum Server fehlgeschlagen. Bitte versuche es später erneut.', 'error');
  }
}

/**
 * Hebt den aktiven Navigations-Link hervor
 */
function highlightActiveNavLink() {
  const currentPath = window.location.pathname;
  
  // Alle aktiven Klassen entfernen
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Aktiven Button markieren basierend auf der aktuellen Seite
  if (currentPath === '/' || currentPath === '/index.html') {
    // Hauptseite - kein spezieller Button
  } else if (currentPath.includes('add-component')) {
    const addBtn = document.querySelector('[onclick*="add-component"]');
    if (addBtn) addBtn.classList.add('active');
  } else if (currentPath.includes('manage-cabinets')) {
    const cabinetBtn = document.querySelector('[onclick*="manage-cabinets"]');
    if (cabinetBtn) cabinetBtn.classList.add('active');
  }
}

/**
 * Richtet die globale Suche ein
 */
function setupGlobalSearch() {
  const globalSearch = document.getElementById('global-search');
  if (!globalSearch) return;
  
  let searchTimeout;
  
  globalSearch.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      handleGlobalSearchInput(e.target.value);
    }, 300); // Debounce für bessere Performance
  });
  
  globalSearch.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      performGlobalSearch(e.target.value);
    }
  });
}

/**
 * Behandelt die Eingabe in der globalen Suche
 * @param {string} query - Suchbegriff
 */
function handleGlobalSearchInput(query) {
  if (query.length < 2) return;
  
  // Suche nur auf der Hauptseite durchführen
  if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
    if (typeof handleGlobalSearch === 'function') {
      handleGlobalSearch();
    }
  }
}

/**
 * Führt eine globale Suche durch und navigiert zu den Ergebnissen
 * @param {string} query - Suchbegriff
 */
async function performGlobalSearch(query) {
  if (!query.trim()) return;
  
  try {
    const results = await api.searchComponents(query);
    
    if (results.length === 0) {
      showMessage(`Keine Bauteile gefunden für "${query}"`, 'info');
      return;
    }
    
    if (results.length === 1) {
      // Direkt zum Bauteil navigieren
      window.location.href = `/edit-component.html?barcode=${encodeURIComponent(results[0].barcode)}`;
    } else {
      // Zur Hauptseite mit Suchergebnissen
      window.location.href = `/?search=${encodeURIComponent(query)}`;
    }
  } catch (error) {
    showMessage(`Fehler bei der Suche: ${error.message}`, 'error');
  }
}

/**
 * Richtet Tastatur-Shortcuts ein
 */
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Shortcuts nur wenn kein Input-Feld fokussiert ist
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }
    
    // Ctrl/Cmd + Shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'n':
          e.preventDefault();
          window.location.href = '/add-component.html';
          break;
        case 'h':
          e.preventDefault();
          window.location.href = '/';
          break;
        case 'k':
          e.preventDefault();
          document.getElementById('global-search')?.focus();
          break;
      }
    }
    
    // Einzelne Tasten
    switch (e.key) {
      case 'Escape':
        closeAllModals();
        break;
      case 'F1':
        e.preventDefault();
        showKeyboardShortcuts();
        break;
    }
  });
}

/**
 * Schließt alle offenen Modals
 */
function closeAllModals() {
  document.querySelectorAll('.modal.active').forEach(modal => {
    modal.classList.remove('active');
  });
}

/**
 * Zeigt eine Liste der verfügbaren Tastatur-Shortcuts
 */
function showKeyboardShortcuts() {
  const shortcuts = [
    'Strg+N - Neues Bauteil',
    'Strg+H - Zur Hauptseite',
    'Strg+K - Suche fokussieren',
    'Esc - Modals schließen',
    'F1 - Diese Hilfe'
  ];
  
  showMessage(`Tastatur-Shortcuts:\n${shortcuts.join('\n')}`, 'info');
}

/**
 * Zeigt eine Toast-Nachricht an
 * @param {string} message - Der anzuzeigende Text
 * @param {string} type - Der Typ der Nachricht (success, error, warning, info)
 * @param {number} duration - Anzeigedauer in Millisekunden (default: 5000)
 */
function showMessage(message, type = 'info', duration = 5000) {
  // Toast-Container erstellen oder abrufen
  let container = document.getElementById('toast-container');
  
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  
  // Toast erstellen
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  // Icon basierend auf Typ
  let icon = '';
  switch (type) {
    case 'success':
      icon = '✅';
      break;
    case 'error':
      icon = '❌';
      break;
    case 'warning':
      icon = '⚠️';
      break;
    case 'info':
    default:
      icon = 'ℹ️';
      break;
  }
  
  toast.innerHTML = `
    <div class="toast-content">
      <span class="toast-icon">${icon}</span>
      <span class="toast-message">${message.replace(/\n/g, '<br>')}</span>
      <button class="close-btn" onclick="this.parentElement.parentElement.remove()">&times;</button>
    </div>
  `;
  
  // Toast zum Container hinzufügen
  container.appendChild(toast);
  
  // Animation für Eingang
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  // Toast nach einer Weile ausblenden
  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 300);
  }, duration);
}

// Globale showMessage verfügbar machen
window.showMessage = showMessage;

/**
 * Exportiert Daten als CSV-Datei
 * @param {Array} data - Die zu exportierenden Daten
 * @param {string} filename - Der Name der CSV-Datei
 */
function exportToCSV(data, filename = 'weaselparts_export.csv') {
  if (!data || data.length === 0) {
    showMessage('Keine Daten zum Exportieren vorhanden.', 'warning');
    return;
  }
  
  // Spaltenüberschriften ermitteln
  const headers = Object.keys(data[0]);
  
  // CSV-Header
  let csvContent = headers.join(',') + '\n';
  
  // CSV-Zeilen
  data.forEach(item => {
    const values = headers.map(header => {
      const value = item[header] || '';
      // Werte mit Kommas in Anführungszeichen setzen
      return `"${value.toString().replace(/"/g, '""')}"`;
    });
    csvContent += values.join(',') + '\n';
  });
  
  // Download-Link erstellen
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showMessage(`Daten als ${filename} exportiert!`, 'success');
}

// Globale exportToCSV verfügbar machen
window.exportToCSV = exportToCSV;

/**
 * Formatiert ein Datum als deutsches Datumsformat
 * @param {Date|string} date - Das zu formatierende Datum
 * @returns {string} Formatiertes Datum
 */
function formatDate(date) {
  if (!date) return '';
  
  const d = new Date(date);
  return d.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Generiert eine eindeutige ID
 * @param {string} prefix - Präfix für die ID
 * @returns {string} Eindeutige ID
 */
function generateId(prefix = 'wp') {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Validiert einen Barcode
 * @param {string} barcode - Der zu validierende Barcode
 * @returns {boolean} True wenn gültig
 */
function validateBarcode(barcode) {
  if (!barcode || typeof barcode !== 'string') {
    return false;
  }
  
  // Mindestens 3 Zeichen, nur alphanumerisch und Bindestriche
  const barcodeRegex = /^[A-Za-z0-9\-_]{3,50}$/;
  return barcodeRegex.test(barcode);
}

/**
 * Validiert eine E-Mail-Adresse
 * @param {string} email - Die zu validierende E-Mail
 * @returns {boolean} True wenn gültig
 */
function validateEmail(email) {
  if (!email) return false;
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Kopiert Text in die Zwischenablage
 * @param {string} text - Der zu kopierende Text
 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showMessage('In Zwischenablage kopiert!', 'success', 2000);
  } catch (error) {
    console.error('Fehler beim Kopieren:', error);
    showMessage('Kopieren fehlgeschlagen', 'error');
  }
}

/**
 * Lädt ein Bild und gibt eine Data-URL zurück
 * @param {File} file - Die Bilddatei
 * @returns {Promise<string>} Data-URL des Bildes
 */
function loadImageAsDataURL(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Datei ist kein Bild'));
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Fehler beim Laden des Bildes'));
    reader.readAsDataURL(file);
  });
}

/**
 * Komprimiert ein Bild
 * @param {File} file - Die Bilddatei
 * @param {number} maxWidth - Maximale Breite
 * @param {number} maxHeight - Maximale Höhe
 * @param {number} quality - Qualität (0-1)
 * @returns {Promise<Blob>} Komprimiertes Bild
 */
function compressImage(file, maxWidth = 800, maxHeight = 600, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      // Seitenverhältnis berechnen
      let { width, height } = img;
      
      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Bild zeichnen
      ctx.drawImage(img, 0, 0, width, height);
      
      // Als Blob zurückgeben
      canvas.toBlob(resolve, 'image/jpeg', quality);
    };
    
    img.onerror = () => reject(new Error('Fehler beim Laden des Bildes'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Debounce-Funktion für bessere Performance
 * @param {Function} func - Die zu verzögernde Funktion
 * @param {number} wait - Wartezeit in Millisekunden
 * @returns {Function} Debounced Funktion
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Prüft, ob das Gerät ein Touchscreen hat
 * @returns {boolean} True wenn Touchscreen
 */
function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/**
 * Lädt Daten mit Loading-Indikator
 * @param {Function} asyncFunction - Die async Funktion
 * @param {string} loadingMessage - Loading-Nachricht
 * @returns {Promise} Ergebnis der Funktion
 */
async function withLoading(asyncFunction, loadingMessage = 'Lädt...') {
  const loadingToast = showMessage(loadingMessage, 'info', 30000);
  
  try {
    const result = await asyncFunction();
    return result;
  } catch (error) {
    throw error;
  } finally {
    // Loading-Toast entfernen
    setTimeout(() => {
      const toasts = document.querySelectorAll('.toast');
      toasts.forEach(toast => {
        if (toast.textContent.includes(loadingMessage)) {
          toast.remove();
        }
      });
    }, 100);
  }
}

// Globale Event-Listener für bessere UX
document.addEventListener('click', (e) => {
  // Automatisches Schließen von Dropdowns beim Klick außerhalb
  if (!e.target.closest('.dropdown')) {
    document.querySelectorAll('.dropdown.open').forEach(dropdown => {
      dropdown.classList.remove('open');
    });
  }
});

// Performance-Monitoring
if (typeof performance !== 'undefined') {
  window.addEventListener('load', () => {
    setTimeout(() => {
      const perfData = performance.getEntriesByType('navigation')[0];
      if (perfData) {
        console.log(`🚀 WeaselParts geladen in ${Math.round(perfData.loadEventEnd - perfData.fetchStart)}ms`);
      }
    }, 0);
  });
}

/**
/**
 * WeaselParts - Globaler Barcode-Scanner mit Apple-Style
 * VERSION 2 - Double-Scan und Layout repariert
 */

// Globale Scanner-Variablen
let scannerBuffer = '';
let scannerTimeout = null;
let lastInputTime = 0;
let isScanning = false;
let currentScannedComponent = null;
let lastScannedBarcode = null; // Für Double-Scan-Erkennung
let doubleScanTimeout = null;

// Schwellenwerte für Scanner-Erkennung
const SCANNER_MIN_LENGTH = 8;
const SCANNER_MAX_TIME = 400;
const SCANNER_END_DELAY = 100;

/**
 * Initialisiert den globalen Barcode-Scanner
 */
function initializeGlobalScanner() {
  console.log('🔍 Globaler Barcode-Scanner initialisiert (V2)');
  
  // Globaler Keydown-Listener für Scanner-Erkennung
  document.addEventListener('keydown', handleGlobalKeyInput, true);
  
  // Zusätzliche Scanner-Events
  document.addEventListener('paste', handlePasteEvent);
  
  // Scanner-Modal wird nur bei Bedarf erstellt (nicht automatisch)
  // ensureScannerModalExists(); // DEAKTIVIERT - Modal wird nur bei Bedarf erstellt
}

/**
 * Behandelt globale Tastatureingaben für Scanner-Erkennung
 */
/**
 * REPARIERTER SCANNER-CODE - Buffer-Problem gelöst
 * Ersetze den Scanner-Teil in deiner common.js ab "function initializeGlobalScanner()"
 */

/**
 * Initialisiert den globalen Barcode-Scanner (V2-FIXED)
 */
function initializeGlobalScanner_V2() {
  console.log('🔍 Globaler Barcode-Scanner initialisiert (V2-FIXED)');
  
  // Globaler Keydown-Listener für Scanner-Erkennung
  document.addEventListener('keydown', handleGlobalKeyInput, true);
  
  // Zusätzliche Scanner-Events
  document.addEventListener('paste', handlePasteEvent);
  
  // Scanner-Modal wird nur bei Bedarf erstellt (nicht automatisch)
  // ensureScannerModalExists(); // DEAKTIVIERT - Modal wird nur bei Bedarf erstellt
}

/**
 * Behandelt globale Tastatureingaben für Scanner-Erkennung
 */
function handleGlobalKeyInput(e) {
  // Ignoriere Eingaben wenn bereits in Input-Feldern oder Modals offen
const scannerModal = document.getElementById('scanner-modal');
const scannerOpen   = scannerModal && scannerModal.classList.contains('active');
if ( isInputFocused()
  || ( isModalOpen() && !scannerOpen )
) {
  return;
}
  
  const currentTime = Date.now();
  
  // Scanner-Eingabe erkennen (schnelle aufeinanderfolgende Zeichen)
  if (e.key.length === 1) {
    const timeDiff = currentTime - lastInputTime;
    
    // KRITISCHER FIX: Buffer komplett leeren bei zu großer Zeitlücke
    if (timeDiff > SCANNER_MAX_TIME) {
      console.log('🔄 Buffer reset - Zeitlücke:', timeDiff + 'ms');
      scannerBuffer = '';
      isScanning = true;
    }
    
    scannerBuffer += e.key;
    lastInputTime = currentTime;
    
    console.log('📝 Buffer aktuell:', scannerBuffer, 'Länge:', scannerBuffer.length);
    
    clearTimeout(scannerTimeout);
    scannerTimeout = setTimeout(() => {
      processScannerInput();
    }, SCANNER_END_DELAY);
    
    if (isScanning && scannerBuffer.length > 3) {
      e.preventDefault();
      e.stopPropagation();
    }
  }
  
  // Enter-Taste beendet Scan sofort
  if (e.key === 'Enter' && isScanning && scannerBuffer.length >= SCANNER_MIN_LENGTH) {
    e.preventDefault();
    e.stopPropagation();
    clearTimeout(scannerTimeout);
    processScannerInput();
  }
}

/**
 * Behandelt Paste-Events
 */
function handlePasteEvent(e) {
  if (isInputFocused() || isModalOpen()) {
    return;
  }
  
  const pastedText = e.clipboardData.getData('text').trim();
  
  if (isValidBarcodeFormat(pastedText)) {
    e.preventDefault();
    console.log('📋 Paste-Event:', pastedText);
    // KRITISCHER FIX: Buffer komplett leeren vor Paste
    scannerBuffer = '';
    scannerBuffer = pastedText;
    processScannerInput();
  }
}

/**
 * Verarbeitet den gescannten Barcode - HAUPTLOGIK (BUFFER-FIX)
 */
function processScannerInput() {
  const rawBuffer = scannerBuffer;
  
  if (!rawBuffer || rawBuffer.length < SCANNER_MIN_LENGTH) {
    console.log('❌ Buffer zu kurz:', rawBuffer, 'Länge:', rawBuffer.length);
    resetScanner();
    return;
  }
  
  // KRITISCHER FIX: Buffer bereinigen und trimmen
  const barcode = rawBuffer.trim();
  
  console.log('🔍 Raw Buffer:', rawBuffer);
  console.log('✂️ Bereinigter Barcode:', barcode);
  console.log('📏 Länge:', barcode.length);
  
  if (!isValidBarcodeFormat(barcode)) {
    console.log('❌ Ungültiges Barcode-Format:', barcode);
    resetScanner();
    return;
  }
  
  console.log('📷 Barcode gescannt:', barcode);
  console.log('🔍 Letzter Barcode:', lastScannedBarcode);
  console.log('⏰ Double-Scan-Timeout aktiv:', !!doubleScanTimeout);
  
  // **KRITISCHER FIX: Verbesserte Double-Scan-Erkennung**
  if (lastScannedBarcode === barcode && doubleScanTimeout) {
    console.log('🔄 Double-Scan erkannt für:', barcode);
    clearTimeout(doubleScanTimeout);
    doubleScanTimeout = null;
    lastScannedBarcode = null;
    
    // KRITISCHER FIX: Buffer SOFORT leeren
    resetScanner();
    
    handleDoubleScan(barcode);
    return;
  }
  
  // Ersten Scan speichern
  lastScannedBarcode = barcode;
  
  // Double-Scan-Möglichkeit für 5 Sekunden aktivieren
  if (doubleScanTimeout) {
    clearTimeout(doubleScanTimeout);
  }
  
  doubleScanTimeout = setTimeout(() => {
    console.log('⏰ Double-Scan-Zeitfenster abgelaufen für:', barcode);
    lastScannedBarcode = null;
    doubleScanTimeout = null;
  }, 5000);
  
  console.log('✅ Double-Scan-Fenster aktiviert für 5 Sekunden');
  
  // KRITISCHER FIX: Buffer SOFORT leeren nach erfolgreicher Verarbeitung
  resetScanner();
  
  // Normaler Scan-Prozess
  handleFirstScan(barcode);
}

/**
 * Behandelt den ersten Scan eines Barcodes
 */
async function handleFirstScan(barcode) {
  try {
    console.log('🔍 Erste Scan-Verarbeitung für:', barcode);
    
    // Versuche Bauteil zu laden
    const component = await api.getComponent(barcode);
    currentScannedComponent = component;
    
    console.log('✅ Bauteil gefunden:', component);
    console.log('📦 Schrank-ID:', component.schrank_id);
    console.log('🏢 Schrank-Name:', component.schrank_name);
    
    // **LOGIK 1 & 2: Prüfen ob eingelagert oder nicht**
    if (component.schrank_id && component.schrank_name) {
      // LOGIK 2: Bauteil EINGELAGERT → Info-Modal mit Auslagern-Hinweis
      console.log('📦 Bauteil ist eingelagert in:', component.schrank_name);
      showInfoModal(component);
    } else {
      // LOGIK 1: Bauteil NICHT EINGELAGERT → Schrank-Auswahl
      console.log('📭 Bauteil ist nicht eingelagert');
      showStorageModal(component);
    }
    
  } catch (error) {
    console.error('❌ Fehler beim Laden des Bauteils:', error);
    
    if (error.message.includes('nicht gefunden')) {
      // LOGIK 4: Unbekannter Barcode → Registrierung
      console.log('❓ Unbekanntes Bauteil:', barcode);
      showUnknownBarcodeModal(barcode);
    } else {
      showMessage(`Fehler: ${error.message}`, 'error');
    }
  }
}

/**
 * Behandelt Double-Scan (zweites Scannen des gleichen Barcodes)
 */
async function handleDoubleScan(barcode) {
  try {
    console.log('🔄 Double-Scan wird verarbeitet für:', barcode);
    
    // Bauteil NEU laden um aktuellen Status zu prüfen
    const component = await api.getComponent(barcode);
    console.log('🔍 Aktueller Component-Status:', component);
    
    if (component.schrank_id && component.schrank_name) {
      // LOGIK 3: Zweites Scannen → Sofort auslagern
      console.log('📤 Lagere Bauteil aus:', component.name);
      
      await api.removeComponent(barcode);
      console.log('✅ Auslagern API-Call erfolgreich');
      
      // Rotes Modal anzeigen
      showRemovalSuccessModal(component);
      
      // Lokale Updates NACH dem Modal
      setTimeout(() => {
        updateLocalData();
      }, 1000);
      
    } else {
      // Bauteil ist bereits ausgelagert
      console.log('⚠️ Bauteil ist bereits ausgelagert');
      showMessage('Bauteil ist bereits ausgelagert', 'info');
    }
    
  } catch (error) {
    console.error('❌ Fehler beim Double-Scan:', error);
    showMessage(`Fehler beim Auslagern: ${error.message}`, 'error');
  }
}

/**
 * Schließt den globalen Scanner (BUFFER-FIX)
 */
function closeGlobalScanner() {
  console.log('❌ Schließe globalen Scanner');
  
  const modal = document.getElementById('scanner-modal');
  if (modal) {
    modal.classList.remove('active');
    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) {
      modalContent.classList.remove('removal-state', 'storage-state');
    }
  }
  
  // KRITISCHER FIX: Komplettes Reset
  resetScanner();
  currentScannedComponent = null;
  
  // Double-Scan-State KOMPLETT zurücksetzen
  console.log('🔄 Setze Double-Scan-State zurück');
  lastScannedBarcode = null;
  if (doubleScanTimeout) {
    clearTimeout(doubleScanTimeout);
    doubleScanTimeout = null;
  }
}

/**
 * KRITISCHER FIX: Verbessertes Scanner-Reset
 */
function resetScanner() {
  console.log('🔄 Scanner-Buffer wird zurückgesetzt. Alt:', scannerBuffer);
  scannerBuffer = '';
  isScanning = false;
  lastInputTime = 0;
  clearTimeout(scannerTimeout);
  console.log('✅ Scanner-Buffer zurückgesetzt. Neu:', scannerBuffer);
}

/**
 * Verbesserte Barcode-Validierung
 */
function isValidBarcodeFormat(barcode) {
  if (!barcode || typeof barcode !== 'string') return false;
  
  // Mindestens 8 Zeichen, nur alphanumerisch und erlaubte Sonderzeichen
  const barcodeRegex = /^[A-Za-z0-9\-_]{8,50}$/;
  const isValid = barcodeRegex.test(barcode);
  
  console.log('🔍 Barcode-Validierung:', barcode, '→', isValid ? '✅' : '❌');
  return isValid;
}

/**
 * Verarbeitet den gescannten Barcode - HAUPTLOGIK (REPARIERT V2)
 */
function processScannerInput() {
  if (!scannerBuffer || scannerBuffer.length < SCANNER_MIN_LENGTH) {
    resetScanner();
    return;
  }
  
  const barcode = scannerBuffer.trim();
  
  if (!isValidBarcodeFormat(barcode)) {
    resetScanner();
    return;
  }
  
  console.log('📷 Barcode gescannt:', barcode);
  console.log('🔍 Letzter Barcode:', lastScannedBarcode);
  console.log('⏰ Double-Scan-Timeout aktiv:', !!doubleScanTimeout);
  
  // **KRITISCHER FIX V2: Verbesserte Double-Scan-Erkennung**
  if (lastScannedBarcode === barcode && doubleScanTimeout) {
    console.log('🔄 Double-Scan erkannt für:', barcode);
    clearTimeout(doubleScanTimeout);
    doubleScanTimeout = null;
    lastScannedBarcode = null;
    handleDoubleScan(barcode);
    resetScanner();
    return;
  }
  
  // Ersten Scan speichern
  lastScannedBarcode = barcode;
  
  // Double-Scan-Möglichkeit für 5 Sekunden aktivieren
  if (doubleScanTimeout) {
    clearTimeout(doubleScanTimeout);
  }
  
  doubleScanTimeout = setTimeout(() => {
    console.log('⏰ Double-Scan-Zeitfenster abgelaufen für:', barcode);
    lastScannedBarcode = null;
    doubleScanTimeout = null;
  }, 5000);
  
  console.log('✅ Double-Scan-Fenster aktiviert für 5 Sekunden');
  
  // Normaler Scan-Prozess
  handleFirstScan(barcode);
  resetScanner();
}

/**
 * Behandelt den ersten Scan eines Barcodes (REPARIERT V2)
 */
async function handleFirstScan(barcode) {
  try {
    console.log('🔍 Erste Scan-Verarbeitung für:', barcode);
    
    // Versuche Bauteil zu laden
    const component = await api.getComponent(barcode);
    currentScannedComponent = component;
    
    console.log('✅ Bauteil gefunden:', component);
    console.log('📦 Schrank-ID:', component.schrank_id);
    console.log('🏢 Schrank-Name:', component.schrank_name);
    
    // **LOGIK 1 & 2: Prüfen ob eingelagert oder nicht**
    if (component.schrank_id && component.schrank_name) {
      // LOGIK 2: Bauteil EINGELAGERT → Info-Modal mit Auslagern-Hinweis
      console.log('📦 Bauteil ist eingelagert in:', component.schrank_name);
      showInfoModal(component);
    } else {
      // LOGIK 1: Bauteil NICHT EINGELAGERT → Schrank-Auswahl
      console.log('📭 Bauteil ist nicht eingelagert');
      showStorageModal(component);
    }
    
  } catch (error) {
    console.error('❌ Fehler beim Laden des Bauteils:', error);
    
    if (error.message.includes('nicht gefunden')) {
      // LOGIK 4: Unbekannter Barcode → Registrierung
      console.log('❓ Unbekanntes Bauteil:', barcode);
      showUnknownBarcodeModal(barcode);
    } else {
      showMessage(`Fehler: ${error.message}`, 'error');
    }
  }
}

/**
 * Behandelt Double-Scan (zweites Scannen des gleichen Barcodes) (REPARIERT V2)
 */
async function handleDoubleScan(barcode) {
  try {
    console.log('🔄 Double-Scan wird verarbeitet für:', barcode);
    
    // Bauteil NEU laden um aktuellen Status zu prüfen
    const component = await api.getComponent(barcode);
    console.log('🔍 Aktueller Component-Status:', component);
    
    if (component.schrank_id && component.schrank_name) {
      // LOGIK 3: Zweites Scannen → Sofort auslagern
      console.log('📤 Lagere Bauteil aus:', component.name);
      
      await api.removeComponent(barcode);
      console.log('✅ Auslagern API-Call erfolgreich');
      
      // Rotes Modal anzeigen
      showRemovalSuccessModal(component);
      
      // Lokale Updates NACH dem Modal
      setTimeout(() => {
        updateLocalData();
      }, 1000);
      
    } else {
      // Bauteil ist bereits ausgelagert
      console.log('⚠️ Bauteil ist bereits ausgelagert');
      showMessage('Bauteil ist bereits ausgelagert', 'info');
    }
    
  } catch (error) {
    console.error('❌ Fehler beim Double-Scan:', error);
    showMessage(`Fehler beim Auslagern: ${error.message}`, 'error');
  }
}

/**
 * LOGIK 2: Zeigt Info-Modal für eingelagertes Bauteil (UNVERÄNDERT)
 */
function showInfoModal(component) {
  console.log('🔍 Zeige Info-Modal für eingelagertes Bauteil');
  
  const modal = ensureScannerModalExists();
  if (!modal) {
    console.error('❌ Failed to create or find scanner modal in showInfoModal');
    return;
  }
  
  // Modal Inhalt für eingelagertes Bauteil
  const modalContent = modal.querySelector('.modal-content');
  if (!modalContent) {
    console.error('❌ Modal content not found in showInfoModal');
    return;
  }
  modalContent.className = 'modal-content scanner-content wide-modal';
  
  // Header
  const header = modal.querySelector('.scanner-header');
  if (!header) {
    console.error('❌ Scanner header not found in showInfoModal');
    return;
  }
  header.style.background = 'var(--primary-green)';
  const headerTitle = header.querySelector('h2');
  if (headerTitle) {
    headerTitle.textContent = 'Bauteil gefunden';
  }
  
  // Body mit Apple-Style Layout
  const body = modal.querySelector('.scanner-body');
  if (!body) {
    console.error('❌ Scanner body not found in showInfoModal');
    return;
  }
  body.innerHTML = `
    <div class="scanner-component-section">
      <div class="scanner-info-display">
        <div class="scanned-card enhanced">
          <div class="card-header">
            <h3>${component.name || 'Unbenannt'}</h3>
            <span class="status-badge stored">Eingelagert in ${component.schrank_name}</span>
          </div>
          
          <div class="card-content">
            <div class="scanned-image">
              ${component.image_url ? 
                `<img src="${component.image_url}" alt="${component.name}">` :
                '<div class="placeholder">📦</div>'
              }
            </div>
            
            <div class="scanned-info">
              <p><strong>Barcode:</strong> ${component.barcode}</p>
              <p><strong>Projekt:</strong> ${component.project || '-'}</p>
              <p><strong>Verantwortlicher:</strong> ${component.responsible_engineer || '-'}</p>
              <p><strong>Aktueller Standort:</strong> ${component.schrank_name}</p>
            </div>
          </div>
          
          <div class="action-hint">
            <p><strong>💡 Zum Auslagern:</strong> Barcode nochmal scannen</p>
            <button class="btn secondary" onclick="forceRemoveComponent('${component.barcode}')">
              Jetzt auslagern
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  modal.classList.add('active', 'show');
  // Verwende setProperty mit !important um CSS zu überschreiben
  modal.style.setProperty('display', 'flex', 'important');
  modal.style.setProperty('opacity', '1', 'important');
  modal.style.setProperty('visibility', 'visible', 'important');
  
  // Modal automatisch nach 6 Sekunden schließen
  setTimeout(() => {
    if (modal.classList.contains('active')) {
      closeGlobalScanner();
    }
  }, 6000);
}

/**
 * LOGIK 1: Zeigt Schrank-Auswahl für nicht eingelagertes Bauteil (LAYOUT REPARIERT)
 */
async function showStorageModal(component) {
  console.log('📦 Zeige Schrank-Auswahl für nicht eingelagertes Bauteil');
  
  const modal = ensureScannerModalExists();
  if (!modal) {
    console.error('❌ Failed to create or find scanner modal in showStorageModal');
    return;
  }
  
  // Modal Inhalt für Schrank-Auswahl
  const modalContent = modal.querySelector('.modal-content');
  if (!modalContent) {
    console.error('❌ Modal content not found in showStorageModal');
    return;
  }
  modalContent.className = 'modal-content scanner-content storage-modal'; // NEUE KLASSE
  
  // Header
  const header = modal.querySelector('.scanner-header');
  if (!header) {
    console.error('❌ Scanner header not found in showStorageModal');
    return;
  }
  header.style.background = 'var(--primary-blue)';
  const headerTitle = header.querySelector('h2');
  if (headerTitle) {
    headerTitle.textContent = 'Schrank auswählen';
  }
  
  // Body mit Apple-Style Layout
  const body = modal.querySelector('.scanner-body');
  if (!body) {
    console.error('❌ Scanner body not found in showStorageModal');
    return;
  }
  
  try {
    const cabinets = await api.getCabinets();
    console.log('📋 Schränke geladen:', cabinets.length);
    
    body.innerHTML = `
      <div class="storage-modal-content">
        <div class="component-info-section">
          <div class="scanned-card enhanced">
            <div class="card-header">
              <h3>${component.name || 'Unbenannt'}</h3>
              <span class="status-badge unstored">Nicht eingelagert</span>
            </div>
            
            <div class="card-content">
              <div class="scanned-image">
                ${component.image_url ? 
                  `<img src="${component.image_url}" alt="${component.name}">` :
                  '<div class="placeholder">📦</div>'
                }
              </div>
              
              <div class="scanned-info">
                <p><strong>Barcode:</strong> ${component.barcode}</p>
                <p><strong>Projekt:</strong> ${component.project || '-'}</p>
                <p><strong>Verantwortlicher:</strong> ${component.responsible_engineer || '-'}</p>
              </div>
            </div>
          </div>
        </div>
        
        <div class="cabinet-selection-section">
          <h3>Schrank für Einlagerung wählen:</h3>
          <div class="cabinet-grid-optimized">
            ${cabinets.length === 0 ? 
              `<div class="no-cabinets-available">
                <p>Keine Schränke verfügbar</p>
                <button class="btn primary" onclick="window.location.href='/manage-cabinets.html'">
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V18M18 12L6 12"></path>
                  </svg>
                  Schrank erstellen
                </button>
              </div>` :
              cabinets.map(cabinet => `
                <button class="cabinet-card-optimized" onclick="storeComponentInCabinet('${component.barcode}', ${cabinet.id}, '${cabinet.name.replace(/'/g, "&apos;")}')">
                  <div class="cabinet-icon-container">
                    <svg class="cabinet-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                    </svg>
                  </div>
                  <div class="cabinet-info">
                    <span class="cabinet-name">${cabinet.name}</span>
                    <small class="cabinet-count">${cabinet.component_count || 0} Bauteile</small>
                  </div>
                </button>
              `).join('')
            }
          </div>
        </div>
      </div>
    `;
    
  } catch (error) {
    console.error('❌ Fehler beim Laden der Schränke:', error);
    body.innerHTML = `
      <div class="storage-modal-content">
        <div class="error-message">Fehler beim Laden der Schränke: ${error.message}</div>
      </div>
    `;
  }
  
  modal.classList.add('active', 'show');
  // Verwende setProperty mit !important um CSS zu überschreiben
  modal.style.setProperty('display', 'flex', 'important');
  modal.style.setProperty('opacity', '1', 'important');
  modal.style.setProperty('visibility', 'visible', 'important');
}

/**
 * LOGIK 4: Zeigt Modal für unbekannten Barcode (UNVERÄNDERT)
 */
function showUnknownBarcodeModal(barcode) {
  console.log('❓ Zeige Modal für unbekannten Barcode');
  
  const modal = ensureScannerModalExists();
  if (!modal) {
    console.error('❌ Failed to create or find scanner modal in showUnknownBarcodeModal');
    return;
  }
  
  const modalContent = modal.querySelector('.modal-content');
  if (!modalContent) {
    console.error('❌ Modal content not found in showUnknownBarcodeModal');
    return;
  }
  modalContent.className = 'modal-content scanner-content wide-modal';
  
  const header = modal.querySelector('.scanner-header');
  if (!header) {
    console.error('❌ Scanner header not found in showUnknownBarcodeModal');
    return;
  }
  header.style.background = '#ff9500';
  const headerTitle = header.querySelector('h2');
  if (headerTitle) {
    headerTitle.textContent = 'Unbekanntes Bauteil';
  }
  
  const body = modal.querySelector('.scanner-body');
  if (!body) {
    console.error('❌ Scanner body not found in showUnknownBarcodeModal');
    return;
  }
  body.innerHTML = `
    <div class="scanner-unknown-display">
      <div class="unknown-card">
        <div class="unknown-icon">
          <svg width="60" height="60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>
        
        <div class="unknown-info">
          <h3>Bauteil nicht gefunden</h3>
          <p><strong>Barcode:</strong> ${barcode}</p>
          <p>Dieses Bauteil ist noch nicht im System registriert.</p>
        </div>
        
        <div class="unknown-actions">
          <button class="btn primary" onclick="window.location.href='/add-component.html?barcode=${encodeURIComponent(barcode)}'">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V18M18 12L6 12"></path>
            </svg>
            Jetzt registrieren
          </button>
          <button class="btn secondary" onclick="closeGlobalScanner()">
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  `;
  
  modal.classList.add('active', 'show');
  // Verwende setProperty mit !important um CSS zu überschreiben
  modal.style.setProperty('display', 'flex', 'important');
  modal.style.setProperty('opacity', '1', 'important');
  modal.style.setProperty('visibility', 'visible', 'important');
}

/**
 * LOGIK 3: Zeigt rotes Erfolgs-Modal nach Auslagern (ZEIT VERLÄNGERT)
 */
function showRemovalSuccessModal(component) {
  console.log('✅ Zeige Auslagern-Erfolg Modal');
  
  const modal = ensureScannerModalExists();
  if (!modal) {
    console.error('❌ Failed to create or find scanner modal in showRemovalSuccessModal');
    return;
  }
  
  // Modal in Removal-State setzen
  const modalContent = modal.querySelector('.modal-content');
  if (!modalContent) {
    console.error('❌ Modal content not found in showRemovalSuccessModal');
    return;
  }
  modalContent.className = 'modal-content scanner-content wide-modal removal-state';
  
  // Header - rot
  const header = modal.querySelector('.scanner-header');
  if (!header) {
    console.error('❌ Scanner header not found in showRemovalSuccessModal');
    return;
  }
  header.style.background = 'var(--accent-red)';
  const headerTitle = header.querySelector('h2');
  if (headerTitle) {
    headerTitle.textContent = 'Bauteil ausgelagert';
  }
  
  // Body mit roter Erfolgs-Nachricht
  const body = modal.querySelector('.scanner-body');
  if (!body) {
    console.error('❌ Scanner body not found in showRemovalSuccessModal');
    return;
  }
  body.innerHTML = `
    <div class="removal-confirmation">
      <div class="removal-icon">
        <svg width="60" height="60" fill="white" viewBox="0 0 24 24">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>
      </div>
      <h2>Erfolgreich ausgelagert!</h2>
      <p><strong>${component.name || 'Unbenannt'}</strong></p>
      <p>Barcode: ${component.barcode}</p>
      <p>wurde aus ${component.schrank_name || 'dem Schrank'} entfernt.</p>
    </div>
  `;
  
  modal.classList.add('active', 'show');
  // Verwende setProperty mit !important um CSS zu überschreiben
  modal.style.setProperty('display', 'flex', 'important');
  modal.style.setProperty('opacity', '1', 'important');
  modal.style.setProperty('visibility', 'visible', 'important');
  
  // Modal automatisch nach 2 Sekunden schließen (VERLÄNGERT)
  setTimeout(() => {
    closeGlobalScanner();
  }, 2000);
}

/**
 * Lagert Bauteil in gewählten Schrank ein (REPARIERT V2)
 */
window.storeComponentInCabinet = async function(barcode, cabinetId, cabinetName) {
  console.log(`📥 Lagere Bauteil ${barcode} in Schrank ${cabinetName} (ID: ${cabinetId}) ein`);
  
  try {
    await api.storeComponent(barcode, cabinetId);
    console.log('✅ Einlagern API-Call erfolgreich');
    
    // Grünes Erfolgs-Modal anzeigen
    showStorageSuccessModal(currentScannedComponent, cabinetName);
    
    // Double-Scan-State zurücksetzen
    lastScannedBarcode = null;
    if (doubleScanTimeout) {
      clearTimeout(doubleScanTimeout);
      doubleScanTimeout = null;
    }
    
    // Lokale Updates NACH dem Modal
    setTimeout(() => {
      updateLocalData();
    }, 1000);
    
  } catch (error) {
    console.error('❌ Fehler beim Einlagern:', error);
    showMessage(`Fehler beim Einlagern: ${error.message}`, 'error');
  }
}

/**
 * Zeigt grünes Erfolgs-Modal nach Einlagern (ZEIT VERLÄNGERT)
 */
function showStorageSuccessModal(component, cabinetName) {
  console.log('✅ Zeige Einlagern-Erfolg Modal');
  
  const modal = document.getElementById('scanner-modal');
  if (!modal) {
    console.error('❌ Scanner modal not found in showStorageSuccessModal');
    return;
  }
  
  // Modal-Content-Klasse zurücksetzen
  const modalContent = modal.querySelector('.modal-content');
  if (!modalContent) {
    console.error('❌ Modal content not found in showStorageSuccessModal');
    return;
  }
  modalContent.className = 'modal-content scanner-content wide-modal storage-state';
  
  // Header - grün
  const header = modal.querySelector('.scanner-header');
  if (!header) {
    console.error('❌ Scanner header not found in showStorageSuccessModal');
    return;
  }
  header.style.background = 'var(--primary-green)';
  const headerTitle = header.querySelector('h2');
  if (headerTitle) {
    headerTitle.textContent = 'Bauteil eingelagert';
  }
  
  // Body mit grüner Erfolgs-Nachricht
  const body = modal.querySelector('.scanner-body');
  if (!body) {
    console.error('❌ Scanner body not found in showStorageSuccessModal');
    return;
  }
  body.innerHTML = `
    <div class="storage-confirmation">
      <div class="storage-icon">
        <svg width="60" height="60" fill="white" viewBox="0 0 24 24">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>
      </div>
      <h2>Erfolgreich eingelagert!</h2>
      <p><strong>${component.name || 'Unbenannt'}</strong></p>
      <p>Barcode: ${component.barcode}</p>
      <p>wurde in <strong>${cabinetName}</strong> eingelagert.</p>
    </div>
  `;
  
  // Modal automatisch nach 2 Sekunden schließen (VERLÄNGERT)
  setTimeout(() => {
    closeGlobalScanner();
  }, 2000);
}

/**
 * Erzwinge Auslagern-Funktion für Button-Klick (REPARIERT V2)
 */
window.forceRemoveComponent = async function(barcode) {
  console.log('🔄 Erzwinge Auslagern für:', barcode);
  
  try {
    // Bauteil NEU laden für aktuellen Status
    const component = await api.getComponent(barcode);
    
    if (component.schrank_id) {
      await api.removeComponent(barcode);
      console.log('✅ Erzwungenes Auslagern erfolgreich');
      
      showRemovalSuccessModal(component);
      
      // Double-Scan-State zurücksetzen
      lastScannedBarcode = null;
      if (doubleScanTimeout) {
        clearTimeout(doubleScanTimeout);
        doubleScanTimeout = null;
      }
      
      // Lokale Updates NACH dem Modal
      setTimeout(() => {
        updateLocalData();
      }, 1000);
      
    } else {
      showMessage('Bauteil ist bereits ausgelagert', 'info');
    }
    
  } catch (error) {
    console.error('❌ Fehler beim erzwungenen Auslagern:', error);
    showMessage(`Fehler beim Auslagern: ${error.message}`, 'error');
  }
}

/**
 * Aktualisiert lokale Daten nach Änderungen (UNVERÄNDERT)
 */
function updateLocalData() {
  console.log('🔄 Aktualisiere lokale Daten...');
  
  // Funktionen aufrufen falls verfügbar
  if (typeof loadCabinets === 'function') {
    loadCabinets();
  }
  if (typeof loadComponents === 'function') {
    loadComponents();
  }
  if (typeof updateStats === 'function') {
    updateStats();
  }
}

/**
 * Stellt sicher, dass das Scanner-Modal existiert (VERBESSERT)
 */
function ensureScannerModalExists() {
  let modal = document.getElementById('scanner-modal');
  
  if (modal) {
    // Modal existiert bereits - stelle sicher dass es die richtigen Klassen hat
    let modalContent = modal.querySelector('.modal-content, .modern-modal-content');
    if (modalContent) {
      // Füge beide Klassen hinzu für Kompatibilität
      if (!modalContent.classList.contains('modal-content')) {
        modalContent.classList.add('modal-content');
      }
      if (!modalContent.classList.contains('scanner-content')) {
        modalContent.classList.add('scanner-content');
      }
      
      // Stelle sicher dass Header und Body existieren
      let header = modalContent.querySelector('.scanner-header, .modern-modal-header');
      if (header && !header.classList.contains('scanner-header')) {
        header.classList.add('scanner-header');
      }
      
      let body = modalContent.querySelector('.scanner-body, .modern-modal-body');
      if (body && !body.classList.contains('scanner-body')) {
        body.classList.add('scanner-body');
      }
    }
  } else {
    // Modal existiert nicht - erstelle es neu
    const modalHTML = `
      <div id="scanner-modal" class="modal">
        <div class="modal-content scanner-content wide-modal">
          <div class="scanner-header">
            <h2>Bauteil scannen</h2>
            <button class="close-modal" id="close-scanner">&times;</button>
          </div>
          <div class="scanner-body">
            <!-- Inhalt wird dynamisch gefüllt -->
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    modal = document.getElementById('scanner-modal');
    
    // Verify modal was created successfully
    if (!modal) {
      console.error('❌ Failed to create scanner modal');
      return null;
    }
    
    // Event Listeners hinzufügen
    const closeButton = modal.querySelector('#close-scanner');
    if (closeButton && !closeButton.hasAttribute('data-listener-added')) {
      closeButton.addEventListener('click', closeGlobalScanner);
      closeButton.setAttribute('data-listener-added', 'true');
    }
    
    // Escape-Taste (nur einmal hinzufügen)
    if (!modal.hasAttribute('data-escape-listener')) {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
          closeGlobalScanner();
        }
      });
      modal.setAttribute('data-escape-listener', 'true');
    }
  }
  
  return modal;
}

/**
 * Schließt den globalen Scanner (VERBESSERT FÜR BEIDE MODAL-TYPEN)
 */
function closeGlobalScanner() {
  console.log('❌ Schließe globalen Scanner');
  
  const modal = document.getElementById('scanner-modal');
  if (modal) {
    // Entferne beide mögliche Aktivierungsklassen
    modal.classList.remove('active', 'show');
    // Reset inline styles mit !important
    modal.style.setProperty('display', '', 'important');
    modal.style.setProperty('opacity', '', 'important');
    modal.style.setProperty('visibility', '', 'important');
    
    // Finde Modal-Content mit beiden möglichen Selektoren
    const modalContent = modal.querySelector('.modal-content, .modern-modal-content');
    if (modalContent) {
      modalContent.classList.remove('removal-state', 'storage-state');
    }
  }
  
  resetScanner();
  currentScannedComponent = null;
  
  // Double-Scan-State KOMPLETT zurücksetzen
  console.log('🔄 Setze Double-Scan-State zurück');
  lastScannedBarcode = null;
  if (doubleScanTimeout) {
    clearTimeout(doubleScanTimeout);
    doubleScanTimeout = null;
  }
}

/**
 * Öffnet Scanner-Modal mit optionalem Barcode (FIX: Kein automatisches Öffnen)
 */
function openGlobalScannerModal(barcode = '') {
  if (barcode) {
    // Nur wenn explizit ein Barcode übergeben wird
    scannerBuffer = barcode;
    processScannerInput();
  } else {
    // Modal wird nur noch manuell geöffnet, nicht automatisch
    console.log('🔍 Scanner-Modal-Öffnung angefordert, aber automatisches Öffnen ist deaktiviert');
    const modal = ensureScannerModalExists();
    // modal.classList.add('active'); // DEAKTIVIERT - Kein automatisches Öffnen
  }
}

/**
 * Hilfsfunktionen (UNVERÄNDERT)
 */
function isInputFocused() {
  const activeElement = document.activeElement;
  return activeElement && (
    activeElement.tagName === 'INPUT' ||
    activeElement.tagName === 'TEXTAREA' ||
    activeElement.isContentEditable
  );
}

function isModalOpen() {
  return document.querySelector('.modal.active') !== null;
}

function isValidBarcodeFormat(barcode) {
  if (!barcode || typeof barcode !== 'string') return false;
  const barcodeRegex = /^[A-Za-z0-9\-_]{6,50}$/;
  return barcodeRegex.test(barcode);
}

function resetScanner() {
  scannerBuffer = '';
  isScanning = false;
  lastInputTime = 0;
  clearTimeout(scannerTimeout);
}

// URL-Parameter verarbeiten für direkten Scan (FIX: Nur bei gültigem Barcode)
document.addEventListener('DOMContentLoaded', function() {
  const urlParams = new URLSearchParams(window.location.search);
  const scanBarcode = urlParams.get('scan');
  
  if (scanBarcode && isValidBarcodeFormat(scanBarcode)) {
    console.log('🔍 URL-Parameter-Scan erkannt:', scanBarcode);
    setTimeout(() => {
      openGlobalScannerModal(scanBarcode);
    }, 1000);
  }
});

// Export für andere Module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initializeGlobalScanner,
    openGlobalScannerModal,
    resetScanner
  };
}
