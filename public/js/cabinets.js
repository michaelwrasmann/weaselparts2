/**
 * WeaselParts - Schrank-spezifische Funktionen
 */

/**
 * Lädt alle Schränke und zeigt sie an
 * @param {string} containerId - ID des Container-Elements (optional)
 * @param {boolean} selectable - Ob die Schränke auswählbar sein sollen
 * @param {Function} onSelect - Callback-Funktion für die Auswahl
 */
async function loadCabinets(containerId = 'cabinets-grid', selectable = false, onSelect = null) {
  try {
    const cabinets = await api.getCabinets();
    
    // Für jeden Schrank die Anzahl der Bauteile laden
    for (let cabinet of cabinets) {
      try {
        const contents = await api.getCabinetContents(cabinet.id);
        cabinet.componentCount = contents.length;
        cabinet.components = contents;
      } catch (error) {
        console.warn(`Fehler beim Laden des Inhalts für Schrank ${cabinet.id}:`, error);
        cabinet.componentCount = 0;
        cabinet.components = [];
      }
    }
    
    if (window.location.pathname.includes('/manage-cabinets.html')) {
      // In der Verwaltungsansicht
      renderCabinetManagementGrid(cabinets, containerId);
    } else {
      // In der Einlagern-Ansicht
      renderCabinetSelectionGrid(cabinets, containerId, selectable, onSelect);
    }
    
    return cabinets;
  } catch (error) {
    showMessage(`Fehler beim Laden der Schränke: ${error.message}`, 'error');
    return [];
  }
}

/**
 * Rendert Schränke für die Verwaltungsansicht
 * @param {Array} cabinets - Die Schränke
 * @param {string} containerId - Container-ID
 */
function renderCabinetManagementGrid(cabinets, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.innerHTML = '';
  
  if (cabinets.length === 0) {
    const noCabinets = document.getElementById('no-cabinets');
    if (noCabinets) noCabinets.classList.remove('hidden');
    return;
  }
  
  const noCabinets = document.getElementById('no-cabinets');
  if (noCabinets) noCabinets.classList.add('hidden');
  
  cabinets.forEach(cabinet => {
    const cabinetCard = createManagementCabinetCard(cabinet);
    container.appendChild(cabinetCard);
  });
}

/**
 * Rendert Schränke für die Auswahl (Einlagern)
 * @param {Array} cabinets - Die Schränke
 * @param {string} containerId - Container-ID
 * @param {boolean} selectable - Ob auswählbar
 * @param {Function} onSelect - Callback für Auswahl
 */
function renderCabinetSelectionGrid(cabinets, containerId, selectable, onSelect) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.innerHTML = '';
  
  if (cabinets.length === 0) {
    container.innerHTML = '<p class="no-cabinets-message">Keine Schränke verfügbar. Bitte erstelle zuerst einen Schrank.</p>';
    return;
  }
  
  cabinets.forEach(cabinet => {
    const cabinetCard = createSelectionCabinetCard(cabinet, selectable, onSelect);
    container.appendChild(cabinetCard);
  });
}

/**
 * Erstellt eine Schrank-Karte für die Verwaltung
 * @param {Object} cabinet - Schrank-Daten
 * @returns {HTMLElement} Schrank-Karte
 */
function createManagementCabinetCard(cabinet) {
  const card = document.createElement('div');
  card.className = 'cabinet-card enhanced';
  card.dataset.cabinetId = cabinet.id;
  
  const isEmpty = cabinet.componentCount === 0;
  const statusClass = isEmpty ? 'empty' : 'filled';
  const fillPercentage = Math.min((cabinet.componentCount / 50) * 100, 100);
  
  card.innerHTML = `
    <div class="cabinet-header">
      <div class="cabinet-icon-container">
        <img src="/images/cabinet-so-svgrepo-com.svg" alt="Schrank" class="cabinet-icon">
        <div class="component-count ${statusClass}">${cabinet.componentCount}</div>
      </div>
      <div class="cabinet-actions">
        <button class="action-btn view-btn" onclick="viewCabinetDetails(${cabinet.id})" title="Details anzeigen">
          <img src="/images/eye-svgrepo-com.svg" alt="Anzeigen">
        </button>
        <button class="action-btn delete-btn" onclick="showCabinetDeleteConfirmation(${cabinet.id})" title="Löschen">
          <img src="/images/delete-recycle-bin-trash-can-svgrepo-com.svg" alt="Löschen">
        </button>
      </div>
    </div>
    
    <div class="cabinet-info">
      <h3 class="cabinet-name" title="${cabinet.name}">${cabinet.name}</h3>
      <div class="cabinet-stats">
        <span class="stat">ID: ${cabinet.id}</span>
        <span class="stat ${statusClass}">
          ${cabinet.componentCount} ${cabinet.componentCount === 1 ? 'Bauteil' : 'Bauteile'}
        </span>
        <span class="stat created">Erstellt: ${formatDate(cabinet.created_at)}</span>
      </div>
    </div>
    
    <div class="cabinet-footer">
      <div class="fill-indicator">
        <div class="fill-bar">
          <div class="fill-progress" style="width: ${fillPercentage}%"></div>
        </div>
        <span class="fill-text">${cabinet.componentCount}/50</span>
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

/**
 * Erstellt eine Schrank-Karte für die Auswahl
 * @param {Object} cabinet - Schrank-Daten
 * @param {boolean} selectable - Ob auswählbar
 * @param {Function} onSelect - Callback für Auswahl
 * @returns {HTMLElement} Schrank-Karte
 */
function createSelectionCabinetCard(cabinet, selectable, onSelect) {
  const card = document.createElement('div');
  card.className = 'cabinet-card selectable';
  card.dataset.cabinetId = cabinet.id;
  
  if (selectable && onSelect) {
    card.addEventListener('click', () => {
      // Aktive Klasse entfernen
      document.querySelectorAll('.cabinet-card').forEach(c => {
        c.classList.remove('active');
      });
      
      // Diese Karte aktivieren
      card.classList.add('active');
      
      // Callback aufrufen
      onSelect(cabinet);
    });
  }
  
  const isEmpty = cabinet.componentCount === 0;
  const statusClass = isEmpty ? 'empty' : 'filled';
  
  card.innerHTML = `
    <div class="cabinet-selection-content">
      <img src="/images/cabinet-so-svgrepo-com.svg" alt="Schrank" class="cabinet-icon">
      <div class="cabinet-info">
        <h4>${cabinet.name}</h4>
        <span class="component-count ${statusClass}">
          ${cabinet.componentCount} Bauteile
        </span>
      </div>
    </div>
  `;
  
  return card;
}

/**
 * Handler für das Erstellen eines neuen Schranks
 * @param {Event} e - Das Formular-Submit-Event
 */
async function createCabinet(e) {
  e.preventDefault();
  
  const form = e.target;
  const nameInput = form.querySelector('#cabinet-name');
  const name = nameInput.value.trim();
  
  if (!name) {
    showMessage('Bitte gib einen Namen für den Schrank ein.', 'warning');
    nameInput.focus();
    return;
  }
  
  if (name.length < 2) {
    showMessage('Der Schrankname muss mindestens 2 Zeichen lang sein.', 'warning');
    nameInput.focus();
    return;
  }
  
  try {
    // Loading-Indikator anzeigen
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="spinner"></span> Erstellt...';
    submitBtn.disabled = true;
    
    const newCabinet = await api.createCabinet({ name });
    
    showMessage(`Schrank "${name}" wurde erfolgreich erstellt.`, 'success');
    
    // Formular zurücksetzen
    nameInput.value = '';
    
    // Schrankliste aktualisieren
    await loadCabinets();
    
    // Statistiken aktualisieren (falls Funktion vorhanden)
    if (typeof updateStats === 'function') {
      updateStats();
    }
    
    // Submit-Button zurücksetzen
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
    
  } catch (error) {
    // Spezifische Fehlermeldung für bereits existierende Schränke
    if (error.message.includes('existiert bereits')) {
      showMessage(`Ein Schrank mit dem Namen "${name}" existiert bereits.`, 'warning');
    } else {
      showMessage(`Fehler beim Erstellen des Schranks: ${error.message}`, 'error');
    }
    
    // Submit-Button zurücksetzen
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
  }
}

/**
 * Handler für das Bestätigen des Löschens eines Schranks
 * @param {number} cabinetId - ID des zu löschenden Schranks
 */
async function confirmDeleteCabinet(cabinetId) {
  if (!cabinetId) {
    showMessage('Fehler: Keine Schrank-ID angegeben', 'error');
    return;
  }
  
  try {
    await api.deleteCabinet(cabinetId);
    showMessage('Schrank wurde erfolgreich gelöscht.', 'success');
    
    // Schrankliste aktualisieren
    await loadCabinets();
    
    // Statistiken aktualisieren (falls Funktion vorhanden)
    if (typeof updateStats === 'function') {
      updateStats();
    }
    
  } catch (error) {
    showMessage(`Fehler beim Löschen des Schranks: ${error.message}`, 'error');
  }
}

/**
 * Zeigt die Bestätigung für das Löschen eines Schranks
 * @param {number} cabinetId - ID des Schranks
 */
function showCabinetDeleteConfirmation(cabinetId) {
  // Schrank-Daten aus dem DOM holen
  const cabinetCard = document.querySelector(`[data-cabinet-id="${cabinetId}"]`);
  if (!cabinetCard) return;
  
  const cabinetName = cabinetCard.querySelector('.cabinet-name').textContent;
  const componentCount = parseInt(cabinetCard.querySelector('.component-count').textContent);
  
  let message;
  if (componentCount > 0) {
    message = `Möchtest du den Schrank "${cabinetName}" wirklich löschen?\n\nEr enthält noch ${componentCount} Bauteile. Diese werden automatisch ausgelagert.`;
  } else {
    message = `Möchtest du den leeren Schrank "${cabinetName}" wirklich löschen?`;
  }
  
  if (confirm(message + '\n\nDiese Aktion kann nicht rückgängig gemacht werden.')) {
    confirmDeleteCabinet(cabinetId);
  }
}

/**
 * Handler für die Auswahl eines Schranks in der Einlagern-Ansicht
 * @param {Object} cabinet - Das ausgewählte Schrank-Objekt
 */
async function selectCabinet(cabinet) {
  const infoElement = document.getElementById('selected-cabinet-info');
  if (infoElement) {
    infoElement.textContent = `Ausgewählter Schrank: ${cabinet.name}`;
  }
  
  // Barcode-Scan-Feld aktivieren
  const scanInput = document.getElementById('scan-barcode') || document.getElementById('barcode-input');
  if (scanInput) {
    scanInput.disabled = false;
    scanInput.focus();
    
    // Schrank-ID speichern (für spätere Verwendung)
    scanInput.dataset.cabinetId = cabinet.id;
  }
  
  // Buttons aktivieren
  ['check-btn', 'store-btn', 'remove-btn'].forEach(btnId => {
    const btn = document.getElementById(btnId);
    if (btn) btn.disabled = false;
  });
  
  // Schrank-Inhalt laden
  await loadCabinetContents(cabinet.id);
}

/**
 * Lädt den Inhalt eines Schranks
 * @param {number} cabinetId - ID des Schranks
 */
async function loadCabinetContents(cabinetId) {
  try {
    const components = await api.getCabinetContents(cabinetId);
    renderCabinetContents(components, cabinetId);
    return components;
  } catch (error) {
    showMessage(`Fehler beim Laden des Schrankinhalts: ${error.message}`, 'error');
    return [];
  }
}

/**
 * Zeigt den Inhalt eines Schranks an
 * @param {Array} components - Die Bauteile im Schrank
 * @param {number} cabinetId - ID des Schranks
 */
function renderCabinetContents(components, cabinetId) {
  const container = document.getElementById('cabinet-contents') || document.getElementById('contents-tbody');
  
  if (!container) {
    console.warn('Kein Container für Schrank-Inhalt gefunden');
    return;
  }
  
  container.innerHTML = '';
  
  if (!components || components.length === 0) {
    if (container.tagName === 'TBODY') {
      container.innerHTML = '<tr><td colspan="5" class="empty-cabinet">Der Schrank ist leer.</td></tr>';
    } else {
      container.innerHTML = '<p class="empty-cabinet">Der Schrank ist leer.</p>';
    }
    return;
  }
  
  if (container.tagName === 'TBODY') {
    // Tabellen-Darstellung
    components.forEach(component => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="image-cell">
          ${component.image_url ? 
            `<img src="${component.image_url}" alt="${component.name}" class="thumbnail" loading="lazy">` :
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
          <button class="btn small warning remove-btn" onclick="removeComponentFromCabinet('${component.barcode}', ${cabinetId})">
            Auslagern
          </button>
        </td>
      `;
      container.appendChild(tr);
    });
  } else {
    // Listen-Darstellung
    components.forEach(component => {
      const componentItem = document.createElement('div');
      componentItem.className = 'cabinet-content-item';
      componentItem.innerHTML = `
        <div class="item-image">
          ${component.image_url ? 
            `<img src="${component.image_url}" alt="${component.name}" loading="lazy">` :
            '<div class="placeholder">📦</div>'
          }
        </div>
        <div class="item-info">
          <h4>${component.name || 'Unbenannt'}</h4>
          <p><strong>Barcode:</strong> ${component.barcode}</p>
          <p><strong>Projekt:</strong> ${component.project || '-'}</p>
        </div>
        <div class="item-actions">
          <button class="btn small" onclick="window.open('/edit-component.html?barcode=${encodeURIComponent(component.barcode)}', '_blank')">
            Bearbeiten
          </button>
          <button class="btn small warning" onclick="removeComponentFromCabinet('${component.barcode}', ${cabinetId})">
            Auslagern
          </button>
        </div>
      `;
      container.appendChild(componentItem);
    });
  }
}

/**
 * Entfernt ein Bauteil aus einem Schrank
 * @param {string} barcode - Barcode des Bauteils
 * @param {number} cabinetId - ID des Schranks
 */
async function removeComponentFromCabinet(barcode, cabinetId) {
  try {
    await api.removeComponent(barcode);
    showMessage('Bauteil erfolgreich ausgelagert!', 'success');
    
    // Schrank-Inhalt aktualisieren
    await loadCabinetContents(cabinetId);
    
    // Bauteilzahlen aktualisieren
    await fetchCabinetCount(cabinetId);
    
    // Gesamtstatistiken aktualisieren (falls Funktion vorhanden)
    if (typeof updateStats === 'function') {
      updateStats();
    }
    
  } catch (error) {
    showMessage(`Fehler beim Auslagern: ${error.message}`, 'error');
  }
}

/**
 * Prüft ein gescanntes Bauteil und zeigt Informationen dazu an
 * @param {string} barcode - Der gescannte Barcode (optional)
 */
async function checkComponent(barcode) {
  // Barcode aus Input-Feld holen wenn nicht übergeben
  if (!barcode) {
    const barcodeInput = document.getElementById('scan-barcode') || document.getElementById('barcode-input');
    barcode = barcodeInput?.value.trim();
  }
  
  if (!barcode) {
    showMessage('Bitte gib einen Barcode ein oder scanne ein Bauteil.', 'warning');
    return;
  }
  
  try {
    // Versuchen, Bauteil zu laden
    const component = await api.getComponent(barcode);
    showComponentInfo(component);
    return component;
  } catch (error) {
    // Wenn Bauteil nicht gefunden wurde, Meldung anzeigen
    if (error.message.includes('nicht gefunden')) {
      showMessage('Bauteil nicht gefunden. Möchtest du es registrieren?', 'warning');
      
      // Link zum Registrieren anbieten
      const infoContainer = document.getElementById('component-info') || document.getElementById('scanned-component');
      if (infoContainer) {
        infoContainer.innerHTML = `
          <div class="info-box">
            <p>Bauteil mit Barcode "${barcode}" wurde nicht gefunden.</p>
            <button class="btn primary" onclick="window.location.href='/add-component.html?barcode=${encodeURIComponent(barcode)}'">
              Bauteil registrieren
            </button>
          </div>
        `;
        infoContainer.classList.remove('hidden');
      }
    } else {
      showMessage(`Fehler beim Prüfen des Bauteils: ${error.message}`, 'error');
    }
    return null;
  }
}

/**
 * Zeigt Informationen zu einem Bauteil an
 * @param {Object} component - Das Bauteil-Objekt
 */
function showComponentInfo(component) {
  const infoContainer = document.getElementById('component-info') || document.getElementById('scanned-component');
  
  if (!infoContainer) {
    console.warn('Kein Container für Bauteil-Info gefunden');
    return;
  }
  
  let cabinetInfo = 'Nicht eingelagert';
  let cabinetWarning = '';
  
  if (component.schrank_name) {
    cabinetInfo = `<strong>Aktueller Lagerort:</strong> ${component.schrank_name}`;
    
    // Prüfen ob Bauteil in anderem Schrank ist
    const selectedCabinetId = document.getElementById('scan-barcode')?.dataset.cabinetId;
    if (selectedCabinetId && component.schrank_id !== parseInt(selectedCabinetId)) {
      cabinetWarning = `
        <div class="warning-box">
          <p>⚠️ Dieses Bauteil befindet sich bereits in einem anderen Schrank!</p>
        </div>
      `;
    }
  }
  
  infoContainer.innerHTML = `
    <div class="component-card scanned">
      <div class="component-image">
        ${component.image_url ? 
          `<img src="${component.image_url}" alt="${component.name}" loading="lazy">` :
          '<div class="placeholder">📦</div>'
        }
      </div>
      
      <div class="component-details">
        <h3>${component.name || 'Unbenanntes Bauteil'}</h3>
        
        <div class="component-info-grid">
          <p><strong>Barcode:</strong> ${component.barcode}</p>
          <p><strong>Projekt:</strong> ${component.project || '-'}</p>
          <p><strong>Verantwortlicher:</strong> ${component.responsible_engineer || '-'}</p>
          <p><strong>Gerätebezeichnung:</strong> ${component.equipment_name || '-'}</p>
          <p><strong>ID-Nummer:</strong> ${component.identification_number || '-'}</p>
          <p>${cabinetInfo}</p>
        </div>
        
        ${cabinetWarning}
        
        <div class="component-actions">
          <button class="btn" onclick="window.open('/edit-component.html?barcode=${encodeURIComponent(component.barcode)}', '_blank')">
            Details bearbeiten
          </button>
          <button class="btn secondary" onclick="copyComponentData(${JSON.stringify(component).replace(/"/g, '&quot;')})">
            📋 Daten kopieren
          </button>
        </div>
      </div>
    </div>
  `;
  
  infoContainer.classList.remove('hidden');
}

/**
 * Lagert ein Bauteil in den ausgewählten Schrank ein
 * @param {string} barcode - Barcode des Bauteils (optional)
 */
async function storeComponent(barcode) {
  // Barcode und Schrank-ID aus Input-Feldern holen wenn nicht übergeben
  if (!barcode) {
    const barcodeInput = document.getElementById('scan-barcode') || document.getElementById('barcode-input');
    barcode = barcodeInput?.value.trim();
  }
  
  const cabinetId = document.getElementById('scan-barcode')?.dataset.cabinetId ||
                   document.getElementById('barcode-input')?.dataset.cabinetId;
  
  if (!barcode) {
    showMessage('Bitte gib einen Barcode ein oder scanne ein Bauteil.', 'warning');
    return;
  }
  
  if (!cabinetId) {
    showMessage('Bitte wähle zuerst einen Schrank aus.', 'warning');
    return;
  }
  
  try {
    const result = await api.storeComponent(barcode, cabinetId);
    
    if (result.previousSchrank) {
      showMessage('Bauteil wurde umgelagert.', 'success');
    } else {
      showMessage('Bauteil wurde erfolgreich eingelagert.', 'success');
    }
    
    // Barcode-Feld zurücksetzen
    const barcodeInput = document.getElementById('scan-barcode') || document.getElementById('barcode-input');
    if (barcodeInput) {
      barcodeInput.value = '';
      barcodeInput.focus();
    }
    
    // Schrank-Inhalt aktualisieren
    await loadCabinetContents(cabinetId);
    
    // Bauteilzahlen aktualisieren
    await fetchCabinetCount(cabinetId);
    
    // Komponenten-Info ausblenden
    const componentInfo = document.getElementById('component-info') || document.getElementById('scanned-component');
    if (componentInfo) {
      componentInfo.classList.add('hidden');
    }
    
  } catch (error) {
    // Wenn Bauteil nicht gefunden wurde, Meldung anzeigen
    if (error.message.includes('nicht gefunden')) {
      showMessage('Bauteil nicht gefunden. Möchtest du es registrieren?', 'warning');
      
      setTimeout(() => {
        if (confirm('Bauteil nicht gefunden. Jetzt registrieren?')) {
          window.location.href = `/add-component.html?barcode=${encodeURIComponent(barcode)}`;
        }
      }, 1000);
    } else {
      showMessage(`Fehler beim Einlagern: ${error.message}`, 'error');
    }
  }
}

/**
 * Lagert ein Bauteil aus dem ausgewählten Schrank aus
 * @param {string} barcode - Barcode des Bauteils (optional)
 */
async function removeComponent(barcode) {
  // Barcode und Schrank-ID aus Input-Feldern holen wenn nicht übergeben
  if (!barcode) {
    const barcodeInput = document.getElementById('scan-barcode') || document.getElementById('barcode-input');
    barcode = barcodeInput?.value.trim();
  }
  
  const cabinetId = document.getElementById('scan-barcode')?.dataset.cabinetId ||
                   document.getElementById('barcode-input')?.dataset.cabinetId;
  
  if (!barcode) {
    showMessage('Bitte gib einen Barcode ein oder scanne ein Bauteil.', 'warning');
    return;
  }
  
  try {
    await api.removeComponent(barcode);
    showMessage('Bauteil wurde erfolgreich ausgelagert.', 'success');
    
    // Barcode-Feld zurücksetzen
    const barcodeInput = document.getElementById('scan-barcode') || document.getElementById('barcode-input');
    if (barcodeInput) {
      barcodeInput.value = '';
      barcodeInput.focus();
    }
    
    // Schrank-Inhalt aktualisieren
    if (cabinetId) {
      await loadCabinetContents(cabinetId);
      await fetchCabinetCount(cabinetId);
    }
    
    // Komponenten-Info ausblenden
    const componentInfo = document.getElementById('component-info') || document.getElementById('scanned-component');
    if (componentInfo) {
      componentInfo.classList.add('hidden');
    }
    
  } catch (error) {
    showMessage(`Fehler beim Auslagern: ${error.message}`, 'error');
  }
}

/**
 * Lädt die Anzahl der Bauteile in einem Schrank
 * @param {number} cabinetId - ID des Schranks
 */
async function fetchCabinetCount(cabinetId) {
  try {
    const components = await api.getCabinetContents(cabinetId);
    
    // Update der Anzeige in der aktuellen Ansicht
    const cabinetCard = document.querySelector(`[data-cabinet-id="${cabinetId}"]`);
    if (cabinetCard) {
      const countElement = cabinetCard.querySelector('.component-count');
      if (countElement) {
        countElement.textContent = components.length;
        countElement.className = `component-count ${components.length === 0 ? 'empty' : 'filled'}`;
      }
      
      const statElement = cabinetCard.querySelector('.cabinet-stats .stat.filled, .cabinet-stats .stat.empty');
      if (statElement) {
        statElement.textContent = `${components.length} ${components.length === 1 ? 'Bauteil' : 'Bauteile'}`;
        statElement.className = `stat ${components.length === 0 ? 'empty' : 'filled'}`;
      }
      
      const fillProgress = cabinetCard.querySelector('.fill-progress');
      if (fillProgress) {
        const fillPercentage = Math.min((components.length / 50) * 100, 100);
        fillProgress.style.width = `${fillPercentage}%`;
      }
      
      const fillText = cabinetCard.querySelector('.fill-text');
      if (fillText) {
        fillText.textContent = `${components.length}/50`;
      }
    }
    
    return components.length;
  } catch (error) {
    console.error('Fehler beim Laden der Bauteilzahl:', error);
    return 0;
  }
}

/**
 * Exportiert den Inhalt eines Schranks als CSV
 * @param {number} cabinetId - ID des Schranks
 */
async function exportCabinetContents(cabinetId) {
  try {
    const components = await api.getCabinetContents(cabinetId);
    const cabinet = document.querySelector(`[data-cabinet-id="${cabinetId}"] .cabinet-name`)?.textContent || `Schrank_${cabinetId}`;
    
    if (components.length === 0) {
      showMessage('Dieser Schrank ist leer - nichts zu exportieren.', 'warning');
      return;
    }
    
    const exportData = components.map(component => ({
      'Barcode': component.barcode,
      'Name': component.name || 'Unbenannt',
      'Projekt': component.project || '-',
      'Verantwortlicher': component.responsible_engineer || '-',
      'Gerätebezeichnung': component.equipment_name || '-',
      'ID-Nummer': component.identification_number || '-',
      'Beschreibung': component.beschreibung || '-'
    }));
    
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    exportToCSV(exportData, `weaselparts_${cabinet}_${timestamp}.csv`);
    
  } catch (error) {
    showMessage(`Fehler beim Exportieren: ${error.message}`, 'error');
  }
}