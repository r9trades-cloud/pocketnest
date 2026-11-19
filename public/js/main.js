// ========================================
// PocketNest - Main JavaScript
// ========================================

document.addEventListener('DOMContentLoaded', function() {
  // Initialize all components
  initPasswordToggles();
  initModals();
  initDropdowns();
  initSidebar();
  initTableFilters();
  initToastDismiss();
  initInvitationCode();
  initFormValidation();
  initCopyButtons();
});

// ========================================
// Password Toggle
// ========================================
function initPasswordToggles() {
  document.querySelectorAll('.toggle-password').forEach(button => {
    button.addEventListener('click', function() {
      const input = this.parentElement.querySelector('input[type="password"], input[type="text"]');
      const isPassword = input.type === 'password';

      input.type = isPassword ? 'text' : 'password';
      input.setAttribute('data-visible', isPassword);
    });
  });
}

// ========================================
// Modals
// ========================================
function initModals() {
  // Open modals
  document.querySelectorAll('[data-modal]').forEach(trigger => {
    trigger.addEventListener('click', function() {
      const modalId = this.dataset.modal;
      const modal = document.getElementById(modalId);
      if (modal) {
        openModal(modal);

        // Pre-fill child ID if action button
        if (this.dataset.action && this.dataset.childId) {
          const childIdInput = modal.querySelector('input[name="childId"]');
          const childSelect = modal.querySelector('select[name="childId"]');
          if (childIdInput) childIdInput.value = this.dataset.childId;
          if (childSelect) childSelect.value = this.dataset.childId;
        }
      }
    });
  });

  // Close modals
  document.querySelectorAll('.modal-close, .modal-overlay').forEach(el => {
    el.addEventListener('click', function(e) {
      if (e.target === this || this.classList.contains('modal-close')) {
        const modal = this.closest('.modal-overlay');
        if (modal) closeModal(modal);
      }
    });
  });

  // Close on Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(closeModal);
    }
  });
}

function openModal(modal) {
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';

  // Focus first input
  const firstInput = modal.querySelector('input, select, textarea');
  if (firstInput) {
    setTimeout(() => firstInput.focus(), 100);
  }
}

function closeModal(modal) {
  modal.classList.remove('active');
  document.body.style.overflow = '';

  // Reset form
  const form = modal.querySelector('form');
  if (form) form.reset();
}

// ========================================
// Dropdowns
// ========================================
function initDropdowns() {
  const userMenuBtn = document.getElementById('userMenuBtn');
  const userDropdown = document.getElementById('userDropdown');

  if (userMenuBtn && userDropdown) {
    userMenuBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      userDropdown.classList.toggle('active');
    });

    document.addEventListener('click', function(e) {
      if (!userMenuBtn.contains(e.target) && !userDropdown.contains(e.target)) {
        userDropdown.classList.remove('active');
      }
    });
  }

  // Notification button
  const notificationBtn = document.getElementById('notificationBtn');
  if (notificationBtn) {
    notificationBtn.addEventListener('click', function(e) {
      // Let the link work normally, just track click
    });
  }
}

// ========================================
// Sidebar (Mobile)
// ========================================
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  // Create overlay if not exists
  let overlay = document.querySelector('.sidebar-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);
  }

  // Create toggle button for mobile
  let sidebarToggle = document.querySelector('.sidebar-toggle');
  if (!sidebarToggle) {
    sidebarToggle = document.createElement('button');
    sidebarToggle.className = 'sidebar-toggle btn btn-ghost';
    sidebarToggle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
    sidebarToggle.style.display = 'none';
    sidebarToggle.setAttribute('aria-label', 'Toggle menu');

    const headerLeft = document.querySelector('.header-left');
    if (headerLeft) {
      headerLeft.insertBefore(sidebarToggle, headerLeft.firstChild);
    }
  }

  // Show/hide toggle based on screen size
  function checkSidebar() {
    if (window.innerWidth <= 1024) {
      sidebarToggle.style.display = 'flex';
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    } else {
      sidebarToggle.style.display = 'none';
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    }
  }

  sidebarToggle.addEventListener('click', function() {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
  });

  overlay.addEventListener('click', function() {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
  });

  // Close sidebar when clicking a nav item on mobile
  sidebar.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function() {
      if (window.innerWidth <= 1024) {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
      }
    });
  });

  window.addEventListener('resize', checkSidebar);
  checkSidebar();
}

// ========================================
// Table Filters
// ========================================
function initTableFilters() {
  const table = document.getElementById('transactionsTable');
  if (!table) return;

  const typeFilter = document.getElementById('typeFilter');
  const childFilter = document.getElementById('childFilter');
  const statusFilter = document.getElementById('statusFilter');
  const rows = table.querySelectorAll('tbody tr');

  function filterRows() {
    const typeVal = typeFilter?.value || '';
    const childVal = childFilter?.value || '';
    const statusVal = statusFilter?.value || '';

    rows.forEach(row => {
      const typeMatch = !typeVal || row.dataset.type === typeVal;
      const childMatch = !childVal || row.dataset.child === childVal;
      const statusMatch = !statusVal || row.dataset.status === statusVal;

      row.style.display = (typeMatch && childMatch && statusMatch) ? '' : 'none';
    });

    updatePagination();
  }

  [typeFilter, childFilter, statusFilter].forEach(filter => {
    if (filter) {
      filter.addEventListener('change', filterRows);
    }
  });

  // Pagination
  const rowsPerPage = 10;
  let currentPage = 1;

  function updatePagination() {
    const visibleRows = Array.from(rows).filter(row => row.style.display !== 'none');
    const totalPages = Math.ceil(visibleRows.length / rowsPerPage);

    if (totalPages <= 1) {
      document.getElementById('pagination').innerHTML = '';
      return;
    }

    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;

    visibleRows.forEach((row, index) => {
      row.style.display = (index >= start && index < end) ? '' : 'none';
    });

    renderPagination(totalPages);
  }

  function renderPagination(totalPages) {
    const container = document.getElementById('pagination');
    if (!container) return;

    let html = '';

    // Previous
    html += `<button ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></button>`;

    // Page numbers
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
      html += `<button data-page="1">1</button>`;
      if (startPage > 2) html += `<span class="pagination-ellipsis">...</span>`;
    }

    for (let i = startPage; i <= endPage; i++) {
      html += `<button class="${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) html += `<span class="pagination-ellipsis">...</span>`;
      html += `<button data-page="${totalPages}">${totalPages}</button>`;
    }

    // Next
    html += `<button ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button>`;

    container.innerHTML = html;

    container.querySelectorAll('button[data-page]').forEach(btn => {
      btn.addEventListener('click', function() {
        const page = parseInt(this.dataset.page);
        if (page >= 1 && page <= totalPages && page !== currentPage) {
          currentPage = page;
          updatePagination();
        }
      });
    });
  }

  // Initialize
  updatePagination();
}

// ========================================
// Toast Dismiss
// ========================================
function initToastDismiss() {
  document.querySelectorAll('.alert-close').forEach(btn => {
    btn.addEventListener('click', function() {
      const alert = this.closest('.alert');
      if (alert) {
        alert.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => alert.remove(), 300);
      }
    });
  });

  // Auto-dismiss toasts after 5 seconds
  document.querySelectorAll('.toast').forEach(toast => {
    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
      }
    }, 5000);
  });
}

// ========================================
// Invitation Code Display
// ========================================
function initInvitationCode() {
  const invitationCodeEl = document.getElementById('invitationCode');
  const copyBtn = document.getElementById('copyInvitationCode');

  if (invitationCodeEl && invitationCodeEl.textContent === 'Loading...') {
    // Get from URL or data attribute
    const code = invitationCodeEl.dataset.code || new URLSearchParams(window.location.search).get('code');
    if (code) {
      invitationCodeEl.textContent = code;
    }
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', function() {
      const code = invitationCodeEl.textContent;
      if (code && code !== 'Loading...') {
        navigator.clipboard.writeText(code).then(() => {
          const originalText = this.textContent;
          this.textContent = 'Copied!';
          this.classList.add('btn-success');
          this.classList.remove('btn-secondary');
          setTimeout(() => {
            this.textContent = originalText;
            this.classList.remove('btn-success');
            this.classList.add('btn-secondary');
          }, 2000);
        });
      }
    });
  }
}

// ========================================
// Form Validation
// ========================================
function initFormValidation() {
  document.querySelectorAll('form').forEach(form => {
    form.addEventListener('submit', function(e) {
      let isValid = true;
      const requiredFields = form.querySelectorAll('[required]');

      requiredFields.forEach(field => {
        if (!field.value.trim()) {
          isValid = false;
          showFieldError(field, 'This field is required');
        } else {
          clearFieldError(field);
        }
      });

      // Check password match for register form
      if (form.id === 'registerForm') {
        const password = form.querySelector('#password');
        const confirmPassword = form.querySelector('#confirmPassword');
        if (password && confirmPassword && password.value !== confirmPassword.value) {
          isValid = false;
          showFieldError(confirmPassword, 'Passwords do not match');
        }
      }

      // Check amount is positive
      const amountFields = form.querySelectorAll('input[type="number"][min]');
      amountFields.forEach(field => {
        const min = parseFloat(field.getAttribute('min')) || 0;
        if (parseFloat(field.value) < min) {
          isValid = false;
          showFieldError(field, `Amount must be at least ${min}`);
        }
      });

      if (!isValid) {
        e.preventDefault();
      }
    });

    // Clear errors on input
    form.querySelectorAll('input, select, textarea').forEach(field => {
      field.addEventListener('input', function() {
        clearFieldError(this);
      });
    });
  });
}

function showFieldError(field, message) {
  clearFieldError(field);
  field.style.borderColor = 'var(--error)';
  field.style.boxShadow = '0 0 0 3px var(--error-bg)';

  const errorEl = document.createElement('div');
  errorEl.className = 'field-error';
  errorEl.style.cssText = 'color: var(--error); font-size: 0.75rem; margin-top: var(--space-1);';
  errorEl.textContent = message;
  field.parentNode.appendChild(errorEl);
}

function clearFieldError(field) {
  field.style.borderColor = '';
  field.style.boxShadow = '';
  const errorEl = field.parentNode.querySelector('.field-error');
  if (errorEl) errorEl.remove();
}

// ========================================
// Copy Buttons
// ========================================
function initCopyButtons() {
  document.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', function() {
      const targetId = this.dataset.copy;
      const target = document.getElementById(targetId);
      if (target) {
        const text = target.value || target.textContent;
        navigator.clipboard.writeText(text).then(() => {
          showToast('Copied to clipboard!', 'success');
        });
      }
    });
  });
}

// ========================================
// Utility Functions
// ========================================

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `alert alert-${type} toast`;
  toast.innerHTML = `
    <svg class="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      ${getToastIcon(type)}
    </svg>
    <span>${message}</span>
    <button class="alert-close">&times;</button>
  `;

  document.body.appendChild(toast);

  toast.querySelector('.alert-close').addEventListener('click', () => {
    toast.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  });

  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.animation = 'slideIn 0.3s ease reverse';
      setTimeout(() => toast.remove(), 300);
    }
  }, 5000);
}

function getToastIcon(type) {
  switch(type) {
    case 'success':
      return '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>';
    case 'error':
      return '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>';
    case 'warning':
      return '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>';
    default:
      return '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>';
  }
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// ========================================
// API Helpers
// ========================================

async function apiRequest(url, options = {}) {
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'same-origin',
  };

  const mergedOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, mergedOptions);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Request failed');
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    showToast(error.message, 'error');
    throw error;
  }
}

// Export for use in other scripts
window.PocketNest = {
  showToast,
  formatCurrency,
  formatDate,
  apiRequest,
  openModal,
  closeModal,
};