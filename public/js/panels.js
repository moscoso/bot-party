// Panel visibility - uses configPanel, gamePanel, analyticsPanel, backBtn, statusEl from dom.js
function showConfig() {
	configPanel.classList.remove("hidden");
	gamePanel.classList.remove("active");
	analyticsPanel.style.display = "none";
	backBtn.style.display = "none";
	backBtn.dataset.fromPanel = "";
	statusEl.textContent = "Ready";
	statusEl.classList.remove("live");
}

function showGame() {
	configPanel.classList.add("hidden");
	analyticsPanel.style.display = "none";
	gamePanel.classList.add("active");
	backBtn.style.display = "inline-block";
	backBtn.textContent = "← New Game";
	backBtn.dataset.fromPanel = "game";
}

backBtn.addEventListener("click", () => {
	if (backBtn.dataset.fromPanel === "analytics") {
		showGame();
	} else {
		showConfig();
	}
});

window.showConfig = showConfig;
window.showGame = showGame;
