// ==================== Visual Game Board ====================

// Audio Manager for Text-to-Speech using ElevenLabs
class AudioManager {
	constructor() {
		this.audioQueue = [];
		this.speaking = false;
		this.enabled = true;
		this.volume = 0.8;
		this.voiceMap = new Map(); // player name -> ElevenLabs voice ID
		this.audioCache = new Map(); // Cache for audio blobs
		this.maxCacheSize = 100;
		this.currentBlobUrl = null;
		
		// Create a single reusable Audio element to maintain user gesture context
		this.audioElement = new Audio();
		this.audioElement.volume = this.volume;
		
		// ElevenLabs voice IDs for variety
		this.availableVoices = [
			{ id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel' },
			{ id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam' },
			{ id: 'ErXwobaYiN019PkySvjV', name: 'Antoni' },
			{ id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli' },
			{ id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh' },
			{ id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold' },
			{ id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella' },
			{ id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi' }
		];
	}
	
	assignVoiceToPlayer(playerName, voiceIndex = null) {
		if (this.availableVoices.length === 0) return;
		
		let voice;
		if (voiceIndex !== null && this.availableVoices[voiceIndex]) {
			voice = this.availableVoices[voiceIndex];
		} else {
			// Assign different voice based on player index
			const playerCount = this.voiceMap.size;
			voice = this.availableVoices[playerCount % this.availableVoices.length];
		}
		
		this.voiceMap.set(playerName, voice.id);
		console.log(`🎤 Assigned voice "${voice.name}" (${voice.id}) to player "${playerName}"`);
	}
	
	setEnabled(enabled) {
		this.enabled = enabled;
		console.log(enabled ? '🔊 Audio enabled' : '🔇 Audio disabled');
		if (!enabled) {
			this.stop();
		} else {
			// Prime the audio element with user gesture by loading a tiny silent audio
			// This establishes the user interaction context for future playback
			const silentAudio = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAADhAC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7v////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAA4S/5f4EAAAAAAAAAAAAAAAAAAAAAP/7UEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
			this.audioElement.src = silentAudio;
			this.audioElement.play().then(() => {
				this.audioElement.pause();
				this.audioElement.currentTime = 0;
				console.log('✅ Audio element primed with user gesture');
			}).catch((err) => {
				console.log('ℹ️ Audio element will be primed on first play:', err.message);
			});
		}
	}
	
	setVolume(volume) {
		this.volume = Math.max(0, Math.min(1, volume));
		if (this.audioElement) {
			this.audioElement.volume = this.volume;
		}
	}
	
	setRate(rate) {
		// Note: ElevenLabs doesn't support playback rate changes directly
		// This would require preprocessing or accepting the limitation
		// For now, we'll just store it but not use it
		this.rate = rate;
	}
	
	getCacheKey(text, voiceId) {
		return `${voiceId}:${text}`;
	}
	
	manageCache() {
		// Simple LRU: remove oldest entries if cache is too large
		if (this.audioCache.size > this.maxCacheSize) {
			const firstKey = this.audioCache.keys().next().value;
			this.audioCache.delete(firstKey);
		}
	}
	
	async fetchAudio(text, voiceId) {
		const cacheKey = this.getCacheKey(text, voiceId);
		
		// Check cache first
		if (this.audioCache.has(cacheKey)) {
			console.log('🎵 Using cached audio for:', text.substring(0, 50));
			return this.audioCache.get(cacheKey);
		}
		
		try {
			console.log('🎵 Fetching TTS audio for:', text.substring(0, 50));
			const response = await fetch('/api/tts', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ text, voiceId })
			});
			
			if (!response.ok) {
				const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
				console.error('❌ TTS API error:', errorData);
				throw new Error(`TTS API error: ${response.status} - ${errorData.error || 'Unknown error'}`);
			}
			
			const audioBlob = await response.blob();
			console.log('✅ Audio fetched successfully, size:', audioBlob.size, 'bytes');
			
			// Cache the audio
			this.audioCache.set(cacheKey, audioBlob);
			this.manageCache();
			
			return audioBlob;
		} catch (error) {
			console.error('❌ Error fetching TTS audio:', error);
			throw error;
		}
	}
	
	speak(text, playerName) {
		if (!this.enabled || !text) {
			return Promise.resolve(); // Return resolved promise if disabled
		}
		
		return new Promise((resolve) => {
			// Add timeout to ensure game never hangs (max 30 seconds per audio)
			const timeout = setTimeout(() => {
				console.warn('⏱️ Audio timeout, continuing game...');
				resolve();
			}, 30000);
			
			const wrappedResolve = () => {
				clearTimeout(timeout);
				resolve();
			};
			
			// Add to queue with wrapped resolve callback
			this.audioQueue.push({ text, playerName, resolve: wrappedResolve });
			
			// Process queue if not already speaking
			if (!this.speaking) {
				this.processQueue();
			}
		});
	}
	
	async processQueue() {
		if (this.speaking || this.audioQueue.length === 0) return;
		
		this.speaking = true;
		const { text, playerName, resolve } = this.audioQueue.shift();
		
		let cleaned = false;
		const cleanupAndContinue = () => {
			if (cleaned) return;
			cleaned = true;
			
			// Clean up the blob URL if exists
			if (this.currentBlobUrl) {
				URL.revokeObjectURL(this.currentBlobUrl);
				this.currentBlobUrl = null;
			}
			
			this.speaking = false;
			resolve();
			
			// Process next in queue with a small delay
			if (this.audioQueue.length > 0) {
				setTimeout(() => this.processQueue(), 50);
			}
		};
		
		try {
			// Get voice ID for player
			const voiceId = this.voiceMap.get(playerName) || this.availableVoices[0].id;
			
			// Fetch audio from backend
			const audioBlob = await this.fetchAudio(text, voiceId);
			const audioUrl = URL.createObjectURL(audioBlob);
			this.currentBlobUrl = audioUrl;
			
			// Remove any existing event listeners to prevent duplicates
			const audio = this.audioElement;
			audio.onended = null;
			audio.onerror = null;
			
			// Set up event handlers
			audio.onended = () => {
				cleanupAndContinue();
			};
			
			audio.onerror = (event) => {
				console.error('❌ Audio error event fired:', event, audio.error);
				cleanupAndContinue();
			};
			
			// Update the audio source and play
			audio.src = audioUrl;
			audio.volume = this.volume;
			
			try {
				await audio.play();
			} catch (playError) {
				console.warn('⚠️ Audio play failed (likely user gesture policy):', playError.message);
				// Still continue - the game shouldn't hang because of audio issues
				cleanupAndContinue();
			}
		} catch (error) {
			console.error('❌ Error in audio processing:', error);
			cleanupAndContinue();
		}
	}
	
	stop() {
		console.log('🛑 Stopping audio, clearing queue');
		
		// Stop current audio
		if (this.audioElement) {
			this.audioElement.pause();
			this.audioElement.currentTime = 0;
			this.audioElement.onended = null;
			this.audioElement.onerror = null;
		}
		
		// Clean up blob URL
		if (this.currentBlobUrl) {
			URL.revokeObjectURL(this.currentBlobUrl);
			this.currentBlobUrl = null;
		}
		
		// Resolve all pending promises in the queue
		const queueSize = this.audioQueue.length;
		this.audioQueue.forEach(item => {
			if (item.resolve) item.resolve();
		});
		this.audioQueue = [];
		this.speaking = false;
		
		if (queueSize > 0) {
			console.log(`🛑 Cleared ${queueSize} items from queue`);
		}
	}
	
	getAvailableVoices() {
		return this.availableVoices.filter(v => v.lang.startsWith('en-'));
	}
}

// Game State Manager
class GameStateManager {
	constructor() {
		this.reset();
		this.eventQueue = [];
		this.processing = false;
		this.paused = false;
		this.speed = 1; // 1x speed
		this.baseDelay = 1500; // Base delay in ms between events
	}

	reset() {
		this.players = [];
		this.currentRound = 0;
		this.totalRounds = 0;
		this.currentAsker = null;
		this.currentTarget = null;
		this.phase = 'setup';
		this.location = '???';
		this.currentQuestion = null;
		this.currentAnswer = null;
		this.isHumanPlayer = false;
		this.spyGuess = null;
		this.eventQueue = [];
		this.processing = false;
	}

	setSpeed(speed) {
		this.speed = speed;
	}

	setPaused(paused) {
		this.paused = paused;
		if (!paused && !this.processing) {
			this.processQueue();
		}
	}

	queueEvent(event) {
		if (event) {
			this.eventQueue.push(event);
			if (!this.processing && !this.paused) {
				this.processQueue();
			}
		}
	}

	async processQueue() {
		if (this.processing || this.paused || this.eventQueue.length === 0) {
			return;
		}

		this.processing = true;
		
		while (this.eventQueue.length > 0 && !this.paused) {
			const event = this.eventQueue.shift();
			await visualBoardRenderer.handleEvent(event);
			
			// Delay between events based on speed
			const delay = this.baseDelay / this.speed;
			await new Promise(resolve => setTimeout(resolve, delay));
		}
		
		this.processing = false;
	}

	handleGameInfo(data) {
		this.players = data.players.map((p, idx) => ({
			id: idx,
			name: p.name,
			role: p.role,
			isSpy: p.isSpy,
			isHuman: p.name === 'You',
			eliminated: false,
			suspected: false,
			votes: 0,
			avatar: this.getPlayerAvatar(p.name),
			color: this.getPlayerColor(idx)
		}));
		this.totalRounds = data.config.rounds || 9;
		this.location = data.players.find(p => p.name === 'You')?.role || '???';
		this.isHumanPlayer = data.players.some(p => p.name === 'You');
		this.phase = 'questions';
		this.actualLocation = null;
		this.accusedPlayer = null;
		this.spyPlayer = null;
		this.winner = null;
	}

	handleLogLine(line) {
		// Trim the line to remove leading/trailing whitespace (including newlines)
		const trimmedLine = line.trim();
		
		// Parse different line patterns
		const turnMatch = trimmedLine.match(/^([\w-]+) ➔ ([\w-]+)$/);
		if (turnMatch) {
			this.currentAsker = this.findPlayerByName(turnMatch[1]);
			this.currentTarget = this.findPlayerByName(turnMatch[2]);
			return { type: 'turn', asker: this.currentAsker, target: this.currentTarget };
		}

		const questionMatch = trimmedLine.match(/^Q: (.+)$/);
		if (questionMatch) {
			this.currentQuestion = questionMatch[1];
			return { type: 'question', text: this.currentQuestion, asker: this.currentAsker, target: this.currentTarget };
		}

		const answerMatch = trimmedLine.match(/^A: (.+)$/);
		if (answerMatch) {
			this.currentAnswer = answerMatch[1];
			return { type: 'answer', text: this.currentAnswer, target: this.currentTarget };
		}

		const roundMatch = trimmedLine.match(/^\[Round (\d+)\]$/);
		if (roundMatch) {
			this.currentRound = parseInt(roundMatch[1]);
			this.currentQuestion = null;
			this.currentAnswer = null;
			return { type: 'round', round: this.currentRound };
		}

		if (trimmedLine.includes('VOTING PHASE')) {
			this.phase = 'voting';
			// Reset vote counts
			this.players.forEach(p => p.votes = 0);
			return { type: 'phase', phase: 'voting' };
		}

		// Parse votes: "PlayerName voted for: TargetName (reason)"
		const voteMatch = trimmedLine.match(/^([\w-]+) voted for: ([\w-]+)(.*)$/);
		if (voteMatch) {
			const voter = this.findPlayerByName(voteMatch[1]);
			const target = this.findPlayerByName(voteMatch[2]);
			const reason = voteMatch[3].trim(); // Capture the reason if present
			if (target) {
				target.votes = (target.votes || 0) + 1;
			}
			return { type: 'vote', voter, target, reason, line: trimmedLine };
		}

		// Parse verdict: "⚖️ VERDICT: The group accuses PlayerName!"
		const verdictMatch = trimmedLine.match(/VERDICT: (?:A tie|The group accuses ([\w-]+)!)/);
		if (verdictMatch) {
			this.phase = 'verdict';
			this.accusedPlayer = verdictMatch[1] ? this.findPlayerByName(verdictMatch[1]) : null;
			return { type: 'verdict', accused: this.accusedPlayer, line: trimmedLine };
		}

		// Parse spy reveal: "🕵️ REVEAL: The Spy was indeed PlayerName!"
		const revealMatch = trimmedLine.match(/REVEAL: The Spy was (?:indeed )?([\w-]+)!/);
		if (revealMatch) {
			this.spyPlayer = this.findPlayerByName(revealMatch[1]);
			
			// If the group accused the wrong person, the spy auto-wins without guessing
			// Clear any stale spy guess from previous games
			if (this.accusedPlayer && this.accusedPlayer.name !== this.spyPlayer.name) {
				console.log('✅ Group accused wrong person, spy auto-wins without guessing');
				this.spyGuess = null;
			}
			
			return { type: 'reveal', spy: this.spyPlayer, line: trimmedLine };
		}

		// Parse spy's final guess: "SpyName: "I believe we are at the LOCATION!""
		// This comes after the line "SpyName attempts a final guess..."
		
		// Debug: Log lines that might be spy guesses
		if (trimmedLine.includes('believe') || trimmedLine.includes('attempts a final guess')) {
			console.log('🔍 Potential spy guess line:', JSON.stringify(trimmedLine));
		}
		
		const spyGuessMatch = trimmedLine.match(/^([\w-]+): "I believe we are at the (.+)!"$/);
		if (spyGuessMatch) {
			const spy = this.findPlayerByName(spyGuessMatch[1]);
			const guess = spyGuessMatch[2].replace(/^THE /i, '').trim(); // Remove "THE" prefix and normalize
			this.spyGuess = guess; // Track the guess for later comparison
			console.log(`🕵️‍♂️ Parsed spy guess: ${spyGuessMatch[1]} guessed "${guess}"`);
			return { type: 'spy_guess', spy, guess, line: trimmedLine };
		}

		// Parse actual location: "📍 ACTUAL LOCATION: LocationName"
		const locationMatch = trimmedLine.match(/ACTUAL LOCATION: (.+)$/);
		if (locationMatch) {
			this.actualLocation = locationMatch[1];
			// Only pass spyGuess if it was actually set in this game
			const guessForEvent = this.spyGuess;
			console.log(`🎯 Location reveal: actual="${this.actualLocation}", spyGuess=${guessForEvent || 'none'}`);
			return { type: 'location_reveal', location: this.actualLocation, spyGuess: guessForEvent, line: trimmedLine };
		}

		// Parse result: "🏆 RESULT: SPY WINS!" or "🏆 RESULT: CIVILIANS WIN!"
		const resultMatch = trimmedLine.match(/RESULT: (SPY|CIVILIANS) WIN/);
		if (resultMatch) {
			this.winner = resultMatch[1].toLowerCase();
			return { type: 'result', winner: this.winner, message: trimmedLine };
		}

		// Parse reactions: "🤔 PlayerName: "reaction text"" or "  😂 PlayerName: "reaction text""
		// Note: Emojis can be multi-byte, so use \S+ to capture the full emoji
		// Leading spaces are optional
		
		// Debug: Check if this might be a reaction line
		if (trimmedLine.includes(':') && trimmedLine.includes('"')) {
			// Skip internal thought lines (containing 'Decision', 'Logic', 'Strategy', 'Thought')
			if (!trimmedLine.includes('Decision') && !trimmedLine.includes('Logic') && 
			    !trimmedLine.includes('Strategy') && !trimmedLine.includes('Thought')) {
				console.log('🔍 Checking reaction line:', JSON.stringify(trimmedLine));
			}
		}
		
		const reactionMatch = trimmedLine.match(/^(\S+)\s+([\w-]+):\s+"(.+)"$/);
		if (reactionMatch) {
			// Make sure it's not an internal thought line
			if (!trimmedLine.includes('Decision') && !trimmedLine.includes('Logic') && 
			    !trimmedLine.includes('Strategy') && !trimmedLine.includes('Thought')) {
				console.log(`💬 Parsed reaction: ${reactionMatch[1]} ${reactionMatch[2]}: "${reactionMatch[3].substring(0, 40)}..."`);
				return { 
					type: 'reaction', 
					emoji: reactionMatch[1], 
					player: this.findPlayerByName(reactionMatch[2]),
					text: reactionMatch[3]
				};
			}
		}

		return null;
	}

	findPlayerByName(name) {
		return this.players.find(p => p.name === name);
	}

	getPlayerAvatar(name) {
		if (name === 'You') return '👤';
		if (name.includes('GPT')) return '🤖';
		if (name.includes('Claude')) return '🤖';
		if (name.includes('Gemini')) return '🤖';
		return '🤖';
	}

	getPlayerColor(index) {
		const colors = ['#a78bfa', '#22c55e', '#ef4444', '#3b82f6', '#f59e0b', '#ec4899', '#14b8a6', '#f97316'];
		return colors[index % colors.length];
	}
}

// Visual Board Renderer
class VisualBoardRenderer {
	constructor(stateManager, audioManager) {
		this.state = stateManager;
		this.audio = audioManager;
		this.playerRing = document.getElementById('playerRing');
		this.turnArrow = document.getElementById('turnArrow');
		this.arrowLine = document.getElementById('arrowLine');
		this.currentRoundEl = document.getElementById('currentRound');
		this.totalRoundsEl = document.getElementById('totalRounds');
		this.currentPhaseEl = document.getElementById('currentPhase');
		this.currentLocationEl = document.getElementById('currentLocation');
		this.turnInfo = document.getElementById('turnInfo');
		this.askerName = document.getElementById('askerName');
		this.targetName = document.getElementById('targetName');
		this.dialogDisplay = document.getElementById('dialogDisplay');
		this.reactionsContainer = document.getElementById('reactionsContainer');
		this.playerCards = new Map();
		this.currentBubbles = [];
		this.currentAsker = null;
		this.currentTarget = null;
	}

	initialize() {
		this.renderPlayers();
		this.updateGameStatus();
		this.dialogDisplay.innerHTML = '';
		
		// Assign voices to players
		if (this.audio) {
			this.state.players.forEach(player => {
				this.audio.assignVoiceToPlayer(player.name);
			});
		}
	}

	renderPlayers() {
		this.playerRing.innerHTML = '';
		this.playerCards.clear();

		const playerCount = this.state.players.length;
		const radius = 250; // Distance from center
		const centerX = 300;
		const centerY = 300;

		this.state.players.forEach((player, index) => {
			const angle = (360 / playerCount) * index - 90; // Start from top
			const rad = (angle * Math.PI) / 180;
			const x = centerX + radius * Math.cos(rad);
			const y = centerY + radius * Math.sin(rad);

			const card = this.createPlayerCard(player, x, y);
			this.playerRing.appendChild(card);
			this.playerCards.set(player.name, card);
		});
	}

	createPlayerCard(player, x, y) {
		const card = document.createElement('div');
		card.className = 'player-card';
		card.style.left = `${x}px`;
		card.style.top = `${y}px`;
		card.dataset.playerId = player.id;

		// Avatar
		const avatar = document.createElement('div');
		avatar.className = 'player-avatar';
		avatar.textContent = player.avatar;
		card.appendChild(avatar);

		// Name
		const name = document.createElement('div');
		name.className = 'player-name';
		name.textContent = player.name;
		card.appendChild(name);

		// Status
		const status = document.createElement('div');
		status.className = 'player-status';
		status.textContent = 'idle';
		card.appendChild(status);

		// Thinking dots
		const thinkingDots = document.createElement('div');
		thinkingDots.className = 'thinking-dots';
		thinkingDots.innerHTML = '<span class="thinking-dot"></span><span class="thinking-dot"></span><span class="thinking-dot"></span>';
		card.appendChild(thinkingDots);

		return card;
	}

	updateGameStatus() {
		if (this.currentRoundEl && this.state.currentRound) {
			this.currentRoundEl.textContent = this.state.currentRound;
		} else if (this.currentRoundEl) {
			this.currentRoundEl.textContent = '-';
		}
		if (this.totalRoundsEl) {
			this.totalRoundsEl.textContent = this.state.totalRounds || '-';
		}
		if (this.currentPhaseEl) {
			this.currentPhaseEl.textContent = this.capitalizePhase(this.state.phase);
		}
		if (this.currentLocationEl) {
			this.currentLocationEl.textContent = this.state.location;
		}
	}

	updateRound(round) {
		if (round && round > 0) {
			this.state.currentRound = round;
			if (this.currentRoundEl) {
				this.currentRoundEl.textContent = round;
			}
		}
	}

	capitalizePhase(phase) {
		return phase.charAt(0).toUpperCase() + phase.slice(1);
	}

	async handleEvent(event) {
		switch (event.type) {
			case 'turn':
				this.updateTurn(event.asker, event.target);
				break;
			case 'question':
				await this.showQuestion(event.text, event.asker);
				break;
			case 'answer':
				await this.showAnswer(event.text, event.target);
				break;
			case 'round':
				this.updateRound(event.round);
				break;
			case 'phase':
				this.updatePhase(event.phase);
				break;
			case 'vote':
				await this.showVote(event.voter, event.target, event.line);
				break;
			case 'verdict':
				await this.showVerdict(event.accused, event.line);
				break;
			case 'reveal':
				await this.showSpyReveal(event.spy, event.line);
				break;
			case 'spy_guess':
				await this.showSpyGuess(event.spy, event.guess, event.line);
				break;
			case 'location_reveal':
				await this.showLocationReveal(event.location, event.spyGuess, event.line);
				break;
			case 'result':
				await this.showResult(event.winner, event.message);
				break;
			case 'reaction':
			await this.showReaction(event.emoji, event.player, event.text);
			break;
		}
	}

	updateTurn(asker, target) {
		this.currentAsker = asker;
		this.currentTarget = target;

		// Clear previous states
		this.playerCards.forEach(card => {
			card.classList.remove('active', 'target', 'thinking');
			const status = card.querySelector('.player-status');
			status.textContent = 'idle';
		});

		// Clear previous speech bubbles
		this.clearBubbles();

		if (asker && target) {
			// Set active states
			const askerCard = this.playerCards.get(asker.name);
			const targetCard = this.playerCards.get(target.name);

			if (askerCard) {
				askerCard.classList.add('active');
				askerCard.querySelector('.player-status').textContent = 'asking';
			}

			if (targetCard) {
				targetCard.classList.add('target', 'thinking');
				targetCard.querySelector('.player-status').textContent = 'answering';
			}

			// Update turn info
			this.askerName.textContent = asker.name;
			this.targetName.textContent = target.name;
			this.turnInfo.style.display = 'block';

			// Hide arrow (removed as per user request)
			this.turnArrow.style.display = 'none';
		}
	}

	clearBubbles() {
		this.currentBubbles.forEach(bubble => bubble.remove());
		this.currentBubbles = [];
	}

	positionBubbleNearPlayer(bubble, playerCard, preferredSide = 'auto') {
		const boardRect = this.playerRing.getBoundingClientRect();
		const cardRect = playerCard.getBoundingClientRect();
		
		// Calculate position relative to the board
		const cardCenterX = cardRect.left + cardRect.width / 2 - boardRect.left;
		const cardCenterY = cardRect.top + cardRect.height / 2 - boardRect.top;
		
		// Determine best position based on card location in circle
		const boardCenterX = boardRect.width / 2;
		const boardCenterY = boardRect.height / 2;
		const angle = Math.atan2(cardCenterY - boardCenterY, cardCenterX - boardCenterX);
		
		let position, direction;
		
		if (preferredSide === 'auto') {
			// Position bubble away from center
			if (Math.abs(angle) < Math.PI / 4) {
				// Right side
				position = { left: cardCenterX + 80, top: cardCenterY - 40 };
				direction = 'from-left';
			} else if (Math.abs(angle) > (3 * Math.PI) / 4) {
				// Left side
				position = { left: cardCenterX - 280 - 80, top: cardCenterY - 40 };
				direction = 'from-right';
			} else if (angle > 0) {
				// Bottom
				position = { left: cardCenterX - 140, top: cardCenterY + 80 };
				direction = 'from-top';
			} else {
				// Top
				position = { left: cardCenterX - 140, top: cardCenterY - 120 };
				direction = 'from-bottom';
			}
		}
		
		// Clamp to board bounds
		position.left = Math.max(10, Math.min(position.left, boardRect.width - 290));
		position.top = Math.max(10, Math.min(position.top, boardRect.height - 100));
		
		bubble.style.left = position.left + 'px';
		bubble.style.top = position.top + 'px';
		bubble.classList.add(direction);
	}

	async showQuestion(text, asker) {
		// Use passed asker or fallback to stored value
		const askerPlayer = asker || this.currentAsker;
		const askerCard = this.playerCards.get(askerPlayer?.name);
		if (!askerCard) return;

		const bubble = document.createElement('div');
		bubble.className = 'speech-bubble question';
		
		const label = document.createElement('div');
		label.className = 'speech-bubble-label';
		label.textContent = `${askerPlayer?.name || '?'} asks`;
		
		const textEl = document.createElement('div');
		textEl.className = 'speech-bubble-text';
		textEl.textContent = text;
		
		bubble.appendChild(label);
		bubble.appendChild(textEl);
		
		this.dialogDisplay.appendChild(bubble);
		this.currentBubbles.push(bubble);
		
		// Position after DOM insertion so we can measure
		setTimeout(() => {
			this.positionBubbleNearPlayer(bubble, askerCard);
		}, 10);
		
		// Speak the question and wait for it to complete
		if (this.audio && askerPlayer) {
			await this.audio.speak(text, askerPlayer.name);
		}
	}

	async showAnswer(text, target) {
		// Use passed target or fallback to stored value
		const targetPlayer = target || this.currentTarget;
		const targetCard = this.playerCards.get(targetPlayer?.name);
		if (!targetCard) return;

		const bubble = document.createElement('div');
		bubble.className = 'speech-bubble answer';
		
		const label = document.createElement('div');
		label.className = 'speech-bubble-label';
		label.textContent = `${targetPlayer?.name || '?'} answers`;
		
		const textEl = document.createElement('div');
		textEl.className = 'speech-bubble-text';
		textEl.textContent = text;
		
		bubble.appendChild(label);
		bubble.appendChild(textEl);
		
		this.dialogDisplay.appendChild(bubble);
		this.currentBubbles.push(bubble);
		
		// Remove thinking state from target
		targetCard.classList.remove('thinking');
		
		// Position after DOM insertion so we can measure
		setTimeout(() => {
			this.positionBubbleNearPlayer(bubble, targetCard);
		}, 10);
		
		// Speak the answer and wait for it to complete
		if (this.audio && targetPlayer) {
			await this.audio.speak(text, targetPlayer.name);
		}
	}

	drawArrow(fromRect, toRect) {
		const containerRect = this.playerRing.getBoundingClientRect();
		const fromX = fromRect.left + fromRect.width / 2 - containerRect.left;
		const fromY = fromRect.top + fromRect.height / 2 - containerRect.top;
		const toX = toRect.left + toRect.width / 2 - containerRect.left;
		const toY = toRect.top + toRect.height / 2 - containerRect.top;

		this.arrowLine.setAttribute('x1', fromX);
		this.arrowLine.setAttribute('y1', fromY);
		this.arrowLine.setAttribute('x2', toX);
		this.arrowLine.setAttribute('y2', toY);
		this.turnArrow.style.display = 'block';
	}

	async showReaction(emoji, player, text) {
		if (!player) return;
		
		const playerCard = this.playerCards.get(player?.name);
		if (!playerCard) return;

		console.log(`💬 Reaction: ${emoji} ${player.name}: "${text.substring(0, 60)}${text.length > 60 ? '...' : ''}"`);

		const cardRect = playerCard.getBoundingClientRect();
		const reaction = document.createElement('div');
		reaction.className = 'reaction-popup';
		reaction.style.left = `${cardRect.left + cardRect.width / 2}px`;
		reaction.style.top = `${cardRect.top - 40}px`;
		reaction.innerHTML = `
			<span class="reaction-emoji">${emoji}</span>
			<span class="reaction-text">"${text}"</span>
		`;

		this.reactionsContainer.appendChild(reaction);

		// Speak the reaction text and wait for it to complete
		if (this.audio && player) {
			await this.audio.speak(text, player.name);
		}

		// Remove after animation (or after audio finishes)
		setTimeout(() => {
			reaction.remove();
		}, 3000);
	}

	updatePhase(phase) {
		this.state.phase = phase;
		this.updateGameStatus();

		if (phase === 'voting') {
			// Hide turn arrow and clear bubbles for voting
			this.turnArrow.style.display = 'none';
			this.turnInfo.style.display = 'none';
			this.clearBubbles();
			// Clear active states
			this.playerCards.forEach(card => {
				card.classList.remove('active', 'target', 'thinking');
			});
		} else if (phase === 'verdict') {
			this.turnArrow.style.display = 'none';
			this.turnInfo.style.display = 'none';
		}
	}

	async showVote(voter, target, line) {
		if (!target) return;
		const targetCard = this.playerCards.get(target.name);
		if (!targetCard) return;

		// Show speech bubble from voter
		if (voter) {
			const voterCard = this.playerCards.get(voter.name);
			if (voterCard) {
				const bubble = document.createElement('div');
				bubble.className = 'speech-bubble vote-bubble';
				
				const label = document.createElement('div');
				label.className = 'speech-bubble-label';
				label.textContent = voter.name;
				
				const textEl = document.createElement('div');
				textEl.className = 'speech-bubble-text';
				textEl.textContent = `I vote for ${target.name}`;
				
				bubble.appendChild(label);
				bubble.appendChild(textEl);
				
				this.dialogDisplay.appendChild(bubble);
				this.currentBubbles.push(bubble);
				
				// Position near voter card
				setTimeout(() => {
					this.positionBubbleNearPlayer(bubble, voterCard);
				}, 10);
			}
		}

		// Update vote count badge
		let voteBadge = targetCard.querySelector('.vote-badge');
		if (!voteBadge) {
			voteBadge = document.createElement('div');
			voteBadge.className = 'vote-badge';
			targetCard.appendChild(voteBadge);
		}
		voteBadge.textContent = `${target.votes || 0} 🗳️`;
		voteBadge.style.display = 'block';

		// Add suspected state
		if (target.votes > 0) {
			targetCard.classList.add('suspected');
		}

		// Speak the vote if voter exists
		if (voter && this.audio) {
			const voteText = `I vote for ${target.name}`;
			await this.audio.speak(voteText, voter.name);
		}
	}

	async showVerdict(accused, line) {
		this.clearBubbles();
		
		// Highlight the accused player
		if (accused) {
			const accusedCard = this.playerCards.get(accused.name);
			if (accusedCard) {
				accusedCard.classList.add('accused');
				const status = accusedCard.querySelector('.player-status');
				status.textContent = 'ACCUSED';
			}
		}

		// Show verdict message in center
		const verdictEl = document.createElement('div');
		verdictEl.className = 'center-announcement verdict';
		const verdictText = accused ? `${accused.name} is accused!` : 'It\'s a tie!';
		verdictEl.textContent = verdictText;
		this.dialogDisplay.appendChild(verdictEl);
		this.currentBubbles.push(verdictEl);

		// Speak the verdict (use first player's voice as narrator)
		if (this.audio && this.state.players.length > 0) {
			const narrator = this.state.players[0];
			await this.audio.speak(`The group accuses ${accused ? accused.name : 'no one, it is a tie'}`, narrator.name);
		}
	}

	async showSpyReveal(spy, line) {
		if (!spy) return;
		const spyCard = this.playerCards.get(spy.name);
		if (!spyCard) return;

		// Mark spy card
		spyCard.classList.add('revealed-spy');
		const status = spyCard.querySelector('.player-status');
		status.textContent = '🕵️ SPY';

		// Add spy emoji to avatar
		const avatar = spyCard.querySelector('.player-avatar');
		if (avatar && !avatar.textContent.includes('🕵️')) {
			avatar.textContent = '🕵️';
		}

		// Speak the reveal (use first player's voice as narrator)
		if (this.audio && this.state.players.length > 0) {
			const narrator = this.state.players[0];
			await this.audio.speak(`The spy was ${spy.name}!`, narrator.name);
		}
	}

	async showSpyGuess(spy, guess, line) {
		if (!spy) return;

		// Show spy's guess as a speech bubble
		const spyCard = this.playerCards.get(spy.name);
		if (spyCard) {
			const bubble = document.createElement('div');
			bubble.className = 'speech-bubble spy-guess';
			
			const label = document.createElement('div');
			label.className = 'speech-bubble-label';
			label.textContent = `${spy.name}'s final guess`;
			
			const textEl = document.createElement('div');
			textEl.className = 'speech-bubble-text';
			textEl.textContent = guess;
			
			bubble.appendChild(label);
			bubble.appendChild(textEl);
			
			this.dialogDisplay.appendChild(bubble);
			this.currentBubbles.push(bubble);
			
			// Position near spy card
			setTimeout(() => {
				this.positionBubbleNearPlayer(bubble, spyCard);
			}, 10);
		}

		// Speak the spy's guess
		if (this.audio && spy) {
			console.log(`🕵️ Spy guess audio: "${guess}" by ${spy.name}, audio enabled: ${this.audio.enabled}`);
			await this.audio.speak(`My final guess is ${guess}`, spy.name);
		} else {
			console.warn('⚠️ Spy guess audio skipped:', { hasAudio: !!this.audio, hasSpy: !!spy });
		}
	}

	async showLocationReveal(location, spyGuess, line) {
		// Update location display
		this.currentLocationEl.textContent = location;
		this.currentLocationEl.style.color = 'var(--green)';

		// Speak the location reveal with commentary about spy's guess (use first player's voice as narrator)
		if (this.audio && this.state.players.length > 0) {
			const narrator = this.state.players[0];
			
			if (spyGuess) {
				// Compare guess with actual location
				const wasCorrect = spyGuess.toLowerCase() === location.toLowerCase();
				if (wasCorrect) {
					await this.audio.speak(`The spy guessed ${spyGuess}. The actual location was ${location}. The spy guessed correctly!`, narrator.name);
				} else {
					await this.audio.speak(`The spy guessed ${spyGuess}. The actual location was ${location}. The spy was wrong!`, narrator.name);
				}
			} else {
				// No guess was made (civilians won before spy could guess)
				await this.audio.speak(`The actual location was ${location}`, narrator.name);
			}
		}
	}

	async showResult(winner, message) {
		this.clearBubbles();

		// Show winner announcement
		const resultEl = document.createElement('div');
		resultEl.className = `center-announcement result ${winner}-wins`;
		resultEl.innerHTML = `
			<div class="result-icon">${winner === 'spy' ? '🕵️' : '👥'}</div>
			<div class="result-text">${winner.toUpperCase()} WIN${winner === 'spy' ? 'S' : ''}!</div>
		`;
		this.dialogDisplay.appendChild(resultEl);
		this.currentBubbles.push(resultEl);

		// Speak the result (use first player's voice as narrator)
		if (this.audio && this.state.players.length > 0) {
			const narrator = this.state.players[0];
			const resultText = winner === 'spy' ? 'The spy wins!' : 'The civilians win!';
			await this.audio.speak(resultText, narrator.name);
		}

		// Highlight winning players
		this.playerCards.forEach(card => {
			const playerName = card.querySelector('.player-name')?.textContent;
			const player = this.state.players.find(p => p.name === playerName);
			if (!player) return;

			const isWinner = (winner === 'spy' && player.isSpy) || (winner === 'civilians' && !player.isSpy);
			if (isWinner) {
				card.classList.add('winner');
				const status = card.querySelector('.player-status');
				status.textContent = '🏆 WINNER';
			} else {
				card.classList.add('loser');
			}
		});
	}
}

// Global instances (expose on window for log.js and main.js)
var gameState = new GameStateManager();
var audioManager = new AudioManager();
var visualBoardRenderer = new VisualBoardRenderer(gameState, audioManager);
window.gameState = gameState;
window.audioManager = audioManager;
window.visualBoardRenderer = visualBoardRenderer;