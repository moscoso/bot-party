// Provider capabilities (fetched from server) - uses playerList, playerCountEl, addPlayerBtn from dom.js
let providerInfo = {
	openai: { displayName: "GPT", supportsStateful: true },
	anthropic: { displayName: "Claude", supportsStateful: false },
	google: { displayName: "Gemini", supportsStateful: true },
};

function getPlayerTypes() {
	return [
		{ value: "openai", label: `🤖 ${providerInfo.openai?.displayName || "GPT"} (OpenAI)` },
		{ value: "anthropic", label: `🤖 ${providerInfo.anthropic?.displayName || "Claude"} (Anthropic)` },
		{ value: "google", label: `🤖 ${providerInfo.google?.displayName || "Gemini"} (Google)` },
		{ value: "human", label: "👤 Human" },
	];
}

let players = [
	{ type: "openai", mode: "stateless", personality: "neutral" },
	{ type: "anthropic", mode: "stateless", personality: "neutral" },
	{ type: "google", mode: "stateless", personality: "neutral" },
];

const personalities = [
	{ id: "neutral", name: "Balanced", desc: "Standard, no special traits" },
	{ id: "aggressive", name: "Aggressive", desc: "Direct and confrontational" },
	{ id: "quiet", name: "Quiet", desc: "Reserved and observant" },
	{ id: "paranoid", name: "Paranoid", desc: "Suspects everyone" },
	{ id: "comedic", name: "Comedic", desc: "Playful and humorous" },
	{ id: "analytical", name: "Analytical", desc: "Logical and methodical" },
	{ id: "social", name: "Social", desc: "Friendly and trusting" },
];

async function loadProviderInfo() {
	try {
		var res = await fetch("/api/providers");
		if (res.ok) {
			providerInfo = await res.json();
			renderPlayers();
		}
	} catch (e) {
		console.warn("Failed to load provider info, using defaults", e);
	}
}

function updateProviderStatusBanner() {
	var banner = document.getElementById("providerStatusBanner");
	if (!banner) return;
	var configured = [], missing = [];
	for (var type in providerInfo) {
		if (type === "human") continue;
		var info = providerInfo[type];
		if (info && info.configured) configured.push(info.displayName);
		else if (info) missing.push(info.displayName);
	}
	if (missing.length > 0) {
		banner.style.display = "block";
		banner.className = "provider-status-banner warning";
		banner.innerHTML = "<span class=\"banner-icon\">⚠️</span><span class=\"banner-text\"><strong>Missing API Keys:</strong> " + missing.join(", ") + (configured.length > 0 ? "<span class=\"banner-subtext\">Available: " + configured.join(", ") + "</span>" : "") + "</span>";
	} else if (configured.length > 0) {
		banner.style.display = "block";
		banner.className = "provider-status-banner success";
		banner.innerHTML = "<span class=\"banner-icon\">✓</span><span class=\"banner-text\">All providers configured: " + configured.join(", ") + "</span>";
	} else {
		banner.style.display = "none";
	}
}

function supportsStateful(type) {
	return (providerInfo[type] && providerInfo[type].supportsStateful) || false;
}

function isProviderConfigured(type) {
	return (providerInfo[type] && providerInfo[type].configured) || false;
}

function renderPlayers() {
	playerList.innerHTML = "";
	players.forEach((player, index) => {
		var slot = document.createElement("div");
		slot.className = "player-slot";
		var num = document.createElement("span");
		num.className = "player-num";
		num.textContent = (index + 1) + ".";
		var typeSelect = document.createElement("select");
		typeSelect.className = "type-select";
		typeSelect.dataset.index = index;
		getPlayerTypes().forEach(pt => {
			var opt = document.createElement("option");
			opt.value = pt.value;
			if (pt.value !== "human" && !isProviderConfigured(pt.value)) {
				opt.textContent = pt.label + " ⚠️(No API Key)";
				opt.disabled = true;
				opt.style.color = "#666";
			} else {
				opt.textContent = pt.label;
			}
			if (pt.value === player.type) opt.selected = true;
			typeSelect.appendChild(opt);
		});
		typeSelect.addEventListener("change", function (e) {
			var newType = e.target.value;
			if (newType !== "human" && !isProviderConfigured(newType)) {
				alert("Cannot select " + (providerInfo[newType] && providerInfo[newType].displayName || newType) + ": API key not configured. Please add the API key to your .env file.");
				e.target.value = player.type;
				return;
			}
			players[index].type = newType;
			if (!supportsStateful(newType)) players[index].mode = "stateless";
			if (newType === "human") players[index].personality = undefined;
			else if (!players[index].personality) players[index].personality = "neutral";
			renderPlayers();
		});
		var modeSelect = document.createElement("select");
		modeSelect.className = "mode-select";
		var isAI = player.type !== "human";
		var canStateful = supportsStateful(player.type);
		var statelessOpt = document.createElement("option");
		statelessOpt.value = "stateless";
		statelessOpt.textContent = "Stateless";
		if (player.mode === "stateless") statelessOpt.selected = true;
		modeSelect.appendChild(statelessOpt);
		var statefulOpt = document.createElement("option");
		statefulOpt.value = "stateful";
		statefulOpt.textContent = "Stateful";
		if (player.mode === "stateful") statefulOpt.selected = true;
		statefulOpt.disabled = !canStateful;
		modeSelect.appendChild(statefulOpt);
		modeSelect.disabled = !isAI;
		modeSelect.title = !isAI ? "N/A for humans" : (!canStateful ? "Stateful mode not supported by this provider" : "Agent conversation mode");
		modeSelect.addEventListener("change", function (e) { players[index].mode = e.target.value; });
		var personalitySelect = document.createElement("select");
		personalitySelect.className = "personality-select";
		personalities.forEach(p => {
			var opt = document.createElement("option");
			opt.value = p.id;
			opt.textContent = p.name;
			opt.title = p.desc;
			if (player.personality === p.id) opt.selected = true;
			personalitySelect.appendChild(opt);
		});
		personalitySelect.disabled = !isAI;
		personalitySelect.title = !isAI ? "N/A for humans" : "Agent personality";
		personalitySelect.addEventListener("change", function (e) { players[index].personality = e.target.value; });
		var removeBtn = document.createElement("button");
		removeBtn.type = "button";
		removeBtn.className = "remove-btn";
		removeBtn.textContent = "×";
		removeBtn.title = "Remove player";
		removeBtn.addEventListener("click", function () {
			if (players.length > 2) {
				players.splice(index, 1);
				renderPlayers();
			} else {
				alert("Minimum 2 players required.");
			}
		});
		slot.appendChild(num);
		slot.appendChild(typeSelect);
		slot.appendChild(modeSelect);
		slot.appendChild(personalitySelect);
		slot.appendChild(removeBtn);
		playerList.appendChild(slot);
	});

	playerCountEl.textContent = players.length + " player" + (players.length !== 1 ? "s" : "");
}

addPlayerBtn.addEventListener("click", () => {
	if (players.length >= 8) {
		alert("Maximum 8 players.");
		return;
	}
	const aiTypes = ["openai", "anthropic", "google"].filter(type => isProviderConfigured(type));
	if (aiTypes.length === 0) {
		alert("No AI providers configured. Please add API keys to your .env file.");
		return;
	}
	const aiCount = players.filter(p => p.type !== "human").length;
	const nextType = aiTypes[aiCount % aiTypes.length];
	players.push({ type: nextType, mode: "stateless", personality: "neutral" });
	renderPlayers();
});

window.providerInfo = providerInfo;
window.players = players;
window.getPlayerTypes = getPlayerTypes;
window.updateProviderStatusBanner = updateProviderStatusBanner;
window.supportsStateful = supportsStateful;
window.isProviderConfigured = isProviderConfigured;
window.renderPlayers = renderPlayers;
window.loadProviderInfo = loadProviderInfo;
