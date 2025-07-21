// WeaselParts JavaScript Fixes und Ergänzungen - Enhanced Version

// Fix für fehlende generateBarcode Funktion
function generateBarcode() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  const barcode = `WP${timestamp.toString().slice(-8)}${random}`;
  
  const barcodeInput = document.getElementById('barcode');
  if (barcodeInput) {
    barcodeInput.value = barcode;
  }
  
  return barcode;
}

// Fix für fehlende viewCabinetDetails Funktion
async function viewCabinetDetails(cabinetId) {
  try {
    const cabinets = await api.getCabinets();
    const selectedCabinet = cabinets.find(c => c.id === cabinetId);
    
    if (!selectedCabinet) {
      showMessage('Schrank nicht gefunden', 'error');
      return;
    }
    
    // Modal-Titel setzen
    const modalTitle = document.getElementById('cabinet-modal-title');
    if (modalTitle) {
      modalTitle.textContent = `Schrank: ${selectedCabinet.name}`;
    }
    
    // Schrank-Inhalt laden
    const contents = await api.getCabinetContents(cabinetId);
    
    // Anzahl aktualisieren
    const countElement = document.getElementById('contents-count');
    if (countElement) {
      countElement.textContent = contents.length;
    }
    
    // Tabelle füllen
    const tbody = document.getElementById('contents-tbody');
    const emptyState = document.getElementById('empty-cabinet');
    const tableContainer = document.querySelector('.contents-table-container');
    
    if (tbody) {
      tbody.innerHTML = '';
      
      if (contents.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        if (tableContainer) tableContainer.classList.add('hidden');
      } else {
        if (emptyState) emptyState.classList.add('hidden');
        if (tableContainer) tableContainer.classList.remove('hidden');
        
        contents.forEach(component => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td class="image-cell">
              ${component.image_url ? 
                `<img src="${component.image_url}" alt="${component.name}" class="thumbnail">` :
                '<div class="no-image">📦</div>'
              }
            </td>
            <td>${component.barcode}</td>
            <td>${component.name || 'Unbenannt'}</td>
            <td>${component.project || '-'}</td>
            <td>
              <button class="btn small" onclick="window.open('/edit-component.html?barcode=${encodeURIComponent(component.barcode)}', '_blank')">
                Bearbeiten
              </button>
              <button class="btn small warning" onclick="removeComponentFromCabinet('${component.barcode}', ${cabinetId})">
                Auslagern
              </button>
            </td>
          `;
          tbody.appendChild(row);
        });
      }
    }
    
    // Modal anzeigen
    const modal = document.getElementById('cabinet-details-modal');
    if (modal) {
      modal.classList.add('active');
    }
    
  } catch (error) {
    showMessage(`Fehler beim Laden der Schrank-Details: ${error.message}`, 'error');
  }
}

// Fix für fehlende updateStats Funktion
async function updateStats() {
  try {
    const cabinets = await api.getCabinets();
    const components = await api.getAllComponents();
    
    // Gesamtanzahl Schränke
    const totalCabinets = cabinets.length;
    const totalCabinetsElement = document.getElementById('total-cabinets');
    if (totalCabinetsElement) {
      totalCabinetsElement.textContent = totalCabinets;
    }
    
    // Gesamtanzahl Bauteile
    const totalComponents = components.length;
    const totalComponentsElement = document.getElementById('total-components');
    if (totalComponentsElement) {
      totalComponentsElement.textContent = totalComponents;
    }
    
    // Eingelagerte Bauteile
    const storedComponents = components.filter(c => c.schrank_id).length;
    const storedComponentsElement = document.getElementById('stored-components');
    if (storedComponentsElement) {
      storedComponentsElement.textContent = storedComponents;
    }
    
    // Nicht eingelagerte Bauteile
    const unstoredComponents = components.filter(c => !c.schrank_id).length;
    const unstoredComponentsElement = document.getElementById('unstored-components');
    if (unstoredComponentsElement) {
      unstoredComponentsElement.textContent = unstoredComponents;
    }
    
    // Leere Schränke
    let emptyCabinets = 0;
    for (const cabinet of cabinets) {
      const contents = await api.getCabinetContents(cabinet.id);
      if (contents.length === 0) {
        emptyCabinets++;
      }
    }
    const emptyCabinetsElement = document.getElementById('empty-cabinets');
    if (emptyCabinetsElement) {
      emptyCabinetsElement.textContent = emptyCabinets;
    }
    
    // Durchschnittliche Auslastung
    const avgUtilization = totalCabinets > 0 ? Math.round((storedComponents / (totalCabinets * 50)) * 100) : 0;
    const avgUtilizationElement = document.getElementById('avg-utilization');
    if (avgUtilizationElement) {
      avgUtilizationElement.textContent = `${avgUtilization}%`;
    }
    
  } catch (error) {
    console.error('Fehler beim Aktualisieren der Statistiken:', error);
  }
}

// Fix für closeCabinetDetails Funktion
function closeCabinetDetails() {
  const modal = document.getElementById('cabinet-details-modal');
  if (modal) {
    modal.classList.remove('active');
  }
}

// Fix für closeDeleteConfirmation Funktion
function closeDeleteConfirmation() {
  const modal = document.getElementById('delete-confirmation-modal');
  if (modal) {
    modal.classList.remove('active');
  }
  window.currentCabinetToDelete = null;
}

// Fix für Scanner-Eingabe auf der Hauptseite
document.addEventListener('DOMContentLoaded', function() {
  // URL-Parameter prüfen für Scan-Aktion
  const urlParams = new URLSearchParams(window.location.search);
  const scanBarcode = urlParams.get('scan');
  
  if (scanBarcode) {
    // Der globale Scanner aus common.js übernimmt das automatisch
    console.log('Scan-Parameter erkannt:', scanBarcode);
  }
  
  // Suche aus URL-Parametern
  const searchQuery = urlParams.get('search');
  if (searchQuery) {
    const globalSearch = document.getElementById('global-search');
    if (globalSearch) {
      globalSearch.value = searchQuery;
      if (typeof handleGlobalSearch === 'function') {
        handleGlobalSearch();
      }
    }
  }
  
  // Stats aktualisieren auf manage-cabinets Seite
  if (window.location.pathname.includes('manage-cabinets.html')) {
    setTimeout(updateStats, 1000); // Kurz warten bis API geladen ist
  }
  
  // Globaler Scanner Event Listener für bessere Erkennung
  setupEnhancedScanner();
});

// Enhanced Scanner Setup für bessere Barcode-Erkennung
function setupEnhancedScanner() {
  let lastScanTime = 0;
  let scanBuffer = '';
  
  document.addEventListener('keypress', function(e) {
    // Ignoriere Eingaben in Input-Feldern
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }
    
    const currentTime = Date.now();
    
    // Wenn mehr als 200ms zwischen Tasten, neuer Scan
    if (currentTime - lastScanTime > 200) {
      scanBuffer = '';
    }
    
    scanBuffer += e.key;
    lastScanTime = currentTime;
    
    // Wenn Enter gedrückt oder Barcode lang genug
    if (e.key === 'Enter' || scanBuffer.length > 10) {
      if (scanBuffer.length >= 8 && /^[A-Za-z0-9\-_]+$/.test(scanBuffer)) {
        // Verhindern dass normaler Text als Barcode erkannt wird
        const hasLetters = /[A-Za-z]/.test(scanBuffer);
        const hasNumbers = /[0-9]/.test(scanBuffer);
        
        if (hasLetters && hasNumbers) {
          // Wahrscheinlich ein Barcode
          if (typeof openGlobalScannerModal === 'function') {
            openGlobalScannerModal(scanBuffer);
          }
        }
      }
      scanBuffer = '';
    }
  });
}

// Fix für Export-Funktion
async function exportCabinetContents(cabinetId) {
  try {
    const contents = await api.getCabinetContents(cabinetId);
    
    if (contents.length === 0) {
      showMessage('Dieser Schrank ist leer - nichts zu exportieren.', 'warning');
      return;
    }
    
    // Schrank-Name für Dateinamen holen
    const cabinets = await api.getCabinets();
    const cabinet = cabinets.find(c => c.id === cabinetId);
    const cabinetName = cabinet ? cabinet.name : `Schrank_${cabinetId}`;
    
    const exportData = contents.map(component => ({
      'Barcode': component.barcode,
      'Name': component.name || 'Unbenannt',
      'Projekt': component.project || '-',
      'Verantwortlicher': component.responsible_engineer || '-',
      'Gerätebezeichnung': component.equipment_name || '-',
      'ID-Nummer': component.identification_number || '-'
    }));
    
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    
    if (typeof exportToCSV === 'function') {
      exportToCSV(exportData, `weaselparts_${cabinetName}_${timestamp}.csv`);
    } else {
      console.error('exportToCSV Funktion nicht gefunden');
      showMessage('Export-Funktion nicht verfügbar', 'error');
    }
    
  } catch (error) {
    showMessage(`Fehler beim Exportieren: ${error.message}`, 'error');
  }
}

// Fix für formatDate Funktion wenn nicht vorhanden
if (typeof formatDate === 'undefined') {
  window.formatDate = function(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }
}

// Fix für showCabinetDeleteConfirmation (wird aus onclick aufgerufen)
window.showCabinetDeleteConfirmation = function(cabinetId) {
  showDeleteConfirmation(cabinetId);
}

// Fix für showDeleteConfirmation Funktion
async function showDeleteConfirmation(cabinetId) {
  try {
    const cabinets = await api.getCabinets();
    const cabinet = cabinets.find(c => c.id === cabinetId);
    
    if (!cabinet) {
      showMessage('Schrank nicht gefunden', 'error');
      return;
    }
    
    window.currentCabinetToDelete = cabinet;
    
    // Anzahl der Bauteile im Schrank ermitteln
    const contents = await api.getCabinetContents(cabinet.id);
    const componentCount = contents.length;
    
    const message = componentCount > 0 ?
      `Möchtest du den Schrank "${cabinet.name}" wirklich löschen? Er enthält noch ${componentCount} Bauteile. Diese werden ausgelagert.` :
      `Möchtest du den leeren Schrank "${cabinet.name}" wirklich löschen?`;
    
    const confirmationMessage = document.getElementById('delete-confirmation-message');
    if (confirmationMessage) {
      confirmationMessage.textContent = message;
    }
    
    const modal = document.getElementById('delete-confirmation-modal');
    if (modal) {
      modal.classList.add('active');
    }
  } catch (error) {
    showMessage(`Fehler: ${error.message}`, 'error');
  }
}

// Fix für handleConfirmDelete
async function handleConfirmDelete() {
  if (!window.currentCabinetToDelete) return;
  
  try {
    await api.deleteCabinet(window.currentCabinetToDelete.id);
    
    showMessage(`Schrank "${window.currentCabinetToDelete.name}" wurde erfolgreich gelöscht.`, 'success');
    
    // Seite neu laden oder Schränke neu laden
    if (typeof loadCabinets === 'function') {
      await loadCabinets();
      updateStats();
    } else {
      window.location.reload();
    }
    
    closeDeleteConfirmation();
    
  } catch (error) {
    showMessage(`Fehler beim Löschen: ${error.message}`, 'error');
  }
}

// Global Variable für currentCabinetToDelete
window.currentCabinetToDelete = null;

// Fix für fehlende removeImage Funktion
window.removeImage = function() {
  const fileInput = document.getElementById('component-image');
  const preview = document.getElementById('image-preview');
  
  if (fileInput) fileInput.value = '';
  if (preview) preview.innerHTML = '';
}

// Fix für handleDragOver
window.handleDragOver = function(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}

// Fix für handleDrop
window.handleDrop = function(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  
  const files = e.dataTransfer.files;
  if (files.length > 0 && typeof handleFile === 'function') {
    handleFile(files[0]);
  }
}

// Fix für handleFileSelect
window.handleFileSelect = function(e) {
  if (e.target.files.length > 0 && typeof handleFile === 'function') {
    handleFile(e.target.files[0]);
  }
}

// Fix für handleFile
window.handleFile = function(file) {
  if (!file.type.startsWith('image/')) {
    showMessage('Bitte wähle eine Bilddatei aus.', 'warning');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (e) => {
    const preview = document.getElementById('image-preview');
    if (preview) {
      preview.innerHTML = `
        <div class="preview-container">
          <img src="${e.target.result}" alt="Vorschau">
          <button type="button" class="remove-image" onclick="removeImage()">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
          </button>
        </div>
      `;
    }
  };
  reader.readAsDataURL(file);
}

// Override für createCabinetCard Funktion
window.createCabinetCard = function(cabinet) {
  const card = document.createElement('div');
  card.className = 'cabinet-card enhanced';
  card.dataset.cabinetId = cabinet.id;
  
  const isEmpty = cabinet.componentCount === 0 || cabinet.component_count === 0;
  const componentCount = cabinet.componentCount || cabinet.component_count || 0;
  const statusClass = isEmpty ? 'empty' : 'filled';
  const fillPercentage = Math.min((componentCount / 50) * 100, 100);
  
  card.innerHTML = `
    <div class="cabinet-header">
      <div class="cabinet-icon-container">
        <svg class="cabinet-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
        </svg>
        <div class="component-count ${statusClass}">${componentCount}</div>
      </div>
      <div class="cabinet-actions">
        <button class="action-btn view-btn" onclick="viewCabinetDetails(${cabinet.id})" title="Details anzeigen">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
          </svg>
        </button>
        <button class="action-btn delete-btn" onclick="event.stopPropagation(); showDeleteConfirmation(${cabinet.id})" title="Löschen">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
          </svg>
        </button>
      </div>
    </div>
    
    <div class="cabinet-info">
      <h3 class="cabinet-name">${cabinet.name}</h3>
      <div class="cabinet-stats">
        <span class="stat">ID: ${cabinet.id}</span>
        <span class="stat ${statusClass}">
          ${componentCount} ${componentCount === 1 ? 'Bauteil' : 'Bauteile'}
        </span>
      </div>
    </div>
    
    <div class="cabinet-footer">
      <div class="fill-indicator">
        <div class="fill-bar">
          <div class="fill-progress" style="width: ${fillPercentage}%"></div>
        </div>
        <span class="fill-text">${componentCount}/50</span>
      </div>
      <div class="cabinet-footer-actions">
        <button class="btn small" onclick="exportCabinetContents(${cabinet.id})">
          📋 Export
        </button>
      </div>
    </div>
  `;
  
  return card;
}

// Fix für removeComponentFromCabinet (global verfügbar machen)
window.removeComponentFromCabinet = async function(barcode, cabinetId) {
  try {
    await api.removeComponent(barcode);
    showMessage('Bauteil erfolgreich ausgelagert!', 'success');
    
    // Schrank-Inhalt aktualisieren
    if (typeof loadCabinets === 'function') {
      await loadCabinets();
      updateStats();
      
      // Wenn Modal offen ist, Details neu laden
      const modal = document.getElementById('cabinet-details-modal');
      if (modal && modal.classList.contains('active')) {
        viewCabinetDetails(cabinetId);
      }
    }
    
  } catch (error) {
    showMessage(`Fehler beim Auslagern: ${error.message}`, 'error');
  }
}

// Fix für exportAllCabinets Funktion
window.exportAllCabinets = async function() {
  try {
    const cabinets = await api.getCabinets();
    const allData = [];
    
    for (const cabinet of cabinets) {
      const contents = await api.getCabinetContents(cabinet.id);
      for (const component of contents) {
        allData.push({
          'Schrank': cabinet.name,
          'Schrank-ID': cabinet.id,
          'Barcode': component.barcode,
          'Name': component.name || 'Unbenannt',
          'Projekt': component.project || '-',
          'Verantwortlicher': component.responsible_engineer || '-',
          'Gerätebezeichnung': component.equipment_name || '-',
          'ID-Nummer': component.identification_number || '-'
        });
      }
    }
    
    if (allData.length === 0) {
      showMessage('Keine Bauteile zum Exportieren vorhanden.', 'warning');
      return;
    }
    
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    
    if (typeof exportToCSV === 'function') {
      exportToCSV(allData, `weaselparts_alle_schraenke_${timestamp}.csv`);
    } else {
      console.error('❌ exportToCSV Funktion nicht verfügbar');
      showMessage('Export-Funktion nicht verfügbar', 'error');
    }
    
  } catch (error) {
    showMessage(`Fehler beim Exportieren: ${error.message}`, 'error');
  }
}

// Enhanced Error Handling für API-Calls
window.addEventListener('unhandledrejection', function(event) {
  console.error('Unbehandelter Promise-Fehler:', event.reason);
  if (event.reason && event.reason.message) {
    showMessage(`Unerwarteter Fehler: ${event.reason.message}`, 'error');
  }
});

// Enhanced Console Logging für Development
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  console.log('🔧 WeaselParts Development Mode aktiviert');
  
  // Debug-Funktionen verfügbar machen
  window.debugWeaselParts = {
    scannerBuffer: () => scannerBuffer,
    currentComponent: () => currentScannedComponent,
    testScanner: (barcode) => openGlobalScannerModal(barcode),
    clearStorage: () => localStorage.clear(),
    apiTest: () => api.testConnection()
  };
}

// Performance-Optimierungen
document.addEventListener('DOMContentLoaded', function() {
  // Lazy Loading für Bilder
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.classList.remove('lazy');
          observer.unobserve(img);
        }
      });
    });
    
    document.querySelectorAll('img[data-src]').forEach(img => {
      imageObserver.observe(img);
    });
  }
  
  // Service Worker Registration (falls verfügbar)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.log('Service Worker registrierung fehlgeschlagen:', err);
    });
  }
});

console.log('✅ WeaselParts Enhanced Fixes geladen');
