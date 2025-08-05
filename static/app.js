document.getElementById("tts-submit").addEventListener("click", async () => {
	const ttsText = document.getElementById("tts-text").value;
	const ttsStatus = document.getElementById("tts-status");
	const ttsAudio = document.getElementById("tts-audio");

	if (!ttsText) {
		ttsStatus.textContent = "Please enter text to convert.";
		return;
	}

	ttsStatus.textContent = "Generating audio...";
	ttsAudio.src = "";
	ttsAudio.pause();

	try {
		const response = await fetch("/api/text-to-speech", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ text: ttsText }),
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const data = await response.json();
		if (data.audio_url) {
			ttsAudio.src = data.audio_url;
			ttsAudio.play();
			ttsStatus.textContent = "Audio generated and playing!";
		} else {
			ttsStatus.textContent = "Error: No audio URL received.";
		}
	} catch (error) {
		console.error("Error generating audio:", error);
		ttsStatus.textContent = `Error: ${error.message}`;
	}
});

(function setupEchoBot() {
	const startBtn = document.getElementById("startRecBtn");
	const stopBtn = document.getElementById("stopRecBtn");
	const player = document.getElementById("echoPlayer");
	const statusEl = document.getElementById("echoStatus");

	if (!startBtn || !stopBtn || !player) {
		// Echo Bot UI not present; skip initialization
		return;
	}

	let mediaStream = null;
	let mediaRecorder = null;
	let chunks = [];
	let objectUrl = null;
	let recordingTicker = null;
	let recordingStart = 0;

	const updateStatus = (msg) => {
		if (statusEl) statusEl.textContent = msg || "";
	};

	const enable = (el, on) => {
		if (!el) return;
		el.disabled = !on;
	};

	const setRecordingUI = (isRecording) => {
		// Buttons
		enable(startBtn, !isRecording);
		enable(stopBtn, isRecording);

		// Visual feedback on buttons
		startBtn.classList.toggle("opacity-50", isRecording);
		startBtn.classList.toggle("cursor-not-allowed", isRecording);
		stopBtn.classList.toggle("animate-pulse", isRecording);

		// Section background subtle feedback
		const container = document.getElementById("echo-bot-section");
		if (container) {
			container.classList.toggle("ring-2", isRecording);
			container.classList.toggle("ring-emerald-400/60", isRecording);
			container.classList.toggle("bg-emerald-50", isRecording);
			container.classList.toggle("dark:bg-emerald-900/10", isRecording);
		}
	};

	// Show duration once metadata is ready
	const showDuration = () => {
		if (isFinite(player.duration) && player.duration > 0) {
			const seconds = Math.round(player.duration * 10) / 10;
			updateStatus(
				`Ready. Length: ${seconds}s. Use the controls to replay or record again.`
			);
		}
	};

	// Ensure duration is visible when metadata loads
	player.addEventListener("loadedmetadata", showDuration);

	const supportsMediaRecorder = !!(
		navigator.mediaDevices &&
		navigator.mediaDevices.getUserMedia &&
		window.MediaRecorder
	);

	if (!supportsMediaRecorder) {
		updateStatus("MediaRecorder API not supported in this browser.");
		enable(startBtn, false);
		enable(stopBtn, false);
		return;
	}

	startBtn.addEventListener("click", async () => {
		try {
			// If already recording, ignore
			if (mediaRecorder && mediaRecorder.state === "recording") return;

			updateStatus("Requesting microphone access…");
			mediaStream = await navigator.mediaDevices.getUserMedia({
				audio: true,
			});
			mediaRecorder = new MediaRecorder(mediaStream);

			chunks = [];

			mediaRecorder.ondataavailable = (e) => {
				if (e.data && e.data.size > 0) {
					chunks.push(e.data);
				}
			};

			mediaRecorder.onstart = () => {
				recordingStart = Date.now();
				setRecordingUI(true);
				// Live ticker: update status every 200ms with elapsed time
				if (recordingTicker) clearInterval(recordingTicker);
				recordingTicker = setInterval(() => {
					const elapsed =
						Math.round((Date.now() - recordingStart) / 100) / 10; // 0.1s precision
					updateStatus(`Recording… ${elapsed}s`);
				}, 200);
			};

			mediaRecorder.onerror = (e) => {
				console.error("MediaRecorder error:", e);
				updateStatus("Recording error. See console for details.");
				setRecordingUI(false);
				if (recordingTicker) {
					clearInterval(recordingTicker);
					recordingTicker = null;
				}
			};

			mediaRecorder.onstop = () => {
				if (recordingTicker) {
					clearInterval(recordingTicker);
					recordingTicker = null;
				}
				setRecordingUI(false);

				updateStatus("Recording stopped. Preparing playback…");
				// Create a blob from chunks
				const mime = mediaRecorder.mimeType || "audio/webm";
				const blob = new Blob(chunks, { type: mime });
				chunks = [];

				// Revoke previous object URL if present
				if (objectUrl) {
					URL.revokeObjectURL(objectUrl);
					objectUrl = null;
				}

				objectUrl = URL.createObjectURL(blob);

				// Reset player and force metadata parsing so duration shows
				player.pause();
				player.removeAttribute("src"); // Clear previous to force reload cycle
				player.load();

				player.src = objectUrl;

				// In some browsers, calling load after setting src helps duration
				player.load();

				// Try to auto-play (may be blocked)
				player.play().catch(() => {
					// Autoplay might be blocked; user can press play
				});

				// Stop mic tracks to release device
				if (mediaStream) {
					mediaStream.getTracks().forEach((t) => t.stop());
					mediaStream = null;
				}

				// If metadata already available quickly, show immediately; otherwise loadedmetadata handler will show
				showDuration();
				if (!isFinite(player.duration) || player.duration === 0) {
					updateStatus("Preparing audio…");
				}
			};

			mediaRecorder.start(); // start recording
		} catch (err) {
			console.error("getUserMedia error:", err);
			updateStatus("Microphone access denied or unavailable.");
			setRecordingUI(false);
		}
	});

	stopBtn.addEventListener("click", () => {
		if (mediaRecorder && mediaRecorder.state === "recording") {
			mediaRecorder.stop();
			updateStatus("Stopping…");
			enable(stopBtn, false);
		}
	});
})();