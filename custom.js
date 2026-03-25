/**
 * enhancements.js — Additive professional frontend improvements
 * Loaded AFTER all existing scripts. Zero modifications to original code.
 */
(function () {
  'use strict';

  /* ================================================================
     1. ESCAPE KEY → Close open dialogs and chat dock
     ================================================================ */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;

    // Close any open dialog overlay
    const openDialog = document.querySelector('.dialog-overlay.open');
    if (openDialog) {
      openDialog.classList.remove('open');
      restoreFocus(openDialog);
      return;
    }

    // Close chat dock
    const chatDock = document.getElementById('chat-dock');
    if (chatDock && chatDock.classList.contains('open')) {
      if (typeof closeChat === 'function') closeChat();
      return;
    }
  });

  /* ================================================================
     2. CLICK BACKDROP → Close dialogs when clicking the dark overlay
     ================================================================ */
  document.querySelectorAll('.dialog-overlay').forEach(function (overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        overlay.classList.remove('open');
        restoreFocus(overlay);
      }
    });
  });

  /* ================================================================
     3. FOCUS TRAP inside open dialogs (WCAG 2.1 AA)
     ================================================================ */
  const FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  // Store element that triggered dialog open so we can restore
  const _focusSources = new WeakMap();

  // Intercept existing openDialog calls by observing class changes
  const dialogObserver = new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      if (m.type !== 'attributes' || m.attributeName !== 'class') return;
      const el = m.target;
      if (!el.classList.contains('dialog-overlay')) return;

      if (el.classList.contains('open')) {
        // Opened — store focused element and move focus into dialog
        _focusSources.set(el, document.activeElement);
        const first = el.querySelector(FOCUSABLE);
        if (first) setTimeout(function () { first.focus(); }, 30);
      }
    });
  });

  document.querySelectorAll('.dialog-overlay').forEach(function (overlay) {
    dialogObserver.observe(overlay, { attributes: true });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    const openDialog = document.querySelector('.dialog-overlay.open');
    if (!openDialog) return;

    const focusable = Array.from(openDialog.querySelectorAll(FOCUSABLE)).filter(
      function (el) { return !el.closest('[style*="display:none"]') && !el.closest('[style*="display: none"]'); }
    );
    if (!focusable.length) return;

    const first = focusable[0];
    const last  = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
    }
  });

  function restoreFocus(dialog) {
    const src = _focusSources.get(dialog);
    if (src && typeof src.focus === 'function') src.focus();
  }

  /* ================================================================
     4. KEYBOARD SHORTCUT — Alt+A toggles AI chat dock
     ================================================================ */
  document.addEventListener('keydown', function (e) {
    if (e.altKey && (e.key === 'a' || e.key === 'A')) {
      e.preventDefault();
      if (typeof openChat === 'function' && typeof closeChat === 'function') {
        const dock = document.getElementById('chat-dock');
        if (dock && dock.classList.contains('open')) {
          closeChat();
        } else {
          openChat();
        }
      }
    }
  });

  // Append shortcut badge to AI launcher button
  document.addEventListener('DOMContentLoaded', function () {
    const btn = document.getElementById('ai-launcher-btn');
    if (btn) {
      const badge = document.createElement('span');
      badge.className = 'ai-launcher-shortcut';
      badge.textContent = 'Alt+A';
      badge.setAttribute('aria-hidden', 'true');
      btn.appendChild(badge);
    }
  });

  /* ================================================================
     5. SORTABLE TABLES — Click th to sort any .table-wrap table
     ================================================================ */
  function enableTableSorting() {
    document.querySelectorAll('.table-wrap table').forEach(function (table) {
      const ths = table.querySelectorAll('thead th');
      ths.forEach(function (th, colIdx) {
        if (th.textContent.trim() === '') return; // skip empty th
        th.classList.add('sortable');
        th.setAttribute('title', 'Click to sort');
        th.setAttribute('role', 'button');
        th.setAttribute('tabindex', '0');

        let dir = 0; // 0=unsorted, 1=asc, -1=desc

        function doSort() {
          // Update sort direction
          ths.forEach(function (t) {
            t.classList.remove('sort-asc', 'sort-desc');
          });
          dir = dir === 1 ? -1 : 1;
          th.classList.add(dir === 1 ? 'sort-asc' : 'sort-desc');

          const tbody = table.querySelector('tbody');
          if (!tbody) return;

          const rows = Array.from(tbody.querySelectorAll('tr'));
          rows.sort(function (a, b) {
            const aCell = a.querySelectorAll('td')[colIdx];
            const bCell = b.querySelectorAll('td')[colIdx];
            if (!aCell || !bCell) return 0;

            // Use data-date-iso if present for proper date sort
            const aISO = aCell.querySelector('[data-date-iso]');
            const bISO = bCell.querySelector('[data-date-iso]');
            const aVal = aISO ? aISO.dataset.dateIso : aCell.textContent.trim();
            const bVal = bISO ? bISO.dataset.dateIso : bCell.textContent.trim();

            // Numeric sort if both look like numbers (strip currency symbols)
            const aNum = parseFloat(aVal.replace(/[^0-9.\-]/g, ''));
            const bNum = parseFloat(bVal.replace(/[^0-9.\-]/g, ''));
            if (!isNaN(aNum) && !isNaN(bNum)) {
              return (aNum - bNum) * dir;
            }

            return aVal.localeCompare(bVal) * dir;
          });

          rows.forEach(function (row) { tbody.appendChild(row); });
        }

        th.addEventListener('click', doSort);
        th.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); doSort(); }
        });
      });
    });
  }

  // Call after DOM ready (tables are rendered at load time)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enableTableSorting);
  } else {
    enableTableSorting();
  }

  /* ================================================================
     6. RELATIVE TIMESTAMPS — Show "Xh ago" next to date cells
     ================================================================ */
  function pluralize(n, unit) {
    return n + ' ' + unit + (n === 1 ? '' : 's') + ' ago';
  }

  function toRelativeTime(isoString) {
    const then = new Date(isoString);
    if (isNaN(then)) return null;
    const nowMs = Date.now();
    const diffMs = nowMs - then.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60)   return 'just now';
    if (diffSec < 3600) return pluralize(Math.floor(diffSec / 60),   'min');
    const diffH = Math.floor(diffSec / 3600);
    if (diffH   < 24)   return pluralize(diffH,                       'hr');
    const diffD = Math.floor(diffH / 24);
    if (diffD   < 30)   return pluralize(diffD,                       'day');
    const diffMo = Math.floor(diffD / 30);
    if (diffMo  < 12)   return pluralize(diffMo,                      'mo');
    return pluralize(Math.floor(diffMo / 12), 'yr');
  }

  function renderRelTimestamps() {
    document.querySelectorAll('[data-date-iso]').forEach(function (el) {
      // Skip if already has a .rel-time sibling
      if (el.querySelector('.rel-time') || el.nextElementSibling && el.nextElementSibling.classList.contains('rel-time')) return;
      const rel = toRelativeTime(el.dataset.dateIso);
      if (!rel) return;
      const span = document.createElement('span');
      span.className = 'rel-time';
      span.textContent = '(' + rel + ')';
      span.setAttribute('aria-label', rel);
      el.insertAdjacentElement('afterend', span);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderRelTimestamps);
  } else {
    renderRelTimestamps();
  }

  // Refresh relative times every 60 seconds
  setInterval(function () {
    document.querySelectorAll('.rel-time').forEach(function (s) { s.remove(); });
    renderRelTimestamps();
  }, 60000);

  /* ================================================================
     7. KPI COUNTER ANIMATION — Numbers count up from 0 on load
     ================================================================ */
  function animateCounter(el, target, duration) {
    const start     = performance.now();
    const isFloat   = target.toString().includes('.');
    const isPercent = el.textContent.includes('%');

    function tick(now) {
      const elapsed  = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = target * eased;

      if (isPercent) {
        el.textContent = (isFloat ? current.toFixed(2) : Math.round(current)) + '%';
      } else if (target >= 1000) {
        el.textContent = Math.round(current).toLocaleString();
      } else {
        el.textContent = isFloat ? current.toFixed(2) : Math.round(current);
      }

      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function initKPICounters() {
    document.querySelectorAll('.kpi-value').forEach(function (el) {
      const raw = el.textContent.trim();
      // Strip formatting: remove commas, currency symbols
      const numStr = raw.replace(/[,\s€$£¥]/g, '').replace('%', '');
      const num    = parseFloat(numStr);
      if (isNaN(num) || num === 0) return;

      // Keep track so we don't re-animate
      if (el.dataset.animated) return;
      el.dataset.animated = '1';

      animateCounter(el, num, 900);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initKPICounters);
  } else {
    setTimeout(initKPICounters, 100); // slight delay so chart.js also runs
  }

  /* ================================================================
     8. DEBOUNCED CRM SEARCH — Reduces input jitter on fast typing
     ================================================================ */
  function debounce(fn, ms) {
    let timer;
    return function () {
      const ctx  = this;
      const args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }

  document.addEventListener('DOMContentLoaded', function () {
    const crmInput = document.getElementById('crm-search-input');
    if (!crmInput) return;

    // Wrap existing input handler with debounce
    const debouncedSearch = debounce(function () {
      if (typeof crmSearch === 'function') crmSearch();
    }, 300);

    crmInput.addEventListener('input', debouncedSearch);
    // Keep direct Enter key for immediate search
    crmInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && typeof crmSearch === 'function') {
        e.preventDefault();
        crmSearch();
      }
    });
  });

  /* ================================================================
     9. MARK CHARTS READY — Remove shimmer once Chart.js paints
     ================================================================ */
  document.addEventListener('DOMContentLoaded', function () {
    // Poll for canvas elements that have been drawn by Chart.js
    function markChartsReady() {
      document.querySelectorAll('.chart-ph canvas').forEach(function (canvas) {
        const ph = canvas.closest('.chart-ph');
        if (!ph) return;
        // A drawn chart canvas has width > 0
        if (canvas.width > 0) {
          ph.classList.add('chart-ready');
        }
      });
    }

    // Also mark SVG-based charts (funnel chart)
    document.querySelectorAll('.chart-ph svg').forEach(function (svg) {
      const ph = svg.closest('.chart-ph');
      if (ph) ph.classList.add('chart-ready');
    });

    // Poll 5 times over 2 seconds
    let polls = 0;
    const pollInterval = setInterval(function () {
      markChartsReady();
      if (++polls >= 10) clearInterval(pollInterval);
    }, 250);
  });

  /* ================================================================
     10. MONO OVERFLOW TOOLTIP — Add title on truncated .mono cells
     ================================================================ */
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('td.mono').forEach(function (td) {
      if (td.scrollWidth > td.clientWidth) {
        td.setAttribute('title', td.textContent.trim());
      }
    });
  });

  /* ================================================================
     11. BTN LOADING STATE — For Apply / Fetch buttons (UX demo)
        Removes loading class after 600ms to simulate async.
     ================================================================ */
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.filter-bar .btn-primary').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.classList.contains('loading')) return;
        btn.classList.add('loading');
        setTimeout(function () {
          btn.classList.remove('loading');
        }, 600);
      });
    });
  });

})();
