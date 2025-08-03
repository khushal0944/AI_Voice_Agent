document.getElementById("testBtn").addEventListener("click", async () => {
    try {
        const response = await fetch("/api/hello");
        const data = await response.json();
        document.getElementById("output").innerHTML = `<p><b>${data.message}</b></p>`;
    } catch (err) {
        console.error("Error:", err);
        document.getElementById("output").innerHTML = "<p>❌ Failed to connect</p>";
    }
});