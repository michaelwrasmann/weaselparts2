/**
 * WeaselParts - Historical Record Management
 */

let currentBarcode = null;
let currentComponent = null;
let allActivityRecords = [];
let currentEditingId = null;

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🏠 Historical Record page loading...');
  
  try {
    // Close all modals
    closeAllModals();
    
    // Get barcode from URL
    const urlParams = new URLSearchParams(window.location.search);
    currentBarcode = urlParams.get('barcode');
    
    if (!currentBarcode) {
      showMessage('Kein Barcode angegeben. Zurück zur Startseite...', 'error');
      setTimeout(() => window.location.href = '/', 2000);
      return;
    }
    
    // Load component info and activity records
    await loadComponentInfo();
    await loadActivityRecords();
    setupEventListeners();
    
    console.log('✅ Historical Record page initialized');
  } catch (error) {
    console.error('❌ Initialization error:', error);
    showMessage('Fehler beim Laden der Seite', 'error');
  }
});

// Setup event listeners
function setupEventListeners() {
  // Navigation Buttons - Let page-transitions.js handle these
  
  // Global Search
  const globalSearch = document.getElementById('global-search');
  if (globalSearch) {
    globalSearch.addEventListener('input', handleGlobalSearch);
  }

  // Add activity buttons
  document.getElementById('add-activity-btn')?.addEventListener('click', () => showActivityModal());
  document.getElementById('add-first-activity')?.addEventListener('click', () => showActivityModal());
  
  // Export buttons
  document.getElementById('export-csv-btn')?.addEventListener('click', () => exportToCSV());
  document.getElementById('export-pdf-btn')?.addEventListener('click', () => exportToPDF());
  
  // Modal buttons
  document.getElementById('close-activity-modal')?.addEventListener('click', () => closeModal('activity-modal'));
  document.getElementById('cancel-activity')?.addEventListener('click', () => closeModal('activity-modal'));
  document.getElementById('close-delete-modal')?.addEventListener('click', () => closeModal('delete-activity-modal'));
  document.getElementById('cancel-delete-activity')?.addEventListener('click', () => closeModal('delete-activity-modal'));
  
  // Form submission
  document.getElementById('activity-form')?.addEventListener('submit', handleSaveActivity);
  
  // Delete confirmation
  document.getElementById('confirm-delete-activity')?.addEventListener('click', handleConfirmDelete);
  
  // Close modals on escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllModals();
    }
  });
  
  // Close modals on outside click
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal(modal.id);
      }
    });
  });
}

// Load component information
async function loadComponentInfo() {
  try {
    currentComponent = await api.getComponent(currentBarcode);
    
    const headerEl = document.getElementById('component-info-header');
    if (headerEl && currentComponent) {
      headerEl.innerHTML = `
        <div class="component-header-with-image">
          <div class="component-image-container">
            ${currentComponent.image_url ? 
              `<img src="${currentComponent.image_url}" alt="${currentComponent.name}" class="component-header-image">` :
              `<div class="component-image-placeholder">
                <svg width="60" height="60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
              </div>`
            }
          </div>
          <div class="component-info-text">
            <h2 class="component-title">${currentComponent.name || 'Unbenanntes Bauteil'}</h2>
            <div class="component-details-row">
              <div class="component-detail">
                <strong>Barcode</strong>
                <span>${currentComponent.barcode}</span>
              </div>
              <div class="component-detail">
                <strong>Projekt</strong>
                <span>${currentComponent.project || '-'}</span>
              </div>
              <div class="component-detail">
                <strong>Verantwortlicher</strong>
                <span>${currentComponent.responsible_engineer || '-'}</span>
              </div>
              <div class="component-detail">
                <strong>Standort</strong>
                <span>${currentComponent.schrank_name || 'Nicht eingelagert'}</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error loading component info:', error);
    showMessage('Fehler beim Laden der Bauteilinformationen', 'error');
  }
}

// Load activity records
async function loadActivityRecords() {
  try {
    const response = await fetch(`/api/bauteil/${encodeURIComponent(currentBarcode)}/activities`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    allActivityRecords = await response.json();
    renderActivityRecords();
  } catch (error) {
    console.error('Error loading activity records:', error);
    showMessage('Fehler beim Laden der Aktivitätseinträge', 'error');
    allActivityRecords = [];
    renderActivityRecords();
  }
}

// Render activity records table
function renderActivityRecords() {
  const tbody = document.getElementById('activity-table-body');
  const noActivitiesEl = document.getElementById('no-activities');
  const tableContainer = document.querySelector('.activity-table-container table');
  
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  if (allActivityRecords.length === 0) {
    if (tableContainer) tableContainer.style.display = 'none';
    if (noActivitiesEl) noActivitiesEl.style.display = 'block';
    return;
  }
  
  if (tableContainer) tableContainer.style.display = 'table';
  if (noActivitiesEl) noActivitiesEl.style.display = 'none';
  
  allActivityRecords.forEach((record, index) => {
    // #1 = oldest, but show newest first
    const recordNumber = allActivityRecords.length - index;
    const row = createActivityRow(record, recordNumber);
    tbody.appendChild(row);
  });
}

// Create activity table row
function createActivityRow(record, rowNumber) {
  const tr = document.createElement('tr');
  
  // Get active activities
  const activities = getActiveActivities(record);
  const activitiesText = activities.length > 0 ? activities.join(', ') : '-';
  
  // Format date
  const formattedDate = record.date ? new Date(record.date).toLocaleDateString('de-DE') : '-';
  
  // Format time range
  const timeRange = formatTimeRange(record.start_time, record.end_time);
  
  // Format humidity - only end value
  const humidityValue = record.humidity_end ? `${record.humidity_end}%` : '-';
  
  // Format temperature - only end value  
  const temperatureValue = record.temperature_end ? `${record.temperature_end}°C` : '-';
  
  tr.innerHTML = `
    <td>${rowNumber}</td>
    <td>${formattedDate}</td>
    <td>${record.entry_made_by || '-'}</td>
    <td>${record.organisation || '-'}</td>
    <td>${record.location || '-'}</td>
    <td class="activities-cell">
      <span class="activities-badges">${formatActivitiesBadges(activities)}</span>
    </td>
    <td>${record.procedure_number || '-'}</td>
    <td>${timeRange}</td>
    <td>${humidityValue}</td>
    <td>${temperatureValue}</td>
    <td class="actions-cell">
      <button class="action-btn edit" onclick="editActivityRecord(${record.id})" title="Bearbeiten">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
        </svg>
      </button>
      <button class="action-btn delete" onclick="deleteActivityRecord(${record.id})" title="Löschen">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
        </svg>
      </button>
    </td>
  `;
  
  // Add click to view details
  tr.addEventListener('click', (e) => {
    if (!e.target.closest('.actions-cell')) {
      showActivityDetails(record);
    }
  });
  
  tr.style.cursor = 'pointer';
  
  return tr;
}

// Get active activities from record
function getActiveActivities(record) {
  const activityMap = {
    'activity_assy': 'ASSY',
    'activity_disassy': 'DISASSY',
    'activity_test': 'TEST',
    'activity_shpf': 'SHPF',
    'activity_insp': 'INSP',
    'activity_cln': 'CLN',
    'activity_smpl': 'SMPL',
    'activity_cal': 'CAL',
    'activity_hndl': 'HNDL',
    'activity_stor': 'STOR',
    'activity_de_stor': 'DE-STOR'
  };
  
  return Object.keys(activityMap)
    .filter(key => record[key])
    .map(key => activityMap[key]);
}

// Format activities as badges
function formatActivitiesBadges(activities) {
  if (activities.length === 0) return '-';
  
  return activities.map(activity => {
    const badgeClass = activity === 'STOR' ? 'badge-success' : 
                      activity === 'DE-STOR' ? 'badge-warning' : 
                      'badge-info';
    return `<span class="activity-badge ${badgeClass}">${activity}</span>`;
  }).join(' ');
}

// Format time range
function formatTimeRange(startTime, endTime) {
  if (!startTime && !endTime) return '-';
  
  // Remove seconds from time format
  const formatTime = (time) => {
    if (!time) return '';
    // If time has seconds (HH:MM:SS), remove them
    return time.length > 5 ? time.substring(0, 5) : time;
  };
  
  const start = formatTime(startTime);
  const end = formatTime(endTime);
  
  if (start && !end) return start;
  if (!start && end) return end;
  return `${start} - ${end}`;
}

// Format numeric range
function formatRange(start, end, unit) {
  if (start == null && end == null) return '-';
  if (start != null && end == null) return `${start}${unit}`;
  if (start == null && end != null) return `${end}${unit}`;
  return `${start}${unit} - ${end}${unit}`;
}

// Modal helper functions
function openModal(modalId) {
  console.log('📖 Öffne Modal:', modalId);
  const modal = document.getElementById(modalId);
  if (modal) {
    // Original working code FIRST (like manage-cabinets)
    modal.style.display = 'flex';
    modal.style.opacity = '1';
    modal.style.visibility = 'visible';
    modal.style.zIndex = '2000';
    modal.classList.add('active');
    
    // THEN add animation
    setTimeout(() => {
      modal.classList.add('show');
    }, 10);
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
  }
}

// Show activity modal
function showActivityModal(recordId = null) {
  currentEditingId = recordId;
  const modal = document.getElementById('activity-modal');
  const title = document.getElementById('activity-modal-title');
  const form = document.getElementById('activity-form');
  
  if (recordId) {
    const record = allActivityRecords.find(r => r.id === recordId);
    if (record) {
      title.textContent = 'Historical Record bearbeiten';
      populateForm(record);
    }
  } else {
    title.textContent = 'Neuer Historical Record';
    resetForm();
    // Set default date to today
    document.getElementById('activity-date').value = new Date().toISOString().split('T')[0];
  }
  
  openModal('activity-modal');
}

// Populate form with record data
function populateForm(record) {
  // General data
  document.getElementById('entry-made-by').value = record.entry_made_by || '';
  document.getElementById('organisation').value = record.organisation || '';
  document.getElementById('location').value = record.location || '';
  document.getElementById('further-operators').value = record.further_operators || '';
  
  // Activity Type - find the selected activity
  const activityTypes = [
    'activity_assy', 'activity_disassy', 'activity_test', 'activity_shpf',
    'activity_insp', 'activity_cln', 'activity_smpl', 'activity_cal',
    'activity_hndl', 'activity_stor', 'activity_de_stor'
  ];
  
  let selectedActivity = '';
  for (const actType of activityTypes) {
    if (record[actType]) {
      selectedActivity = actType.replace('activity_', '').toUpperCase().replace('_', '-');
      break;
    }
  }
  document.getElementById('activity-type').value = selectedActivity;
  
  document.getElementById('procedure-number').value = record.procedure_number || '';
  
  // Date and time
  document.getElementById('activity-date').value = record.date || '';
  document.getElementById('start-time').value = record.start_time || '';
  document.getElementById('end-time').value = record.end_time || '';
  
  // Environmental conditions
  document.getElementById('humidity-start').value = record.humidity_start || '';
  document.getElementById('humidity-end').value = record.humidity_end || '';
  document.getElementById('temperature-start').value = record.temperature_start || '';
  document.getElementById('temperature-end').value = record.temperature_end || '';
  
  // Remarks
  document.getElementById('remarks').value = record.remarks || '';
  document.getElementById('activity-description').value = record.activity_description || '';
  document.getElementById('reports').value = record.reports || '';
}

// Reset form
function resetForm() {
  document.getElementById('activity-form').reset();
}

// Handle save activity
async function handleSaveActivity(e) {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const data = {};
  
  // Get all form data
  for (let [key, value] of formData.entries()) {
    data[key] = value;
  }
  
  // Handle activity type dropdown - convert to individual boolean fields
  const selectedActivityType = data.activity_type;
  const activityTypes = [
    'activity_assy', 'activity_disassy', 'activity_test', 'activity_shpf',
    'activity_insp', 'activity_cln', 'activity_smpl', 'activity_cal',
    'activity_hndl', 'activity_stor', 'activity_de_stor'
  ];
  
  // Reset all activity types to false
  activityTypes.forEach(actType => {
    data[actType] = false;
  });
  
  // Set the selected activity type to true
  if (selectedActivityType) {
    const selectedField = `activity_${selectedActivityType.toLowerCase().replace('-', '_')}`;
    data[selectedField] = true;
  }
  
  // Remove the activity_type field as it's not in our database
  delete data.activity_type;
  
  // Validate required fields
  if (!data.entry_made_by || data.entry_made_by.trim() === '') {
    showMessage('Bitte geben Sie den Namen des Eingetragenen an', 'error');
    return;
  }
  
  if (!selectedActivityType) {
    showMessage('Bitte wählen Sie einen Aktivitätstyp aus', 'error');
    return;
  }
  
  try {
    const submitBtn = document.getElementById('save-activity');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="spinner"></span> Speichert...';
    submitBtn.disabled = true;
    
    let response;
    if (currentEditingId) {
      // Update existing record
      response = await fetch(`/api/activities/${currentEditingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } else {
      // Create new record
      response = await fetch(`/api/bauteil/${encodeURIComponent(currentBarcode)}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    }
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Server error');
    }
    
    const result = await response.json();
    showMessage(
      currentEditingId ? 'Historical Record erfolgreich aktualisiert!' : 'Historical Record erfolgreich erstellt!', 
      'success'
    );
    
    // Close modal and reload records
    closeModal('activity-modal');
    await loadActivityRecords();
    
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
    
  } catch (error) {
    console.error('Error saving activity record:', error);
    showMessage(`Fehler beim Speichern: ${error.message}`, 'error');
    
    const submitBtn = document.getElementById('save-activity');
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
  }
}

// Edit activity record
window.editActivityRecord = function(recordId) {
  showActivityModal(recordId);
};

// Delete activity record
window.deleteActivityRecord = function(recordId) {
  currentEditingId = recordId;
  openModal('delete-activity-modal');
};

// Handle confirm delete
async function handleConfirmDelete() {
  if (!currentEditingId) return;
  
  try {
    const confirmBtn = document.getElementById('confirm-delete-activity');
    const originalText = confirmBtn.innerHTML;
    confirmBtn.innerHTML = '<span class="spinner"></span> Wird gelöscht...';
    confirmBtn.disabled = true;
    
    const response = await fetch(`/api/activities/${currentEditingId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Server error');
    }
    
    showMessage('Historical Record erfolgreich gelöscht!', 'success');
    
    // Close modal and reload records
    closeModal('delete-activity-modal');
    await loadActivityRecords();
    
    confirmBtn.innerHTML = originalText;
    confirmBtn.disabled = false;
    currentEditingId = null;
    
  } catch (error) {
    console.error('Error deleting activity record:', error);
    showMessage(`Fehler beim Löschen: ${error.message}`, 'error');
    
    const confirmBtn = document.getElementById('confirm-delete-activity');
    confirmBtn.innerHTML = originalText;
    confirmBtn.disabled = false;
  }
}

// Show activity details (for future enhancement)
function showActivityDetails(record) {
  // Could open a read-only modal with full details
  console.log('Show details for record:', record);
}

// Close all modals
function closeAllModals() {
  document.querySelectorAll('.modal').forEach(modal => {
    modal.classList.remove('active');
    modal.style.display = 'none';
    modal.style.opacity = '0';
    modal.style.visibility = 'hidden';
  });
}

// Export to CSV
function exportToCSV() {
  if (allActivityRecords.length === 0) {
    showMessage('Keine Daten zum Exportieren vorhanden', 'warning');
    return;
  }

  const csvData = allActivityRecords.map(record => ({
    'Datum': record.date ? new Date(record.date).toLocaleDateString('de-DE') : '',
    'Eingetragen von': record.entry_made_by || '',
    'Organisation': record.organisation || '',
    'Ort': record.location || '',
    'Weitere Bearbeiter': record.further_operators || '',
    'Aktivität': getActiveActivities(record).join(', '),
    'Prozedur Nr.': record.procedure_number || '',
    'Startzeit': record.start_time || '',
    'Endzeit': record.end_time || '',
    'Luftfeuchtigkeit Start': record.humidity_start || '',
    'Luftfeuchtigkeit Ende': record.humidity_end || '',
    'Temperatur Start': record.temperature_start || '',
    'Temperatur Ende': record.temperature_end || '',
    'Bemerkungen': record.remarks || '',
    'Aktivitätsbeschreibung': record.activity_description || '',
    'Berichte': record.reports || ''
  }));

  const csv = convertToCSV(csvData);
  const componentName = currentComponent?.name || 'Komponente';
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  downloadCSV(csv, `Historical_Record_${componentName}_${currentBarcode}_${timestamp}.csv`);
  
  showMessage('CSV Export erfolgreich heruntergeladen', 'success');
}

// Export to PDF
async function exportToPDF() {
  if (allActivityRecords.length === 0) {
    showMessage('Keine Daten zum Exportieren vorhanden', 'warning');
    return;
  }

  try {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    
    const componentName = currentComponent?.name || 'Komponente';
    const componentBarcode = currentComponent?.barcode || '';
    
    // Set font and initial position
    pdf.setFont('helvetica');
    let yPosition = 20;
    const margin = 20;
    const pageWidth = pdf.internal.pageSize.width;
    const pageHeight = pdf.internal.pageSize.height;
    
    // Title
    pdf.setFontSize(16);
    pdf.setTextColor(74, 144, 226); // Primary blue
    pdf.text('Historical Record', margin, yPosition);
    yPosition += 10;
    
    // Component info
    pdf.setFontSize(12);
    pdf.setTextColor(0, 0, 0);
    pdf.text(`Komponente: ${componentName}`, margin, yPosition);
    yPosition += 6;
    pdf.text(`Barcode: ${componentBarcode}`, margin, yPosition);
    yPosition += 6;
    pdf.text(`Projekt: ${currentComponent?.project || '-'}`, margin, yPosition);
    yPosition += 6;
    pdf.text(`Verantwortlicher: ${currentComponent?.responsible_engineer || '-'}`, margin, yPosition);
    yPosition += 6;
    pdf.text(`Export-Datum: ${new Date().toLocaleDateString('de-DE')}`, margin, yPosition);
    yPosition += 10;
    
    // Horizontal line
    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;
    
    let recordCount = 0;
    const recordsPerPage = 5;
    
    for (let i = 0; i < allActivityRecords.length; i++) {
      const record = allActivityRecords[i];
      
      // Check if we need a new page (except for first page)
      if (recordCount > 0 && recordCount % recordsPerPage === 0) {
        pdf.addPage();
        yPosition = 20;
        
        // Add page header
        pdf.setFontSize(12);
        pdf.setTextColor(74, 144, 226);
        pdf.text(`Historical Record - ${componentName} (Fortsetzung)`, margin, yPosition);
        yPosition += 15;
      }
      
      // Record header
      pdf.setFontSize(12);
      pdf.setTextColor(74, 144, 226);
      pdf.text(`Eintrag ${i + 1}`, margin, yPosition);
      yPosition += 8;
      
      // Create table-like layout
      pdf.setFontSize(10);
      pdf.setTextColor(0, 0, 0);
      
      const leftCol = margin;
      const rightCol = margin + 90;
      
      // Date and entry info
      pdf.text(`Datum: ${record.date ? new Date(record.date).toLocaleDateString('de-DE') : '-'}`, leftCol, yPosition);
      pdf.text(`Eingetragen von: ${record.entry_made_by || '-'}`, rightCol, yPosition);
      yPosition += 5;
      
      pdf.text(`Organisation: ${record.organisation || '-'}`, leftCol, yPosition);
      pdf.text(`Ort: ${record.location || '-'}`, rightCol, yPosition);
      yPosition += 5;
      
      // Activity and procedure
      const activities = getActiveActivities(record);
      pdf.text(`Aktivität: ${activities.join(', ') || '-'}`, leftCol, yPosition);
      pdf.text(`Prozedur Nr.: ${record.procedure_number || '-'}`, rightCol, yPosition);
      yPosition += 5;
      
      // Time and environmental data
      const timeRange = formatTimeRange(record.start_time, record.end_time);
      pdf.text(`Zeit: ${timeRange}`, leftCol, yPosition);
      
      const humidityRange = formatRange(record.humidity_start, record.humidity_end, '%');
      pdf.text(`Luftfeuchtigkeit: ${humidityRange}`, rightCol, yPosition);
      yPosition += 5;
      
      const temperatureRange = formatRange(record.temperature_start, record.temperature_end, '°C');
      pdf.text(`Temperatur: ${temperatureRange}`, leftCol, yPosition);
      
      if (record.further_operators) {
        pdf.text(`Weitere Bearbeiter: ${record.further_operators}`, rightCol, yPosition);
      }
      yPosition += 5;
      
      // Remarks section
      if (record.remarks || record.activity_description || record.reports) {
        pdf.setFontSize(9);
        pdf.setTextColor(60, 60, 60);
        
        if (record.remarks) {
          const remarksLines = pdf.splitTextToSize(`Bemerkungen: ${record.remarks}`, pageWidth - (2 * margin));
          pdf.text(remarksLines, leftCol, yPosition);
          yPosition += (remarksLines.length * 4);
        }
        
        if (record.activity_description) {
          const descLines = pdf.splitTextToSize(`Beschreibung: ${record.activity_description}`, pageWidth - (2 * margin));
          pdf.text(descLines, leftCol, yPosition);
          yPosition += (descLines.length * 4);
        }
        
        if (record.reports) {
          const reportLines = pdf.splitTextToSize(`Berichte: ${record.reports}`, pageWidth - (2 * margin));
          pdf.text(reportLines, leftCol, yPosition);
          yPosition += (reportLines.length * 4);
        }
      }
      
      // Separator line
      yPosition += 3;
      pdf.setDrawColor(220, 220, 220);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 10;
      
      recordCount++;
      
      // Check if we're running out of space on current page
      if (yPosition > pageHeight - 30) {
        pdf.addPage();
        yPosition = 20;
        recordCount = 0; // Reset counter for new page
      }
    }
    
    // Footer on last page
    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);
    const finalY = pageHeight - 15;
    pdf.text(`Generiert am ${new Date().toLocaleString('de-DE')} | WeaselParts Historical Record`, margin, finalY);
    
    // Save the PDF
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `Historical_Record_${componentName}_${currentBarcode}_${timestamp}.pdf`;
    
    pdf.save(filename);
    showMessage('PDF Export erfolgreich heruntergeladen', 'success');
    
  } catch (error) {
    console.error('PDF Export error:', error);
    showMessage('Fehler beim PDF Export: ' + error.message, 'error');
  }
}

// Helper function to convert data to CSV
function convertToCSV(data) {
  if (data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(header => {
      const value = row[header] || '';
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(','))
  ].join('\n');
  
  return csvContent;
}

// Helper function to download CSV
function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// Global search handler
function handleGlobalSearch() {
  const searchInput = document.getElementById('global-search');
  if (!searchInput) return;
  
  const query = searchInput.value.toLowerCase().trim();
  
  if (query) {
    // Redirect to index with search query
    window.location.href = `/?search=${encodeURIComponent(query)}`;
  }
}