/**
 * WeaselParts Page Transition System
 * Smooth page transitions with loading animations
 */

class PageTransitions {
  constructor() {
    this.overlay = null;
    this.isTransitioning = false;
    this.init();
  }

  init() {
    this.createOverlay();
    this.bindEvents();
    console.log('🎬 Page Transitions initialized');
  }

  createOverlay() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'page-transition-overlay';
    this.overlay.innerHTML = `
      <div class="page-transition-content">
        <div class="page-transition-spinner"></div>
        <div class="page-transition-text">Seite wird geladen...</div>
      </div>
    `;
    document.body.appendChild(this.overlay);
  }

  bindEvents() {
    // Bind to all navigation links and buttons
    this.bindNavigation();
    
    // Handle browser back/forward buttons
    window.addEventListener('popstate', () => {
      this.handlePageLoad();
    });

    // Handle page load
    window.addEventListener('load', () => {
      this.handlePageLoad();
    });

    // Handle DOMContentLoaded for faster transitions
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.handlePageLoad();
      });
    }
  }

  bindNavigation() {
    // Bind to navbar buttons
    document.querySelectorAll('.modern-nav-btn').forEach(element => {
      element.addEventListener('click', (e) => {
        if (element.tagName === 'A') {
          this.handleLinkClick(e, element);
        } else if (element.tagName === 'BUTTON') {
          this.handleButtonClick(e, element);
        }
      });
    });

    // Bind to logo
    const logo = document.querySelector('.modern-logo');
    if (logo) {
      logo.addEventListener('click', (e) => {
        this.handleLinkClick(e, logo);
      });
    }

    // Bind to other internal links
    document.querySelectorAll('a[href^="/"], a[href^="./"], a[href^="../"]').forEach(link => {
      // Skip if already bound
      if (!link.classList.contains('modern-nav-btn') && !link.classList.contains('modern-logo')) {
        link.addEventListener('click', (e) => {
          this.handleLinkClick(e, link);
        });
      }
    });
  }

  handleLinkClick(e, element) {
    const href = element.getAttribute('href');
    
    // Skip external links and current page
    if (!href || href.startsWith('http') || href.startsWith('#') || href === window.location.pathname) {
      return;
    }

    e.preventDefault();
    this.navigateTo(href, this.getPageTitle(href));
  }

  handleButtonClick(e, button) {
    // Handle navigation buttons that use JavaScript
    const buttonId = button.id;
    
    if (buttonId === 'add-component-nav-btn') {
      e.preventDefault();
      this.navigateTo('/add-component.html', 'Neues Bauteil');
    } else if (buttonId === 'manage-cabinets-nav-btn') {
      e.preventDefault();
      this.navigateTo('/manage-cabinets.html', 'Schränke verwalten');
    }
  }

  getPageTitle(href) {
    const pageNames = {
      '/': 'Übersicht',
      '/add-component.html': 'Neues Bauteil',
      '/manage-cabinets.html': 'Schränke verwalten',
      '/ICD.html': 'ICD',
      '/lab-overview.html': 'Labor-Übersicht',
      '/glue-protocol.html': 'Klebeprotokoll',
      '/settings.html': 'Einstellungen',
      '/historical-record.html': 'Historical Record'
    };
    
    return pageNames[href] || 'Seite wird geladen...';
  }

  getPageBackgroundClass(href) {
    const pageBackgrounds = {
      '/': 'bg-home',
      '/add-component.html': 'bg-add-component',
      '/manage-cabinets.html': 'bg-cabinets',
      '/ICD.html': 'bg-icd',
      '/lab-overview.html': 'bg-lab',
      '/glue-protocol.html': 'bg-glue',
      '/settings.html': 'bg-settings',
      '/historical-record.html': 'bg-historical'
    };
    
    return pageBackgrounds[href] || 'bg-home';
  }

  async navigateTo(href, pageTitle = 'Seite wird geladen...') {
    if (this.isTransitioning) return;
    
    this.isTransitioning = true;
    
    // Update transition text
    const textElement = this.overlay.querySelector('.page-transition-text');
    if (textElement) {
      textElement.textContent = pageTitle;
    }
    
    // Set the background color for the target page
    const backgroundClass = this.getPageBackgroundClass(href);
    this.setOverlayBackground(backgroundClass);
    
    // Show overlay with wipe-in effect (right to left)
    this.showOverlay();
    
    // Wait for wipe animation to complete
    await this.delay(400);
    
    // Navigate to new page (force reload even if same page)
    if (href === window.location.pathname) {
      // Same page - just reload with transition effect
      window.location.reload();
    } else {
      window.location.href = href;
    }
  }

  setOverlayBackground(backgroundClass) {
    // Remove all existing background classes
    const bgClasses = ['bg-home', 'bg-add-component', 'bg-cabinets', 'bg-icd', 
                       'bg-lab', 'bg-glue', 'bg-settings', 'bg-historical'];
    bgClasses.forEach(cls => this.overlay.classList.remove(cls));
    
    // Add new background class
    this.overlay.classList.add(backgroundClass);
  }

  showOverlay() {
    // Reset any previous states
    this.overlay.classList.remove('exit');
    this.overlay.classList.add('active');
  }

  hideOverlay() {
    // Add exit class for left wipe-out animation
    this.overlay.classList.add('exit');
    
    // Remove active class after animation
    setTimeout(() => {
      this.overlay.classList.remove('active');
      this.overlay.classList.remove('exit');
      this.isTransitioning = false;
    }, 600);
  }

  handlePageLoad() {
    // Hide overlay if shown with exit animation
    if (this.overlay.classList.contains('active')) {
      // Delay to ensure content is loaded
      setTimeout(() => {
        this.hideOverlay();
      }, 100);
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Add some cool hover effects to navigation
  addNavHoverEffects() {
    document.querySelectorAll('.modern-nav-btn').forEach(btn => {
      btn.addEventListener('mouseenter', () => {
        btn.style.transform = 'translateY(-2px)';
        btn.style.transition = 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
      });
      
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'translateY(0)';
      });
    });
  }

  // Add pulse effect to active page button
  highlightCurrentPage() {
    const currentPath = window.location.pathname;
    const buttons = document.querySelectorAll('.modern-nav-btn');
    
    buttons.forEach(btn => {
      const href = btn.getAttribute('href');
      
      if (href === currentPath || (currentPath === '/' && !href)) {
        // Removed box-shadow and scale effects
        // btn.style.boxShadow = '0 0 0 2px var(--table-header-primary)';
        // btn.style.transform = 'scale(1.05)';
      }
    });
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const transitions = new PageTransitions();
    transitions.addNavHoverEffects();
    transitions.highlightCurrentPage();
  });
} else {
  const transitions = new PageTransitions();
  transitions.addNavHoverEffects();
  transitions.highlightCurrentPage();
}