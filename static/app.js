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
