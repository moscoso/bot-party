// Analytics - uses configPanel, gamePanel, analyticsPanel, backBtn from dom.js
async function loadAnalytics() {
	try {
		const res = await fetch("/api/analytics/summary");
		if (!res.ok) {
			console.error("Failed to load analytics");
			return;
		}
		const summary = await res.json();
		displayAnalyticsSummary(summary);
	} catch (e) {
		console.error("Error loading analytics:", e);
	}
}

function displayAnalyticsSummary(summary) {
	document.getElementById("totalGames").textContent = summary.totalGames || 0;
	if (summary.totalGames > 0) {
		const avgMinutes = Math.round(summary.avgGameDuration / 1000 / 60);
		document.getElementById("avgDuration").textContent = `${avgMinutes}m`;
		document.getElementById("avgTurns").textContent = summary.avgTurnsPerGame?.toFixed(1) || "-";
		const spyWins = summary.spyWins || 0;
		const civilianWins = summary.civilianWins || 0;
		const total = spyWins + civilianWins;
		if (total > 0) {
			const spyPct = ((spyWins / total) * 100).toFixed(1);
			const civilianPct = ((civilianWins / total) * 100).toFixed(1);
			document.getElementById("spyWinRate").textContent = `${spyWins} (${spyPct}%)`;
			document.getElementById("civilianWinRate").textContent = `${civilianWins} (${civilianPct}%)`;
		} else {
			document.getElementById("spyWinRate").textContent = "0 (0%)";
			document.getElementById("civilianWinRate").textContent = "0 (0%)";
		}
		const providerStatsEl = document.getElementById("providerStats");
		providerStatsEl.innerHTML = "";
		const providers = Object.entries(summary.providerStats || {}).sort((a, b) => b[1].totalGames - a[1].totalGames);
		providers.forEach(([provider, stats]) => {
			const winRate = stats.gamesPlayed > 0 ? ((stats.wins / stats.gamesPlayed) * 100).toFixed(1) : 0;
			const row = document.createElement("div");
			row.className = "stat-row";
			row.innerHTML = `<span class="stat-label">${provider}</span><span class="stat-value">${stats.wins}/${stats.gamesPlayed} (${winRate}%)</span>`;
			providerStatsEl.appendChild(row);
		});
		const locationStatsEl = document.getElementById("locationStats");
		locationStatsEl.innerHTML = "";
		(summary.locationStats || []).slice(0, 5).forEach((stats) => {
			const row = document.createElement("div");
			row.className = "stat-row";
			row.innerHTML = `<span class="stat-label">${stats.location}</span><span class="stat-value">${stats.gamesPlayed} games</span>`;
			locationStatsEl.appendChild(row);
		});
		loadRecentGames();
	} else {
		document.getElementById("avgDuration").textContent = "-";
		document.getElementById("avgTurns").textContent = "-";
		document.getElementById("spyWinRate").textContent = "-";
		document.getElementById("civilianWinRate").textContent = "-";
		document.getElementById("providerStats").innerHTML = '<div class="stat-row"><span class="stat-label">No games yet</span></div>';
		document.getElementById("locationStats").innerHTML = '<div class="stat-row"><span class="stat-label">No games yet</span></div>';
		document.getElementById("recentGames").innerHTML = '<div style="text-align:center;padding:2rem;color:var(--muted);">No games recorded yet</div>';
	}
}

async function loadRecentGames() {
	try {
		const res = await fetch("/api/analytics/games");
		if (!res.ok) return;
		const games = await res.json();
		const recentGamesEl = document.getElementById("recentGames");
		recentGamesEl.innerHTML = "";
		if (games.length === 0) {
			recentGamesEl.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--muted);">No games recorded yet</div>';
			return;
		}
		games.slice(0, 10).forEach(game => {
			const date = new Date(game.timestamp);
			const dateStr = date.toLocaleDateString() + " " + date.toLocaleTimeString();
			const winner = game.winner === "spy" ? "🕵️ Spy" : game.winner === "civilians" ? "👥 Civilians" : "Draw";
			const duration = Math.round(game.duration / 1000 / 60);
			const item = document.createElement("div");
			item.className = "game-item";
			item.innerHTML = `
				<div class="game-item-header">
					<span class="game-item-id">${game.gameId.substring(0, 8)}</span>
					<span class="game-item-date">${dateStr}</span>
				</div>
				<div class="game-item-details">
					<span>📍 ${game.location}</span>
					<span>🏆 ${winner}</span>
					<span>⏱️ ${duration}m</span>
					<span>🔄 ${game.turns?.length || 0} turns</span>
				</div>
			`;
			recentGamesEl.appendChild(item);
		});
	} catch (e) {
		console.error("Error loading recent games:", e);
	}
}

analyticsBtn.addEventListener("click", () => {
	configPanel.classList.add("hidden");
	gamePanel.classList.remove("active");
	analyticsPanel.style.display = "flex";
	backBtn.style.display = "block";
	backBtn.textContent = "← Back to game";
	backBtn.dataset.fromPanel = "analytics";
	loadAnalytics();
});

window.loadAnalytics = loadAnalytics;
window.displayAnalyticsSummary = displayAnalyticsSummary;
window.loadRecentGames = loadRecentGames;
