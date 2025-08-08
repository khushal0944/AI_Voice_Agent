document.getElementById("tts-submit").addEventListener("click", async () => {
	const ttsText = document.getElementById("tts-text").value;
	const ttsStatus = document.getElementById("tts-status");
	const ttsAudio = document.getElementById("tts-audio");

	if (!ttsText) {
		ttsStatus.textContent = "Please enter text to convert.";
		return;
	}

	ttsStatus.textContent = "Generating audio...";
	ttsAudio.src = ""; // Clear previous audio
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

/* Echo Bot: MediaRecorder-based microphone capture and playback */
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

			mediaRecorder.onstop = async () => {
				if (recordingTicker) {
					clearInterval(recordingTicker);
					recordingTicker = null;
				}
				setRecordingUI(false);
				updateStatus("Recording stopped. Processing…");

				const mime = mediaRecorder.mimeType || "audio/webm";
				const blob = new Blob(chunks, { type: mime });
				chunks = [];

				// Perform transcription and echo
				await transcribeAndEcho(blob);

				if (mediaStream) {
					mediaStream.getTracks().forEach((t) => t.stop());
					mediaStream = null;
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

// Function to handle transcription and TTS echo
const transcribeAndEcho = async (blob) => {
	const statusEl = document.getElementById("echoStatus");
	const transcriptDisplay = document.getElementById("transcript-display");
	const player = document.getElementById("echoPlayer");

	const updateStatus = (msg) => {
		if (statusEl) statusEl.textContent = msg;
	};

	updateStatus("Transcribing and generating echo…");
	transcriptDisplay.textContent = ""; // Clear previous transcript

	const formData = new FormData();
	formData.append("file", blob, "recording.webm");

	try {
		const response = await fetch("/api/tts/echo", {
			method: "POST",
			body: formData,
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const result = await response.json();

		// Display the transcript
		if (result.transcript) {
			transcriptDisplay.textContent = result.transcript;
		}

		// Play the new audio from Murf
		if (result.audio_url) {
			player.src = result.audio_url;
			player.play();
			updateStatus("Echo generated and playing.");
		} else {
			updateStatus("Echo generation failed or no speech detected.");
		}
	} catch (error) {
		console.error("Echo error:", error);
		transcriptDisplay.textContent = `Echo failed: ${error.message}`;
		updateStatus("Echo error.");
	}
};