/* ═══════════════════════════════════════════════════════════════════════════════
   ORBIX STUDIO — PWA Registration, Offline Engine & Install Manager
   ═══════════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var deferredPrompt = null;

  // 1. Register Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js?v=10')
        .then(function (reg) {
          console.log('[PWA] Service Worker registered with scope:', reg.scope);

          // Proactively check for new service worker on every page load
          reg.update();

          reg.addEventListener('updatefound', function () {
            var newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', function () {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('[PWA] New update available. Refreshing for latest version.');
                  window.location.reload();
                }
              });
            }
          });
        })
        .catch(function (err) {
          console.warn('[PWA] Service Worker registration failed:', err);
        });
    });
  }

  // 2. Install Prompt (Chrome, Edge, Android, iOS)
  window.addEventListener('beforeinstallprompt', function (e) {
    // Prevent the mini-infobar from appearing automatically on mobile
    e.preventDefault();
    deferredPrompt = e;

    var installBtn = document.getElementById('pwaInstallBtn');
    if (installBtn) {
      installBtn.hidden = false;
      installBtn.style.display = 'inline-flex';
    }
  });

  window.addEventListener('appinstalled', function () {
    console.log('[PWA] App successfully installed to device!');
    deferredPrompt = null;
    var installBtn = document.getElementById('pwaInstallBtn');
    if (installBtn) {
      installBtn.hidden = true;
      installBtn.style.display = 'none';
    }
  });

  // 3. Setup Install Button Handler & Offline / Online Listeners
  document.addEventListener('DOMContentLoaded', function () {
    var installBtn = document.getElementById('pwaInstallBtn');
    if (installBtn) {
      installBtn.addEventListener('click', function () {
        if (!deferredPrompt) {
          alert('To install Orbix Studio:\n\n• On Chrome/Edge: Click the install icon in your address bar.\n• On iOS Safari: Tap Share -> "Add to Home Screen".');
          return;
        }
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function (choiceResult) {
          if (choiceResult.outcome === 'accepted') {
            console.log('[PWA] User accepted installation');
          } else {
            console.log('[PWA] User dismissed installation');
          }
          deferredPrompt = null;
          installBtn.hidden = true;
          installBtn.style.display = 'none';
        });
      });
    }

    // Network status listener
    function updateOnlineStatus() {
      var dbBadge = document.getElementById('dbStatusBadge');
      if (!dbBadge) return;

      if (!navigator.onLine) {
        dbBadge.className = 'db-badge db-offline';
        dbBadge.innerHTML = '<span class="db-dot" style="background:#F59E0B"></span> Offline CAD Mode';
        dbBadge.title = 'Offline mode active. All 2D/3D edits and projects are safely preserved locally.';
      } else {
        // Online: let orbix-projects update the PostgreSQL status
        if (window.OrbixProjects && typeof window.OrbixProjects.checkDbStatus === 'function') {
          window.OrbixProjects.checkDbStatus();
        }
      }
    }

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();
  });
})();
