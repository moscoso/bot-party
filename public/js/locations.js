// Location management - uses locationSelect, locationFileInput, importLocationBtn, exportLocationBtn, locationCountEl from dom.js
async function loadLocations() {
	try {
		const res = await fetch("/api/locations");
		if (res.ok) {
			const locations = await res.json();
			populateLocationSelect(locations);
			updateLocationCount();
		}
	} catch (e) {
		console.warn("Failed to load locations", e);
	}
}

function populateLocationSelect(locations) {
	while (locationSelect.options.length > 1) {
		locationSelect.remove(1);
	}
	locations.forEach(loc => {
		const opt = document.createElement("option");
		opt.value = loc.location;
		opt.textContent = loc.location;
		locationSelect.appendChild(opt);
	});
}

async function updateLocationCount() {
	try {
		const res = await fetch("/api/locations/count");
		if (res.ok) {
			const count = await res.json();
			locationCountEl.textContent = `${count.total} location${count.total !== 1 ? 's' : ''}`;
			if (count.custom > 0) {
				locationCountEl.textContent += ` (${count.custom} custom)`;
			}
		}
	} catch (e) {
		console.warn("Failed to get location count", e);
	}
}

importLocationBtn.addEventListener("click", () => {
	locationFileInput.click();
});

locationFileInput.addEventListener("change", async (e) => {
	const file = e.target.files[0];
	if (!file) return;
	try {
		const text = await file.text();
		const res = await fetch("/api/locations/import", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: text
		});
		if (res.ok) {
			const result = await res.json();
			await loadLocations();
			alert(`Successfully imported locations! Total: ${result.count.total}`);
		} else {
			const error = await res.json();
			alert(`Import failed: ${error.error}`);
		}
	} catch (e) {
		alert(`Import failed: ${e.message}`);
	}
	locationFileInput.value = "";
});

exportLocationBtn.addEventListener("click", async () => {
	try {
		const res = await fetch("/api/locations/export");
		if (res.ok) {
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = "locations.json";
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		}
	} catch (e) {
		alert(`Export failed: ${e.message}`);
	}
});

window.loadLocations = loadLocations;
window.populateLocationSelect = populateLocationSelect;
window.updateLocationCount = updateLocationCount;
