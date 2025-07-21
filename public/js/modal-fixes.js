/**
 * WeaselParts Modal Fixes - Verhindert automatisches Öffnen aller Modals
 * Speichere diese Datei als: /public/js/modal-fixes.js
 */

console.log('🔧 Modal-Fixes werden geladen...');

// Sofort beim Laden alle Modals schließen
document.addEventListener('DOMContentLoaded', function() {
  console.log('🔧 Modal-Fixes werden angewendet...');
  
  // KRITISCHER FIX: Alle Modals initial schließen
  function closeAllModals() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
      modal.classList.remove('active');
      modal.style.display = 'none';
      modal.style.opacity = '0';
      modal.style.visibility = 'hidden';
    });
    console.log(`✅ ${modals.length} Modals geschlossen`);
  }
  
  // Mehrfach ausführen um sicherzugehen
  closeAllModals();
  setTimeout(closeAllModals, 50);
  setTimeout(closeAllModals, 100);
  setTimeout(closeAllModals, 500);
  
  // CSS Override um Modal-Display zu kontrollieren
  const modalCSS = `
    <style id="modal-fixes-css">
    .modal {
      display: none !important;
      opacity: 0 !important;
      visibility: hidden !important;
      transition: all 0.3s ease;
    }

    .modal.active {
      display: flex !important;
      opacity: 1 !important;
      visibility: visible !important;
    }

    /* Verhindere dass Scanner-Modal automatisch öffnet */
    #scanner-modal:not(.active) {
      display: none !important;
    }

    /* Verhindere dass andere Modals automatisch öffnen */
    #cabinet-details-modal:not(.active),
    #delete-confirmation-modal:not(.active),
    #barcode-modal:not(.active) {
      display: none !important;
    }

    /* Überschreibe eventuelle CSS-Konflikte */
    .modal-content {
      transform: scale(0.9);
      transition: transform 0.3s ease;
    }

    .modal.active .modal-content {
      transform: scale(1);
    }
    </style>
  `;
  
  // CSS sofort einfügen
  document.head.insertAdjacentHTML('beforeend', modalCSS);
  
  // Sichere Modal-Funktionen definieren
  window.openModal = function(modalId) {
    console.log('📖 Öffne Modal:', modalId);
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'flex';
      modal.classList.add('active');
      setTimeout(() => {
        modal.style.opacity = '1';
        modal.style.visibility = 'visible';
      }, 10);
    }
  };
  
  window.closeModal = function(modalId) {
    console.log('📕 Schließe Modal:', modalId);
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
      modal.style.opacity = '0';
      modal.style.visibility = 'hidden';
      setTimeout(() => {
        modal.style.display = 'none';
      }, 300);
    }
  };
  
  // Globale Escape-Taste für alle Modals
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      closeAllModals();
    }
  });
  
  // Click-outside-to-close für alle Modals
  document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal')) {
      e.target.classList.remove('active');
      e.target.style.display = 'none';
      e.target.style.opacity = '0';
      e.target.style.visibility = 'hidden';
    }
  });
  
  console.log('✅ Modal-Fixes erfolgreich angewendet');
});

// Zusätzlicher Schutz: Falls Modals später dynamisch hinzugefügt werden
const observer = new MutationObserver(function(mutations) {
  mutations.forEach(function(mutation) {
    mutation.addedNodes.forEach(function(node) {
      if (node.nodeType === 1 && node.classList && node.classList.contains('modal')) {
        node.classList.remove('active');
        node.style.display = 'none';
        console.log('🔧 Dynamisch hinzugefügtes Modal geschlossen:', node.id);
      }
    });
  });
});

// Observer starten sobald DOM ready
document.addEventListener('DOMContentLoaded', function() {
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
});
