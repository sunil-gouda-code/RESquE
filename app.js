(function () {

  const form = document.getElementById("resque-form");
  const status = document.getElementById("form-status");
  const useGpsBtn = document.getElementById("use-gps");

  // ===== SET YOUR DISPATCH WHATSAPP NUMBER HERE =====
  // Example: +91 8123456789  →  "918123456789"
  const DISPATCH_NUMBER = "919999999999"; // <-- CHANGE THIS

  // Show message under the form
  function setStatus(msg, isError = false) {
    status.textContent = msg;
    status.style.color = isError ? "#ff7474" : "#b9fbd0";
  }

  // Show field errors
  function showError(fieldId, msg) {
    document.getElementById("err-" + fieldId).textContent = msg;
  }

  // ============================
  //     GPS BUTTON
  // ============================
  useGpsBtn.addEventListener("click", () => {
    if (!navigator.geolocation) {
      setStatus("Your device doesn't support location.", true);
      return;
    }

    setStatus("Finding your location…");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;

        try {
          // Reverse geocoding → convert GPS to address
          const url = https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude};
          const response = await fetch(url);
          const data = await response.json();

          const address = data.display_name || ${latitude}, ${longitude};

          document.getElementById("pickup").value = address;
          setStatus("Location found. Confirm address before sending.");
        } catch (err) {
          setStatus("Could not detect exact address. Please enter manually.", true);
        }
      },

      () => {
        setStatus("Location permission denied. Type address manually.", true);
      },

      { timeout: 10000 }
    );
  });

  // ============================
  //     VALIDATION
  // ============================
  function validate() {
    let ok = true;

    showError("patientName", "");
    showError("phone", "");
    showError("pickup", "");

    const name = form.patientName.value.trim();
    const phone = form.phone.value.trim();
    const pickup = form.pickup.value.trim();

    if (name.length < 2) {
      showError("patientName", "Enter a valid name.");
      ok = false;
    }

    const phoneNorm = phone.replace(/\s+/g, "");
    if (!/^\+?\d{8,15}$/.test(phoneNorm)) {
      showError("phone", "Enter valid phone number with country code.");
      ok = false;
    }

    if (pickup.length < 5) {
      showError("pickup", "Pickup location is required.");
      ok = false;
    }

    return ok;
  }

  // ============================
  //     FORM SUBMIT → WHATSAPP
  // ============================
  form.addEventListener("submit", function (e) {
    e.preventDefault();

    setStatus("");

    if (!validate()) {
      setStatus("Fix errors before sending.", true);
      return;
    }

    const data = {
      name: form.patientName.value.trim(),
      phone: form.phone.value.trim(),
      pickup: form.pickup.value.trim(),
      emergency: form.emergencyType.value || "Not specified",
      time: form.pickupTime.value,
      notes: form.notes.value.trim() || "None",
      sentAt: new Date().toLocaleString()
    };

    const message = `
RESQuE Ambulance Booking
Patient: ${data.name}
Contact: ${data.phone}
Pickup: ${data.pickup}
Emergency: ${data.emergency}
Pickup Time: ${data.time}
Notes: ${data.notes}
Sent at: ${data.sentAt}
    `;

    const waUrl = https://wa.me/${DISPATCH_NUMBER}?text=${encodeURIComponent(message)};

    setStatus("Opening WhatsApp… press Send to complete booking.");

    window.open(waUrl, "_blank", "noopener");
  });

})();
