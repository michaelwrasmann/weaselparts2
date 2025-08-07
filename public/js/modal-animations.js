/**
 * WeaselParts Modal Animation System
 * Smooth slide-up animations for all modals
 */

class ModalAnimations {
  constructor() {
    this.init();
  }

  init() {
    this.bindAllModals();
    console.log('🎬 Modal Animations initialized');
  }

  bindAllModals() {
    // Auto-detect all modals and add animations
    document.querySelectorAll('.modal').forEach(modal => {
      this.setupModal(modal);
    });

    // Watch for dynamically added modals
    this.observeNewModals();
  }

  setupModal(modal) {
    // Skip if already setup
    if (modal.hasAttribute('data-animated')) return;
    
    modal.setAttribute('data-animated', 'true');
    
    // Find close buttons
    const closeButtons = modal.querySelectorAll('.close-modal, .modal-close, [data-dismiss="modal"]');
    closeButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.hideModal(modal);
      });
    });

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.hideModal(modal);
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('show')) {
        this.hideModal(modal);
      }
    });
  }

  showModal(modal) {
    if (typeof modal === 'string') {
      modal = document.getElementById(modal) || document.querySelector(modal);
    }
    
    if (!modal) return;

    // Setup if not already done
    if (!modal.hasAttribute('data-animated')) {
      this.setupModal(modal);
    }

    // Show modal with animation
    modal.style.display = 'flex';
    
    // Force reflow for animation
    modal.offsetHeight;
    
    // Add show class for slide-up animation
    modal.classList.add('show');

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Focus management
    const firstFocusable = modal.querySelector('input, button, textarea, select, [tabindex]');
    if (firstFocusable) {
      setTimeout(() => firstFocusable.focus(), 100);
    }
  }

  hideModal(modal) {
    if (typeof modal === 'string') {
      modal = document.getElementById(modal) || document.querySelector(modal);
    }
    
    if (!modal) return;

    // Remove show class for slide-down animation
    modal.classList.remove('show');

    // Hide modal after animation completes
    setTimeout(() => {
      modal.style.display = 'none';
      document.body.style.overflow = 'auto';
    }, 400);
  }

  observeNewModals() {
    // Watch for new modals being added to the DOM
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // Element node
            // Check if the added node is a modal
            if (node.classList && node.classList.contains('modal')) {
              this.setupModal(node);
            }
            // Check if the added node contains modals
            const modals = node.querySelectorAll ? node.querySelectorAll('.modal') : [];
            modals.forEach(modal => this.setupModal(modal));
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Enhanced modal functions for specific use cases
  showDeleteConfirm(title = 'Löschen bestätigen', message = 'Möchten Sie dieses Element wirklich löschen?', onConfirm = () => {}) {
    const modal = this.createConfirmModal(title, message, onConfirm);
    this.showModal(modal);
  }

  showInfoModal(title, content) {
    const modal = this.createInfoModal(title, content);
    this.showModal(modal);
  }

  createConfirmModal(title, message, onConfirm) {
    const modalId = 'confirm-modal-' + Date.now();
    const modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'modal';
    
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 400px;">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="close-modal">&times;</button>
        </div>
        <div class="modal-body">
          <p>${message}</p>
        </div>
        <div class="modal-footer">
          <button class="modern-btn modern-btn-secondary cancel-btn">Abbrechen</button>
          <button class="modern-btn modern-btn-primary confirm-btn">Löschen</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Add event listeners
    modal.querySelector('.cancel-btn').addEventListener('click', () => {
      this.hideModal(modal);
      setTimeout(() => document.body.removeChild(modal), 500);
    });

    modal.querySelector('.confirm-btn').addEventListener('click', () => {
      onConfirm();
      this.hideModal(modal);
      setTimeout(() => document.body.removeChild(modal), 500);
    });

    return modal;
  }

  createInfoModal(title, content) {
    const modalId = 'info-modal-' + Date.now();
    const modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'modal';
    
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 500px;">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="close-modal">&times;</button>
        </div>
        <div class="modal-body">
          ${content}
        </div>
        <div class="modal-footer">
          <button class="modern-btn modern-btn-primary close-btn">OK</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Add event listener
    modal.querySelector('.close-btn').addEventListener('click', () => {
      this.hideModal(modal);
      setTimeout(() => document.body.removeChild(modal), 500);
    });

    return modal;
  }
}

// Global instance
let modalAnimations;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    modalAnimations = new ModalAnimations();
  });
} else {
  modalAnimations = new ModalAnimations();
}

// Global helper functions
window.showModal = function(modalSelector) {
  if (modalAnimations) {
    modalAnimations.showModal(modalSelector);
  }
};

window.hideModal = function(modalSelector) {
  if (modalAnimations) {
    modalAnimations.hideModal(modalSelector);
  }
};

window.showDeleteConfirm = function(title, message, onConfirm) {
  if (modalAnimations) {
    modalAnimations.showDeleteConfirm(title, message, onConfirm);
  }
};

window.showInfoModal = function(title, content) {
  if (modalAnimations) {
    modalAnimations.showInfoModal(title, content);
  }
};