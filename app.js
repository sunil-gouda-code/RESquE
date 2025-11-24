// app.js — Shared site behavior: booking, GPS, donors (localStorage), search/filter, nav
(function () {
  // ====== CONFIG ======
  // Your ambulance company WhatsApp number (no + or spaces)
  const DISPATCH_NUMBER = "8310927283";

  // localStorage key for donors
  const DONOR_STORAGE_KEY = "resque_donors_v1";

  // ====== UTILITIES ======
  function qs(selector, root = document) {
    return root.querySelector(selector);
  }
  function qsa(selector, root = document) {
    return Array.from((root || document).querySelectorAll(selector));
  }

  function setElementText(el, text, isError = false) {
    if (!el) return;
    el.textContent = text;
    el.style.color = isError ? "#ff6b6b" : "#b9fbd0";
  }

  function normalizePhone(phone) {
    return phone.replace(/\s+/g, "");
  }

  function validPhone(phone) {
    return /^\+?\d{8,15}$/.test(normalizePhone(phone));
  }

  // Reverse geocode via OpenStreetMap Nominatim
  async function reverseGeocode(lat, lon) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
        lat
      )}&lon=${encodeURIComponent(lon)}`;
      const res = await fetch(url, { headers: { "User-Agent": "RESQuE-site/1.0" } });
      if (!res.ok) throw new Error("Reverse geocode failed");
      const data = await res.json();
      return data.display_name || ${lat}, ${lon};
    } catch (err) {
      console.warn("reverseGeocode error:", err);
      return null;
    }
  }

  // ====== NAV HIGHLIGHT ======
  function initNavActive() {
    const links = qsa(".nav-links a");
    const current = location.pathname.split("/").pop();

    links.forEach((a) => {
      const target = a.getAttribute("href");
      if (target === current) a.classList.add("active");
      else a.classList.remove("active");
    });
  }

  // ====== BOOKING FORM ======
  function initBooking() {
    const form = qs("#resque-form");
    if (!form) return;

    const statusEl = qs("#form-status");
    const useGpsBtn = qs("#use-gps");
    const waLink = qs("#wa-link");

    function showFieldError(id, msg) {
      const el = qs(#err-${id});
      if (el) el.textContent = msg || "";
    }

    // GPS button
    if (useGpsBtn) {
      useGpsBtn.addEventListener("click", () => {
        if (!navigator.geolocation) {
          setElementText(statusEl, "Geolocation not supported by this browser.", true);
          return;
        }
        setElementText(statusEl, "Finding location…");

        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const { latitude, longitude } = pos.coords;
            const address = await reverseGeocode(latitude, longitude);
            if (address) {
              const pickup = qs("#pickup");
              if (pickup) pickup.value = address;
              setElementText(statusEl, "Location found. Confirm address before sending.");
            } else {
              setElementText(statusEl, "Could not determine address — enter manually.", true);
            }
          },
          (err) => {
            console.warn("geolocation error", err);
            setElementText(
              statusEl,
              "Location permission denied or failed. Enter address manually.",
              true
            );
          },
          { timeout: 10000 }
        );
      });
    }

    function validateBooking() {
      let ok = true;
      const name = qs("#patientName").value.trim();
      const phone = qs("#phone").value.trim();
      const pickup = qs("#pickup").value.trim();

      showFieldError("patientName", "");
      showFieldError("phone", "");
      showFieldError("pickup", "");

      if (name.length < 2) {
        showFieldError("patientName", "Enter a valid name.");
        ok = false;
      }
      if (!validPhone(phone)) {
        showFieldError("phone", "Enter valid phone number.");
        ok = false;
      }
      if (pickup.length < 5) {
        showFieldError("pickup", "Enter pickup address.");
        ok = false;
      }
      return ok;
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      setElementText(statusEl, "");

      if (!validateBooking()) {
        setElementText(statusEl, "Fix errors before sending.", true);
        return;
      }

      const payload = {
        name: qs("#patientName").value.trim(),
        phone: qs("#phone").value.trim(),
        pickup: qs("#pickup").value.trim(),
        emergency: qs("#emergencyType") ? qs("#emergencyType").value : "Not specified",
        time: qs("#pickupTime") ? qs("#pickupTime").value : "ASAP",
        notes: qs("#notes") ? qs("#notes").value.trim() || "None" : "None",
        sentAt: new Date().toLocaleString(),
      };

      const message = [
        "RESQuE Ambulance Booking",
        Patient: ${payload.name},
        Contact: ${payload.phone},
        Pickup: ${payload.pickup},
        Emergency: ${payload.emergency},
        Pickup Time: ${payload.time},
        Notes: ${payload.notes},
        Sent At: ${payload.sentAt},
      ].join("\n");

      const waUrl = https://wa.me/${DISPATCH_NUMBER}?text=${encodeURIComponent(message)};

      setElementText(statusEl, "Opening WhatsApp… Press Send to confirm.");
      window.open(waUrl, "_blank", "noopener");

      if (waLink) waLink.href = waUrl;
    });
  }

  // ====== DONOR REGISTRATION ======
  function getDonors() {
    try {
      const raw = localStorage.getItem(DONOR_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.warn("Failed to parse donors", err);
      return [];
    }
  }

  function saveDonors(list) {
    localStorage.setItem(DONOR_STORAGE_KEY, JSON.stringify(list || []));
  }

  function initDonorForm() {
    const form = qs("#donorForm");
    if (!form) return;

    const statusEl = qs("#donor-status");

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const name = qs("#donorName").value.trim();
      const phone = qs("#donorPhone").value.trim();
      const blood = qs("#donorBlood").value;
      const city = qs("#donorCity").value.trim();
      const notes = qs("#donorNotes").value.trim();

      // Reset errors
      ["donorName", "donorPhone", "donorBlood", "donorCity"].forEach((id) => {
        qs(#err-${id}).textContent = "";
      });
      setElementText(statusEl, "");

      let ok = true;

      if (name.length < 2) {
        qs("#err-donorName").textContent = "Enter your full name.";
        ok = false;
      }
      if (!validPhone(phone)) {
        qs("#err-donorPhone").textContent = "Enter valid phone number.";
        ok = false;
      }
      if (!blood) {
        qs("#err-donorBlood").textContent = "Select a blood group.";
        ok = false;
      }
      if (city.length < 2) {
        qs("#err-donorCity").textContent = "Enter your city.";
        ok = false;
      }

      if (!ok) {
        setElementText(statusEl, "Fix errors above to register.", true);
        return;
      }

      const donors = getDonors();
      donors.unshift({
        id: "d_" + Math.random().toString(36).slice(2, 9),
        name,
        phone: normalizePhone(phone),
        blood,
        city,
        notes,
        createdAt: new Date().toISOString(),
      });

      saveDonors(donors);
      form.reset();
      setElementText(statusEl, "Thank you — you are now registered as a donor!");
      renderDonorList();
    });
  }

  // ====== DONOR LIST ======
  function donorCardHtml(d) {
    const notes = d.notes || "";
    return `
      <div class="donor-card" data-id="${d.id}">
        <div class="donor-row">
          <div class="donor-left">
            <div class="donor-name">${escapeHtml(d.name)}</div>
            <div class="donor-meta">
              Blood: <strong>${escapeHtml(d.blood)}</strong> • ${escapeHtml(d.city)}
            </div>
            <div class="donor-notes">${escapeHtml(notes)}</div>
          </div>

          <div class="donor-actions">
            <a class="donor-call" href="tel:${d.phone}">Call</a>
            <a 
              class="donor-wa" 
              target="_blank"
              href="https://wa.me/${d.phone}?text=${encodeURIComponent(
                Hi ${d.name}, I found your contact on RESQuE. Are you available to donate blood?
              )}">
              WhatsApp
            </a>
          </div>
        </div>
      </div>
    `;
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderDonorList() {
    const container = qs("#donorList");
    if (!container) return;

    const donors = getDonors();
    if (!donors.length) {
      container.innerHTML = <div class="empty">No donors available yet.</div>;
      return;
    }

    container.innerHTML = donors.map(donorCardHtml).join("");
  }

  function initDonorFilters() {
    const searchInput = qs("#searchName");
    const bloodFilter = qs("#filterBlood");
    const listContainer = qs("#donorList");

    if (!listContainer) return;

    function applyFilters() {
      const q = (searchInput?.value.trim().toLowerCase()) || "";
      const bg = bloodFilter?.value || "";

      const donors = getDonors();
      const filtered = donors.filter((d) => {
        const matchName = q ? d.name.toLowerCase().includes(q) : true;
        const matchBg = bg ? d.blood === bg : true;
        return matchName && matchBg;
      });

      if (!filtered.length) {
        listContainer.innerHTML = <div class="empty">No matching donors.</div>;
        return;
      }

      listContainer.innerHTML = filtered.map(donorCardHtml).join("");
    }

    if (searchInput) searchInput.addEventListener("input", applyFilters);
    if (bloodFilter) bloodFilter.addEventListener("change", applyFilters);

    applyFilters();
  }

  // ====== INIT ======
  function init() {
    initNavActive();
    initBooking();
    initDonorForm();
    renderDonorList();
    initDonorFilters();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();