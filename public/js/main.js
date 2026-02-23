// SSE and game start - uses configPanel, gamePanel, statusEl, logEl, startBtn, roundsInput, allowEarlyVoteInput, reactionFrequencySelect, locationSelect from dom.js; players, showGame, renderPlayers, loadProviderInfo, loadLocations from other scripts; handleLine, appendDebugEntry, appendGameInfo, appendAgentCreated from log.js; gameState, audioManager, visualBoardRenderer from visual-board.js
(function () {
	var visualViewBtn = document.getElementById("visualViewBtn");
	var logViewBtn = document.getElementById("logViewBtn");
	var visualBoardEl = document.getElementById("visualBoard");
	var pauseBtn = document.getElementById("pauseBtn");
	var speedButtons = document.querySelectorAll(".speed-btn");
	var audioToggleBtn = document.getElementById("audioToggleBtn");
	var volumeSlider = document.getElementById("volumeSlider");

	// SSE connection
	var es = new EventSource("/api/stream");
	es.onopen = function () {
		if (gamePanel.classList.contains("active")) statusEl.textContent = "Connected";
	};
	es.addEventListener("log", function (e) {
		try {
			var data = JSON.parse(e.data);
			if (data.line) handleLine(data.line);
		} catch (_) {}
	});
	es.addEventListener("prompt", function (e) {
		try { appendDebugEntry(JSON.parse(e.data)); } catch (_) {}
	});
	es.addEventListener("gameinfo", function (e) {
		try { appendGameInfo(JSON.parse(e.data)); } catch (_) {}
	});
	es.addEventListener("agentcreated", function (e) {
		try { appendAgentCreated(JSON.parse(e.data)); } catch (_) {}
	});
	es.onerror = function () {
		if (gamePanel.classList.contains("active")) {
			statusEl.textContent = "Reconnecting…";
			statusEl.classList.remove("live");
		}
	};

	// View toggle
	if (visualViewBtn && logViewBtn) {
		visualViewBtn.addEventListener("click", function () {
			visualBoardEl.style.display = "flex";
			logEl.style.display = "none";
			visualViewBtn.classList.add("active");
			logViewBtn.classList.remove("active");
		});
		logViewBtn.addEventListener("click", function () {
			visualBoardEl.style.display = "none";
			logEl.style.display = "block";
			visualViewBtn.classList.remove("active");
			logViewBtn.classList.add("active");
		});
	}

	// Pause/Resume
	if (pauseBtn) {
		pauseBtn.addEventListener("click", function () {
			gameState.paused = !gameState.paused;
			if (gameState.paused) {
				pauseBtn.textContent = "▶️";
				pauseBtn.classList.add("paused");
				pauseBtn.title = "Resume";
				audioManager.stop();
			} else {
				pauseBtn.textContent = "⏸️";
				pauseBtn.classList.remove("paused");
				pauseBtn.title = "Pause";
				gameState.processQueue();
			}
		});
	}

	// Speed
	if (speedButtons && speedButtons.length) {
		for (var i = 0; i < speedButtons.length; i++) {
			speedButtons[i].addEventListener("click", function () {
				var speed = parseFloat(this.dataset.speed);
				gameState.setSpeed(speed);
				audioManager.setRate(speed);
				for (var j = 0; j < speedButtons.length; j++) speedButtons[j].classList.remove("active");
				this.classList.add("active");
			});
		}
	}

	// Audio controls
	if (audioToggleBtn) {
		audioToggleBtn.textContent = "🔊";
		audioToggleBtn.title = "Disable Voice";
		audioToggleBtn.classList.add("active");
		audioToggleBtn.addEventListener("click", function () {
			var enabled = !audioManager.enabled;
			audioManager.setEnabled(enabled);
			if (enabled) {
				audioToggleBtn.textContent = "🔊";
				audioToggleBtn.title = "Disable Voice";
				audioToggleBtn.classList.add("active");
			} else {
				audioToggleBtn.textContent = "🔇";
				audioToggleBtn.title = "Enable Voice";
				audioToggleBtn.classList.remove("active");
			}
		});
	}
	if (volumeSlider) {
		volumeSlider.addEventListener("input", function (e) {
			audioManager.setVolume(parseInt(e.target.value, 10) / 100);
		});
	}

	// Prime audio on first user interaction
	var audioPrimed = false;
	function primeAudio() {
		if (!audioPrimed && audioManager.enabled) {
			audioPrimed = true;
			var silentAudio = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAADhAC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7v////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAA4S/5f4EAAAAAAAAAAAAAAAAAAAAAP/7UEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";
			audioManager.audioElement.src = silentAudio;
			audioManager.audioElement.play().then(function () {
				audioManager.audioElement.pause();
				audioManager.audioElement.currentTime = 0;
				document.removeEventListener("click", primeAudio);
			}).catch(function () {});
		}
	}
	document.addEventListener("click", primeAudio);

	// Start game
	startBtn.addEventListener("click", async function () {
		var aiPlayers = players.filter(function (p) { return p.type !== "human"; });
		var humanPlayers = players.filter(function (p) { return p.type === "human"; });
		if (players.length < 2) { alert("Need at least 2 players."); return; }
		if (humanPlayers.length > 1) { alert("Only one human player is supported."); return; }
		if (aiPlayers.length === 0) { alert("Need at least one AI player."); return; }

		startBtn.disabled = true;
		statusEl.textContent = "Starting…";
		statusEl.classList.add("live");
		currentSection = null;
		currentBody = null;
		logEl.innerHTML = "";
		showGame();

		try {
			var rounds = parseInt(roundsInput.value, 10) || 9;
			var allowEarlyVote = (allowEarlyVoteInput && allowEarlyVoteInput.checked) !== false;
			var reactionFrequency = (reactionFrequencySelect && reactionFrequencySelect.value) || "sometimes";
			var selectedLocation = locationSelect.value;
			var playersParam = players.map(function (p) {
				if (p.type === "human") return "human";
				var personality = (p.personality && p.personality !== "neutral") ? ":" + p.personality : "";
				return p.type + ":" + p.mode + personality;
			}).join(",");
			var params = {
				rounds: String(rounds),
				players: playersParam,
				allowEarlyVote: String(allowEarlyVote),
				reactionFrequency: reactionFrequency
			};
			if (selectedLocation) params.location = selectedLocation;
			var url = "/api/start?" + new URLSearchParams(params);
			var r = await fetch(url, { method: "POST" });
			if (!r.ok) throw new Error(await r.text());
			statusEl.textContent = "Game running — watch below";
		} catch (err) {
			statusEl.textContent = "Error: " + (err && err.message ? err.message : String(err));
			logEl.innerHTML = "";
			logEl.appendChild(document.createTextNode("[Request failed: " + (err && err.message ? err.message : String(err)) + "]"));
		} finally {
			startBtn.disabled = false;
		}
	});

	// Initial load
	renderPlayers();
	loadProviderInfo();
	loadLocations();
})();
