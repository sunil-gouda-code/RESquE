// app.js — Shared site behavior: booking, GPS, donors (localStorage), search/filter, nav
(function () {
  // ====== CONFIG ======
  // Replace with your dispatch WhatsApp number (no + or dashes)
  const DISPATCH_NUMBER = "919999999999"; // <-- CHANGE THIS

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

  // ====== NAV HIGHLIGHT (works on all pages) ======
  function initNavActive() {
    const links = qsa(".nav-links a");
    links.forEach((a) => {
      if (a.href === location.href || a.getAttribute("href") === location.pathname.split("/").pop()) {
        a.classList.add("active");
      } else {
        a.classList.remove("active");
      }
    });
  }

  // ====== BOOKING FORM (index.html or single-page booking) ======
  function initBooking() {
    const form = qs("#resque-form");
    if (!form) return;

    const statusEl = qs("#form-status") || document.createElement("div");
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
            setElementText(statusEl, "Location permission denied or failed. Enter address manually.", true);
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
        showFieldError("phone", "Enter phone with country code (e.g. +91...).");
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
        emergency: qs("#emergencyType") ? qs("#emergencyType").value || "Not specified" : "Not specified",
        time: qs("#pickupTime") ? qs("#pickupTime").value : "ASAP",
        notes: qs("#notes") ? qs("#notes").value.trim() || "None" : "None",
        sentAt: new Date().toLocaleString(),
      };

      const message = [
        "RESQuE Ambulance Booking",
        Patient: ${payload.name},
        Contact: ${payload.phone},
        Pickup: ${payload.pickup},
        Emergency type: ${payload.emergency},
        Pickup time: ${payload.time},
        Notes: ${payload.notes},
        Sent at: ${payload.sentAt},
      ].join("\n");

      const waUrl = https://wa.me/${DISPATCH_NUMBER}?text=${encodeURIComponent(message)};

      setElementText(statusEl, "Opening WhatsApp — press Send to complete the booking.");
      // try to open in new tab; on mobile this opens WhatsApp app
      window.open(waUrl, "_blank", "noopener");
      // For extra compatibility, update hidden link if present
      if (waLink) {
        waLink.href = waUrl;
        // if you wanted to click it programmatically: waLink.click()
      }
    });
  }

  // ====== DONOR REGISTRATION ======
  function getDonors() {
    try {
      const raw = localStorage.getItem(DONOR_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.warn("Failed to parse donors from localStorage", err);
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
    const nameEl = qs("#donorName");
    const phoneEl = qs("#donorPhone");
    const bloodEl = qs("#donorBlood");
    const cityEl = qs("#donorCity");
    const notesEl = qs("#donorNotes");

    function showErr(id, msg) {
      const el = qs(#err-${id});
      if (el) el.textContent = msg || "";
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      // clear errors
      showErr("donorName", "");
      showErr("donorPhone", "");
      showErr("donorBlood", "");
      showErr("donorCity", "");
      setElementText(statusEl, "");

      const name = nameEl.value.trim();
      const phone = phoneEl.value.trim();
      const blood = bloodEl.value;
      const city = cityEl.value.trim();
      const notes = notesEl.value.trim();

      let ok = true;
      if (name.length < 2) {
        showErr("donorName", "Enter your full name.");
        ok = false;
      }
      if (!validPhone(phone)) {
        showErr("donorPhone", "Enter valid phone with country code.");
        ok = false;
      }
      if (!blood) {
        showErr("donorBlood", "Choose your blood group.");
        ok = false;
      }
      if (city.length < 2) {
        showErr("donorCity", "Enter your city/area.");
        ok = false;
      }
      if (!ok) {
        setElementText(statusEl, "Fix errors above to register.", true);
        return;
      }

      // Save donor
      const donors = getDonors();
      const now = new Date().toISOString();
      const record = {
        id: "d_" + Math.random().toString(36).slice(2, 9),
        name,
        phone: normalizePhone(phone),
        blood,
        city,
        notes,
        createdAt: now,
      };
      donors.unshift(record); // newest first
      saveDonors(donors);

      // reset form (keep phone? we clear all)
      form.reset();
      setElementText(statusEl, "Thanks — you are registered as a donor. We appreciate it!");
      // if donors list is visible on same page, refresh it (rare)
      renderDonorList();
    });
  }

  // ====== DONORS PAGE: RENDER + FILTER + SEARCH ======
  function createPhoneLink(phone) {
    // phone should be normalized
    if (!phone) return "#";
    return tel:${phone};
  }

  function donorCardHtml(d) {
    const safeNotes = d.notes ? d.notes : "";
    const phoneDisplay = d.phone.startsWith("+") ? d.phone : d.phone;
    return `
      <div class="donor-card" data-id="${d.id}">
        <div class="donor-row">
          <div class="donor-left">
            <div class="donor-name">${escapeHtml(d.name)}</div>
            <div class="donor-meta">Blood: <strong>${escapeHtml(d.blood)}</strong> • ${escapeHtml(d.city)}</div>
            <div class="donor-notes">${escapeHtml(safeNotes)}</div>
          </div>
          <div class="donor-actions">
            <a class="donor-call" href="${createPhoneLink(d.phone)}" aria-label="Call ${escapeHtml(
      d.name
    )}">Call</a>
            <a class="donor-wa" href="https://wa.me/${d.phone}?text=${encodeURIComponent(
      Hi ${d.name}, I found your contact on RESQuE donor list. Are you available to donate blood?
    )}" target="_blank" rel="noopener">WhatsApp</a>
          </div>
        </div>
      </div>
    `;
  }

  // small HTML-escape function to avoid accidental injection when reading localStorage
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
      container.innerHTML = <div class="empty">No donors registered yet. Ask volunteers to register or add from the <a href="donate-blood.html">Donate Blood</a> page.</div>;
      return;
    }
    container.innerHTML = donors.map(donorCardHtml).join("");
    // Attach event listeners if you need any dynamic behaviour later
  }

  function initDonorFilters() {
    const searchInput = qs("#searchName");
    const bloodFilter = qs("#filterBlood");
    const listContainer = qs("#donorList");
    if (!listContainer) return;

    function applyFilters() {
      const q = (searchInput && searchInput.value.trim().toLowerCase()) || "";
      const bg = (bloodFilter && bloodFilter.value) || "";
      const donors = getDonors();
      const filtered = donors.filter((d) => {
        const matchesName = q ? d.name.toLowerCase().includes(q) : true;
        const matchesBg = bg ? d.blood === bg : true;
        return matchesName && matchesBg;
      });
      if (!filtered.length) {
        listContainer.innerHTML = <div class="empty">No matching donors.</div>;
        return;
      }
      listContainer.innerHTML = filtered.map(donorCardHtml).join("");
    }

    if (searchInput) searchInput.addEventListener("input", applyFilters);
    if (bloodFilter) bloodFilter.addEventListener("change", applyFilters);

    // initial render
    applyFilters();
  }

  // ====== INIT ALL ======
  function init() {
    initNavActive();
    initBooking();
    initDonorForm();
    // donors page features
    renderDonorList();
    initDonorFilters();
    // other minor helpers
    window.addEventListener("storage", () => {
      // if donors updated in other tab, refresh list
      renderDonorList();
    });
  }

  // Run when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
