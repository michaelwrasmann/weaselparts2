/**
 * WeaselParts - Automatisierter Barcode-Druck Integration
 * Optimiert für DYMO 19mm x 51mm Etiketten
 */

// Haupt-Funktion für automatisierten Barcode-Druck
function autoPrintBarcode(barcode, componentName = '', options = {}) {
  if (!barcode) {
    showMessage('Kein Barcode zum Drucken vorhanden', 'error');
    return;
  }
  
  console.log('🖨️ Starte automatischen Barcode-Druck:', barcode);
  
  const settings = {
    labelSize: '19x51', // DYMO 19mm x 51mm
    dpi: 300,
    scale: 100, // 100% für kleine Labels
    copies: 1,
    ...options
  };
  
  // Neues Print-Fenster erstellen
  const printWindow = window.open('', '_blank', 'width=400,height=600,scrollbars=no,menubar=no,toolbar=no');
  
  if (!printWindow) {
    showMessage('Pop-up wurde blockiert. Bitte erlaube Pop-ups für diese Seite.', 'warning');
    return;
  }
  
  createPrintWindow(printWindow, barcode, componentName, settings);
}

// Print-Fenster HTML generieren
function createPrintWindow(printWindow, barcode, componentName, settings) {
  // Barcode NICHT gedreht für kleine Labels, kompakte Darstellung
  const barcodeUrl = `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(barcode)}&code=Code128&translate-esc=on&unit=Fit&dpi=${settings.dpi}&imagetype=Png&rotation=0&color=%23000000&bgcolor=%23ffffff&qunit=Mm&quiet=0&eclevel=L`;
  
  const printHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>WeaselParts Barcode: ${barcode}</title>
      <style>
        @page {
          size: 51mm 19mm;  /* DYMO 19mm x 51mm (Breite x Höhe im Querformat) */
          margin: 0;
        }
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          width: 51mm;
          height: 19mm;
          display: flex;
          align-items: flex-start;  /* Nach oben ausrichten statt center */
          justify-content: center;
          font-family: Arial, sans-serif;
          background: white;
          padding: 0.5mm 1mm 1mm 1mm;  /* Minimales Padding oben für maximale Höhe */
          overflow: hidden;
        }
        
        .barcode-container {
          text-align: center;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;  /* Nach oben ausrichten */
          align-items: center;
        }
        
        .barcode-image {
          width: auto;
          height: 14mm;  /* 40% größer: von 10mm auf 14mm */
          max-width: 48mm;
        }
        
        .barcode-text {
          font-size: 8.4pt;  /* 40% größer: von 6pt auf 8.4pt */
          font-weight: bold;
          margin-top: 0.5mm;
          line-height: 1;
        }
        
        .component-name {
          font-size: 7pt;  /* 40% größer: von 5pt auf 7pt */
          font-weight: normal;
          color: #333;
          line-height: 1;
          max-width: 48mm;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        .weaselparts-logo {
          display: none; /* Kein Platz für Logo auf kleinen Labels */
        }
        
        .print-status {
          position: absolute;
          top: 2mm;
          left: 2mm;
          background: #007bff;
          color: white;
          padding: 1mm 2mm;
          border-radius: 1mm;
          font-size: 5pt;
          font-weight: bold;
        }
        
        .print-status.success {
          background: #28a745;
        }
        
        .print-status.error {
          background: #dc3545;
        }
        
        /* Print-optimierte Anpassungen */
        @media print {
          .print-status {
            display: none;
          }
          
          body {
            padding: 0mm 0.5mm 0.5mm 0.5mm;  /* Kein Padding oben beim Drucken */
          }
          
          .barcode-image {
            height: 15mm; /* Noch etwas größer beim Drucken */
          }
        }
      </style>
    </head>
    <body>
      <div class="print-status" id="status">🖨️ Vorbereitung...</div>
      
      <div class="barcode-container">
        <img class="barcode-image" 
             src="${barcodeUrl}" 
             alt="Barcode ${barcode}" 
             onload="handleImageLoad()"
             onerror="handleImageError()">
        ${componentName ? `<div class="component-name">${componentName}</div>` : `<div class="barcode-text">${barcode}</div>`}
      </div>
      
      <script>
        let printInitiated = false;
        let printTimeout = null;
        
        function updateStatus(message, type = 'info') {
          const status = document.getElementById('status');
          status.textContent = message;
          status.className = 'print-status ' + type;
          console.log('📄 Print Status:', message);
        }
        
        function handleImageLoad() {
          console.log('✅ Barcode-Bild geladen');
          updateStatus('📸 Bild geladen', 'success');
          
          // Kurz warten, dann drucken
          setTimeout(initiatePrint, 500);
        }
        
        function handleImageError() {
          console.error('❌ Barcode-Bild konnte nicht geladen werden');
          updateStatus('❌ Bild-Fehler', 'error');
          alert('Barcode konnte nicht geladen werden. Prüfe die Internetverbindung.');
        }
        
        function initiatePrint() {
          if (printInitiated) return;
          printInitiated = true;
          
          console.log('🖨️ Starte Druckvorgang...');
          console.log('📏 Label-Größe: 19mm x 51mm');
          updateStatus('🖨️ Drucke...', 'info');
          
          try {
            // Drucken starten
            window.print();
            
            updateStatus('✅ Druck gestartet!', 'success');
            
            // Fenster nach erfolgreicher Übertragung schließen
            setTimeout(() => {
              updateStatus('🔄 Schließe Fenster...', 'info');
              if (window.opener) {
                window.close();
              }
            }, 2000);
            
          } catch (error) {
            console.error('❌ Druck-Fehler:', error);
            updateStatus('❌ Druck fehlgeschlagen', 'error');
            alert('Drucken fehlgeschlagen. Verwende Strg+P für manuellen Druck.\\n\\nStelle sicher dass "DYMO 19mm x 51mm" als Papierformat ausgewählt ist!');
          }
        }
        
        // Fallback-Timer für den Fall, dass Bild nicht lädt
        printTimeout = setTimeout(() => {
          if (!printInitiated) {
            console.log('⏰ Fallback: Druck nach Timeout');
            updateStatus('⏰ Timeout-Druck', 'info');
            initiatePrint();
          }
        }, 5000);
        
        // Cleanup bei Fenster-Close
        window.addEventListener('beforeunload', () => {
          if (printTimeout) clearTimeout(printTimeout);
        });
        
        // Keyboard Shortcuts
        document.addEventListener('keydown', function(e) {
          if (e.ctrlKey && e.key === 'p') {
            e.preventDefault();
            initiatePrint();
          }
          if (e.key === 'Escape') {
            window.close();
          }
        });
        
        // Initial Status
        updateStatus('🔄 Lade Barcode...', 'info');
        
        // Druckhinweis in Konsole
        console.log('🏷️ DYMO Drucker-Einstellungen:');
        console.log('   - Papierformat: 19mm x 51mm');
        console.log('   - Ausrichtung: Automatisch/Querformat');
        console.log('   - Skalierung: Tatsächliche Größe (100%)');
        console.log('   - Ränder: Ohne Rand');
      </script>
    </body>
    </html>
  `;
  
  printWindow.document.write(printHTML);
  printWindow.document.close();
  
  return printWindow;
}

// Integration in bestehende WeaselParts Funktionen
function enhancePrintFunctions() {
  console.log('🔧 Erweitere Print-Funktionen für 19mm x 51mm Labels...');
  
  // Bestehende printComponentLabel Funktion überschreiben/erweitern
  const originalPrintFunction = window.printComponentLabel;
  
  window.printComponentLabel = function(barcode, componentName) {
    if (barcode) {
      // Neue automatisierte Funktion verwenden
      autoPrintBarcode(barcode, componentName);
    } else {
      // Fallback zur ursprünglichen Funktion
      if (typeof originalPrintFunction === 'function') {
        originalPrintFunction();
      } else {
        showMessage('Kein Barcode zum Drucken verfügbar', 'warning');
      }
    }
  };
  
  // Neue erweiterte Funktionen
  window.printComponentLabelAdvanced = function(barcode, componentName, options) {
    autoPrintBarcode(barcode, componentName, options);
  };
  
  // Batch-Druck für mehrere Labels
  window.printMultipleLabels = async function(components, options = {}) {
    if (!components || components.length === 0) {
      showMessage('Keine Bauteile zum Drucken ausgewählt', 'warning');
      return;
    }
    
    const delay = options.delay || 3000; // 3 Sekunden zwischen Drucken
    
    for (let i = 0; i < components.length; i++) {
      const component = components[i];
      showMessage(`Drucke Label ${i + 1} von ${components.length}: ${component.name || component.barcode}`, 'info', 2000);
      
      autoPrintBarcode(component.barcode, component.name, options);
      
      // Pause zwischen den Druckvorgängen (außer beim letzten)
      if (i < components.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    showMessage(`Alle ${components.length} Labels wurden zum Druck gesendet!`, 'success');
  };
  
  // Test-Funktion für Label-Größe
  window.testLabelPrint = function() {
    console.log('🧪 Teste Druck mit 19mm x 51mm Label...');
    autoPrintBarcode('TEST-19x51-LABEL', 'Test Label für DYMO 19x51mm');
  };
  
  console.log('✅ Print-Funktionen für 19mm x 51mm Labels erweitert');
  console.log('💡 Tipp: Verwende testLabelPrint() zum Testen der Label-Größe');
}

// Automatisch beim Laden initialisieren
document.addEventListener('DOMContentLoaded', function() {
  enhancePrintFunctions();
});

// Export für Module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { autoPrintBarcode, enhancePrintFunctions };
}
