// Log section handling - uses logEl from dom.js; gameState, visualBoardRenderer from visual-board.js
var currentSection = null;
var currentBody = null;

function sectionTitleFor(line) {
	const roundMatch = line.match(/\[Round (\d+)\]/);
	if (roundMatch) return "Round " + roundMatch[1];
	if (line.includes("VOTING PHASE")) return "Voting";
	if (line.includes("VERDICT")) return "Verdict";
	if (line.includes("attempts a final guess")) return "Spy's guess";
	if (line.includes("ACTUAL LOCATION")) return "Final score";
	return null;
}

function startSection(title, firstLine) {
	const details = document.createElement("details");
	details.className = "log-section";
	details.open = true;
	const summary = document.createElement("summary");
	summary.textContent = title;
	const body = document.createElement("div");
	body.className = "section-body";
	if (firstLine) body.appendChild(document.createTextNode(firstLine + "\n"));
	details.appendChild(summary);
	details.appendChild(body);
	logEl.appendChild(details);
	currentSection = details;
	currentBody = body;
}

function isNearBottom(el) {
	return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
}
function maybeScrollToBottom() {
	if (isNearBottom(logEl)) logEl.scrollTop = logEl.scrollHeight;
}

function appendLine(line) {
	if (!currentBody) startSection("Intro", line);
	else currentBody.appendChild(document.createTextNode(line + "\n"));
	maybeScrollToBottom();
}

function appendDebugEntry(entry) {
	if (!currentBody) startSection("Intro", null);
	const phase = entry.phase.charAt(0).toUpperCase() + entry.phase.slice(1);
	const providerLabel = entry.provider === "openai" ? "OpenAI" : entry.provider === "anthropic" ? "Anthropic" : entry.provider === "google" ? "Google" : entry.provider || "";

	if (entry.kind === "sent") {
		const details = document.createElement("details");
		details.className = "inspect-inline";
		details.setAttribute("data-prompt-id", entry.id);
		const summary = document.createElement("summary");
		summary.textContent = "📋 " + phase + " (" + entry.agentName + " via " + providerLabel + ") — prompt & response";
		details.appendChild(summary);

		const promptBlock = document.createElement("div");
		promptBlock.className = "debug-block";
		const promptLabel = document.createElement("div");
		promptLabel.className = "debug-label";
		promptLabel.textContent = "Prompt (messages sent)";
		promptBlock.appendChild(promptLabel);
		const promptPre = document.createElement("pre");
		promptPre.textContent = (entry.messages || []).map(m => "[" + m.role + "]\n" + m.content).join("\n\n");
		promptBlock.appendChild(promptPre);
		details.appendChild(promptBlock);

		const responseBlock = document.createElement("div");
		responseBlock.className = "debug-block";
		responseBlock.setAttribute("data-response-block", "true");
		const responseLabel = document.createElement("div");
		responseLabel.className = "debug-label";
		responseLabel.textContent = "Response";
		responseBlock.appendChild(responseLabel);
		const responsePre = document.createElement("pre");
		responsePre.className = "response-content";
		responsePre.innerHTML = '<span style="color:var(--muted);animation:pulse 1.5s ease-in-out infinite;">⏳ Waiting for response...</span>';
		responseBlock.appendChild(responsePre);
		details.appendChild(responseBlock);

		currentBody.appendChild(details);
	} else {
		const panel = document.querySelector('[data-prompt-id="' + entry.id + '"]');
		if (panel) {
			const responsePre = panel.querySelector('.response-content');
			if (responsePre) responsePre.textContent = entry.response || "(empty)";
		}
	}
	maybeScrollToBottom();
}

function handleLine(line) {
	const title = sectionTitleFor(line);
	if (title) startSection(title, line);
	else appendLine(line);

	if (typeof gameState !== "undefined" && typeof visualBoardRenderer !== "undefined") {
		const event = gameState.handleLogLine(line);
		if (event) gameState.queueEvent(event);
	}
}

function appendAgentCreated(entry) {
	if (!currentBody) startSection("Intro", null);
	const providerLabel = entry.provider === "openai" ? "OpenAI" : entry.provider === "anthropic" ? "Anthropic" : entry.provider === "google" ? "Google" : entry.provider;
	const details = document.createElement("details");
	details.className = "inspect-inline";
	const summary = document.createElement("summary");
	summary.textContent = "🤖 Agent Created: " + entry.agentName + " (" + providerLabel + ", " + entry.mode + " mode)";
	details.appendChild(summary);

	const block = document.createElement("div");
	block.className = "debug-block";
	const label = document.createElement("div");
	label.className = "debug-label";
	label.textContent = "System Prompt";
	block.appendChild(label);
	const pre = document.createElement("pre");
	pre.textContent = entry.systemPrompt;
	block.appendChild(pre);
	details.appendChild(block);
	currentBody.appendChild(details);
	maybeScrollToBottom();
}

function appendGameInfo(info) {
	if (!currentBody) startSection("Intro", null);
	const details = document.createElement("details");
	details.className = "inspect-inline";
	const summary = document.createElement("summary");
	summary.textContent = "🎮 Game Setup — location, roles, spy (spoilers!)";
	details.appendChild(summary);

	const block = document.createElement("div");
	block.className = "debug-block";
	const pre = document.createElement("pre");

	let text = "📍 LOCATION: " + info.location + "\n\n";
	text += "👥 PLAYERS:\n";
	info.players.forEach(p => {
		const marker = p.isSpy ? "🕵️ SPY" : p.role;
		text += "  • " + p.name + ": " + marker + "\n";
	});
	text += "\n📋 ROLES AT THIS LOCATION:\n  " + info.roles.join(", ") + "\n";
	text += "\n🗺️ ALL POSSIBLE LOCATIONS:\n  " + info.allLocations.join(", ") + "\n";
	text += "\n⚙️ CONFIG:\n";
	text += "  • Players: " + info.players.length + "\n";
	text += "  • Rounds: " + info.config.rounds;
	if (info.config.playerSlots) {
		text += "\n  • Slots: " + info.config.playerSlots.map(s =>
			s.type === "human" ? "human" : s.type + ":" + s.mode
		).join(", ");
	}

	pre.textContent = text;
	block.appendChild(pre);
	details.appendChild(block);
	currentBody.appendChild(details);
	maybeScrollToBottom();

	if (typeof gameState !== "undefined" && typeof visualBoardRenderer !== "undefined") {
		gameState.handleGameInfo(info);
		visualBoardRenderer.initialize();
	}
}

window.handleLine = handleLine;
window.appendDebugEntry = appendDebugEntry;
window.appendAgentCreated = appendAgentCreated;
window.appendGameInfo = appendGameInfo;
