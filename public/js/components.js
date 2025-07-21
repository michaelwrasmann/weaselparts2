/**
 * WeaselParts - Bauteil-spezifische Funktionen
 */

/**
 * Handler für das Erstellen eines neuen Bauteils
 * @param {Event} e - Das Formular-Submit-Event
 */
async function createComponent(e) {
  e.preventDefault();
  
  const form = e.target;
  const formData = new FormData(form);
  
  // Basis-Daten aus dem Formular
  const componentData = {
    barcode: formData.get('barcode'),
    name: formData.get('name') || formData.get('equipment_name'), // Fallback auf Equipment Name
    beschreibung: formData.get('beschreibung'),
    project: formData.get('project'),
    responsible_engineer: formData.get('responsible_engineer'),
    equipment_name: formData.get('equipment_name'),
    identification_number: formData.get('identification_number')
  };
  
  // Validierung
  if (!validateComponentData(componentData)) {
    return;
  }
  
  try {
    // Loading-Indikator anzeigen
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="spinner"></span> Speichert...';
    submitBtn.disabled = true;
    
    // Bauteil erstellen
    const result = await api.createComponent(componentData);
    
    // Wenn ein Bild ausgewählt wurde, dieses hochladen
    const imageFile = formData.get('image');
    if (imageFile && imageFile.size > 0) {
      try {
        await api.uploadComponentImage(componentData.barcode, imageFile);
      } catch (imageError) {
        console.warn('Bild-Upload fehlgeschlagen:', imageError);
        showMessage('Bauteil erstellt, aber Bild-Upload fehlgeschlagen.', 'warning');
      }
    }
    
    showMessage(`Bauteil "${componentData.name}" wurde erfolgreich gespeichert.`, 'success');
    
    // Formular zurücksetzen
    form.reset();
    clearImagePreview();
    
    // Neuen Barcode generieren für nächstes Bauteil
    if (typeof generateBarcode === 'function') {
      generateBarcode();
    }
    
    // Submit-Button zurücksetzen
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
    
  } catch (error) {
    showMessage(`Fehler beim Speichern des Bauteils: ${error.message}`, 'error');
    
    // Submit-Button zurücksetzen
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
  }
}

/**
 * Handler für das Aktualisieren eines Bauteils
 * @param {Event} e - Das Formular-Submit-Event
 */
async function updateComponent(e) {
  e.preventDefault();
  
  const form = e.target;
  const formData = new FormData(form);
  const originalBarcode = formData.get('original-barcode');
  
  // Basis-Daten aus dem Formular
  const componentData = {
    name: formData.get('name'),
    beschreibung: formData.get('beschreibung'),
    project: formData.get('project'),
    responsible_engineer: formData.get('responsible_engineer'),
    equipment_name: formData.get('equipment_name'),
    identification_number: formData.get('identification_number')
  };
  
  // Validierung
  if (!validateComponentUpdateData(componentData)) {
    return;
  }
  
  try {
    // Loading-Indikator anzeigen
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="spinner"></span> Speichert...';
    submitBtn.disabled = true;
    
    // Bauteil aktualisieren
    await api.updateComponent(originalBarcode, componentData);
    
    // Wenn ein Bild ausgewählt wurde, dieses hochladen
    const imageFile = formData.get('image');
    if (imageFile && imageFile.size > 0) {
      try {
        await api.uploadComponentImage(originalBarcode, imageFile);
      } catch (imageError) {
        console.warn('Bild-Update fehlgeschlagen:', imageError);
        showMessage('Bauteil aktualisiert, aber Bild-Update fehlgeschlagen.', 'warning');
      }
    }
    
    showMessage(`Bauteil "${componentData.name}" wurde erfolgreich aktualisiert.`, 'success');
    
    // Submit-Button zurücksetzen
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
    
    // Komponente neu laden, um aktualisierte Daten anzuzeigen
    setTimeout(() => {
      window.location.reload();
    }, 1500);
    
  } catch (error) {
    showMessage(`Fehler beim Aktualisieren des Bauteils: ${error.message}`, 'error');
    
    // Submit-Button zurücksetzen
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
  }
}

/**
 * Handler für das Löschen eines Bauteils
 * @param {string} barcode - Barcode des zu löschenden Bauteils
 * @param {string} name - Name des Bauteils (für Bestätigung)
 */
async function deleteComponent(barcode, name) {
  if (!barcode) {
    showMessage('Fehler: Kein Barcode angegeben', 'error');
    return;
  }
  
  // Bestätigung anfordern
  const confirmMessage = `Möchtest du das Bauteil "${name || barcode}" wirklich löschen?\n\nDiese Aktion kann nicht rückgängig gemacht werden.`;
  
  if (!confirm(confirmMessage)) {
    return;
  }
  
  try {
    await api.deleteComponent(barcode);
    showMessage('Bauteil wurde erfolgreich gelöscht.', 'success');
    
    // Zur Übersicht zurück oder Seite neu laden
    setTimeout(() => {
      if (window.location.pathname.includes('edit-component.html')) {
        window.location.href = '/';
      } else {
        window.location.reload();
      }
    }, 1500);
    
  } catch (error) {
    showMessage(`Fehler beim Löschen des Bauteils: ${error.message}`, 'error');
  }
}

/**
 * Handler für das Suchen von Bauteilen
 * @param {string} query - Suchbegriff (optional)
 */
async function searchComponents(query) {
  // Query aus Input-Feld holen wenn nicht übergeben
  if (!query) {
    const searchInput = document.getElementById('search-input') || document.getElementById('global-search');
    query = searchInput?.value.trim();
  }
  
  if (!query) {
    showMessage('Bitte gib einen Suchbegriff ein.', 'info');
    return;
  }
  
  if (query.length < 2) {
    showMessage('Suchbegriff muss mindestens 2 Zeichen lang sein.', 'warning');
    return;
  }
  
  try {
    const components = await api.searchComponents(query);
    
    if (typeof renderSearchResults === 'function') {
      renderSearchResults(components, query);
    } else {
      // Fallback: Zur Hauptseite mit Suchparameter
      const searchParams = new URLSearchParams();
      searchParams.set('search', query);
      window.location.href = `/?' + searchParams.toString();
    }
    
  } catch (error) {
    showMessage(`Fehler bei der Suche: ${error.message}`, 'error');
  }
}

/**
 * Zeigt die Suchergebnisse an
 * @param {Array} components - Die gefundenen Bauteile
 * @param {string} query - Der Suchbegriff
 */
function renderSearchResults(components, query) {
  const resultsContainer = document.getElementById('results-list') || document.getElementById('search-results');
  const resultsSection = document.getElementById('search-results');
  
  if (!resultsContainer) {
    console.warn('Keine Ergebnis-Container gefunden');
    return;
  }
  
  resultsContainer.innerHTML = '';
  
  if (components.length === 0) {
    resultsContainer.innerHTML = `
      <div class="no-results">
        <h3>Keine Bauteile gefunden</h3>
        <p>Für "${query}" wurden keine Bauteile gefunden.</p>
        <button class="btn primary" onclick="window.location.href='/add-component.html?name=${encodeURIComponent(query)}'">
          Neues Bauteil mit diesem Namen erstellen
        </button>
      </div>
    `;
    if (resultsSection) resultsSection.classList.remove('hidden');
    return;
  }
  
  // Suchergebnisse als Grid oder Tabelle anzeigen
  if (components.length <= 6) {
    renderSearchResultsAsGrid(components, query, resultsContainer);
  } else {
    renderSearchResultsAsTable(components, query, resultsContainer);
  }
  
  if (resultsSection) resultsSection.classList.remove('hidden');
}

/**
 * Rendert Suchergebnisse als Grid (für wenige Ergebnisse)
 */
function renderSearchResultsAsGrid(components, query, container) {
  const grid = document.createElement('div');
  grid.className = 'search-results-grid';
  
  components.forEach(component => {
    const card = document.createElement('div');
    card.className = 'search-result-card';
    
    const highlightedName = highlightSearchTerm(component.name || 'Unbenannt', query);
    const highlightedBarcode = highlightSearchTerm(component.barcode, query);
    
    card.innerHTML = `
      <div class="result-image">
        ${component.image_url ? 
          `<img src="${component.image_url}" alt="${component.name}" loading="lazy">` :
          '<div class="placeholder-image">📦</div>'
        }
      </div>
      <div class="result-info">
        <h4>${highlightedName}</h4>
        <p class="result-barcode">${highlightedBarcode}</p>
        <p class="result-project">${component.project || '-'}</p>
        <p class="result-location">${component.schrank_name || 'Nicht eingelagert'}</p>
      </div>
      <div class="result-actions">
        <button class="btn small" onclick="window.open('/edit-component.html?barcode=${encodeURIComponent(component.barcode)}', '_blank')">
          Bearbeiten
        </button>
      </div>
    `;
    
    grid.appendChild(card);
  });
  
  container.appendChild(grid);
}

/**
 * Rendert Suchergebnisse als Tabelle (für viele Ergebnisse)
 */
function renderSearchResultsAsTable(components, query, container) {
  const table = document.createElement('table');
  table.className = 'data-table search-results-table';
  
  // Tabellenkopf
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th>Bild</th>
      <th>Barcode</th>
      <th>Name</th>
      <th>Projekt</th>
      <th>Verantwortlicher</th>
      <th>Schrank</th>
      <th>Aktionen</th>
    </tr>
  `;
  table.appendChild(thead);
  
  // Tabelleninhalt
  const tbody = document.createElement('tbody');
  components.forEach(component => {
    const row = document.createElement('tr');
    
    const highlightedName = highlightSearchTerm(component.name || 'Unbenannt', query);
    const highlightedBarcode = highlightSearchTerm(component.barcode, query);
    const highlightedProject = highlightSearchTerm(component.project || '-', query);
    
    row.innerHTML = `
      <td class="image-cell">
        ${component.image_url ? 
          `<img src="${component.image_url}" alt="${component.name}" class="thumbnail" loading="lazy">` :
          '<div class="no-image">📦</div>'
        }
      </td>
      <td>${highlightedBarcode}</td>
      <td>${highlightedName}</td>
      <td>${highlightedProject}</td>
      <td>${component.responsible_engineer || '-'}</td>
      <td>${component.schrank_name || 'Nicht eingelagert'}</td>
      <td>
        <button class="btn small" onclick="window.open('/edit-component.html?barcode=${encodeURIComponent(component.barcode)}', '_blank')">
          Bearbeiten
        </button>
      </td>
    `;
    
    tbody.appendChild(row);
  });
  
  table.appendChild(tbody);
  container.appendChild(table);
}

/**
 * Hebt Suchbegriffe im Text hervor
 * @param {string} text - Der zu durchsuchende Text
 * @param {string} query - Der Suchbegriff
 * @returns {string} Text mit hervorgehobenen Begriffen
 */
function highlightSearchTerm(text, query) {
  if (!text || !query) return text;
  
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\    // Neuen Barcode generieren für nächstes Bauteil
    if (typeof generateBarcode === ')})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

/**
 * Handler für die Anzeige der Bildvorschau
 * @param {Event} e - Das Change-Event des File-Inputs
 */
function handleImagePreview(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  handleImageFile(file);
}

/**
 * Behandelt das Hochladen einer Bilddatei
 * @param {File} file - Die Bilddatei
 */
async function handleImageFile(file) {
  if (!file.type.startsWith('image/')) {
    showMessage('Bitte wähle eine Bilddatei aus.', 'warning');
    return;
  }
  
  // Dateigröße prüfen (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    showMessage('Bilddatei ist zu groß. Maximum: 5MB', 'warning');
    return;
  }
  
  try {
    // Bild komprimieren wenn zu groß
    let processedFile = file;
    if (file.size > 1024 * 1024) { // Größer als 1MB
      processedFile = await compressImage(file, 800, 600, 0.8);
    }
    
    const dataURL = await loadImageAsDataURL(processedFile);
    displayImagePreview(dataURL, file.name);
    
  } catch (error) {
    console.error('Fehler beim Verarbeiten des Bildes:', error);
    showMessage('Fehler beim Verarbeiten des Bildes.', 'error');
  }
}

/**
 * Zeigt die Bildvorschau an
 * @param {string} dataURL - Data-URL des Bildes
 * @param {string} fileName - Name der Datei
 */
function displayImagePreview(dataURL, fileName) {
  const preview = document.getElementById('image-preview');
  if (!preview) return;
  
  preview.innerHTML = `
    <div class="preview-container">
      <img src="${dataURL}" alt="Vorschau" class="preview-image">
      <div class="preview-info">
        <span class="file-name">${fileName}</span>
        <button type="button" class="remove-image" onclick="removeImagePreview()">
          <img src="/images/delete-recycle-bin-trash-can-svgrepo-com.svg" alt="Entfernen">
        </button>
      </div>
    </div>
  `;
}

/**
 * Entfernt die Bildvorschau
 */
function removeImagePreview() {
  const fileInput = document.getElementById('component-image');
  const preview = document.getElementById('image-preview');
  
  if (fileInput) fileInput.value = '';
  if (preview) preview.innerHTML = '';
}

/**
 * Löscht die Bildvorschau komplett
 */
function clearImagePreview() {
  removeImagePreview();
}

/**
 * Handler für das Auslagern eines Bauteils aus der Bearbeitungsansicht
 * @param {string} barcode - Barcode des Bauteils
 */
async function removeFromCabinet(barcode) {
  if (!barcode) {
    showMessage('Fehler: Kein Barcode angegeben', 'error');
    return;
  }
  
  try {
    await api.removeComponent(barcode);
    showMessage('Bauteil wurde erfolgreich aus dem Schrank entfernt.', 'success');
    
    // Seite neu laden um aktualisierte Daten zu zeigen
    setTimeout(() => {
      window.location.reload();
    }, 1500);
    
  } catch (error) {
    showMessage(`Fehler beim Entfernen aus dem Schrank: ${error.message}`, 'error');
  }
}

/**
 * Exportiert Bauteildaten als CSV
 * @param {Array} components - Die zu exportierenden Bauteile (optional)
 */
function exportComponentsAsCSV(components) {
  let dataToExport = components;
  
  // Wenn keine Komponenten übergeben, versuche sie von der aktuellen Seite zu holen
  if (!dataToExport) {
    const table = document.getElementById('components-table') || document.querySelector('.data-table');
    if (!table) {
      showMessage('Keine Daten zum Exportieren gefunden.', 'warning');
      return;
    }
    
    const rows = Array.from(table.querySelectorAll('tbody tr'))
      .filter(row => row.style.display !== 'none');
    
    if (rows.length === 0) {
      showMessage('Keine Bauteile zum Exportieren vorhanden.', 'warning');
      return;
    }
    
    // Daten aus Tabelle extrahieren
    dataToExport = rows.map(row => {
      const cells = row.querySelectorAll('td');
      return {
        'Barcode': cells[1]?.textContent.trim() || '',
        'Name': cells[2]?.textContent.trim() || '',
        'Projekt': cells[3]?.textContent.trim() || '',
        'Verantwortlicher': cells[4]?.textContent.trim() || '',
        'Gerätebezeichnung': cells[5]?.textContent.trim() || '',
        'ID-Nummer': cells[6]?.textContent.trim() || '',
        'Schrank': cells[7]?.textContent.trim() || ''
      };
    });
  }
  
  // CSV exportieren
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  exportToCSV(dataToExport, `weaselparts_bauteile_${timestamp}.csv`);
}

/**
 * Druckt die Bauteilliste
 */
function printComponentsList() {
  const printStyles = `
    <style>
      @media print {
        * { font-size: 12pt !important; }
        .no-print, .component-actions, .pagination, header, .fab-container { display: none !important; }
        .component-card { break-inside: avoid; page-break-inside: avoid; }
        .data-table { font-size: 10pt; }
        .data-table th, .data-table td { padding: 4px !important; }
        body { background: white !important; }
      }
    </style>
  `;
  
  // Temporär Druckstile hinzufügen
  const styleElement = document.createElement('style');
  styleElement.innerHTML = printStyles;
  document.head.appendChild(styleElement);
  
  // Drucken
  window.print();
  
  // Druckstile wieder entfernen
  setTimeout(() => {
    document.head.removeChild(styleElement);
  }, 1000);
}

/**
 * Validiert Bauteil-Daten vor dem Erstellen
 * @param {Object} componentData - Die zu validierenden Daten
 * @returns {boolean} True wenn gültig
 */
function validateComponentData(componentData) {
  const errors = [];
  
  // Barcode prüfen
  if (!componentData.barcode || !validateBarcode(componentData.barcode)) {
    errors.push('Barcode ist erforderlich und muss gültig sein.');
  }
  
  // Projekt prüfen
  if (!componentData.project || componentData.project.trim().length < 2) {
    errors.push('Projekt ist erforderlich (mindestens 2 Zeichen).');
  }
  
  // Verantwortlicher prüfen
  if (!componentData.responsible_engineer || componentData.responsible_engineer.trim().length < 2) {
    errors.push('Verantwortlicher ist erforderlich (mindestens 2 Zeichen).');
  }
  
  // Equipment Name prüfen
  if (!componentData.equipment_name || componentData.equipment_name.trim().length < 2) {
    errors.push('Gerätebezeichnung ist erforderlich (mindestens 2 Zeichen).');
  }
  
  if (errors.length > 0) {
    showMessage(`Validierung fehlgeschlagen:\n${errors.join('\n')}`, 'error');
    return false;
  }
  
  return true;
}

/**
 * Validiert Bauteil-Update-Daten
 * @param {Object} componentData - Die zu validierenden Daten
 * @returns {boolean} True wenn gültig
 */
function validateComponentUpdateData(componentData) {
  const errors = [];
  
  // Projekt prüfen
  if (!componentData.project || componentData.project.trim().length < 2) {
    errors.push('Projekt ist erforderlich (mindestens 2 Zeichen).');
  }
  
  // Verantwortlicher prüfen
  if (!componentData.responsible_engineer || componentData.responsible_engineer.trim().length < 2) {
    errors.push('Verantwortlicher ist erforderlich (mindestens 2 Zeichen).');
  }
  
  // Equipment Name prüfen
  if (!componentData.equipment_name || componentData.equipment_name.trim().length < 2) {
    errors.push('Gerätebezeichnung ist erforderlich (mindestens 2 Zeichen).');
  }
  
  if (errors.length > 0) {
    showMessage(`Validierung fehlgeschlagen:\n${errors.join('\n')}`, 'error');
    return false;
  }
  
  return true;
}

/**
 * Kopiert Bauteil-Daten in die Zwischenablage
 * @param {Object} component - Das Bauteil
 */
async function copyComponentData(component) {
  const data = `
Barcode: ${component.barcode}
Name: ${component.name || 'Unbenannt'}
Projekt: ${component.project || '-'}
Verantwortlicher: ${component.responsible_engineer || '-'}
Gerätebezeichnung: ${component.equipment_name || '-'}
ID-Nummer: ${component.identification_number || '-'}
Schrank: ${component.schrank_name || 'Nicht eingelagert'}
  `.trim();
  
  await copyToClipboard(data);
}