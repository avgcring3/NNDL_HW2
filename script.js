const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzlIR3bWzOTMJB_3tSzjNvQe0Gyi9D-_kcOlmm0R4dhbAi8RTbUJjjRYkQpgA3rWlY/exec";

function determineBusinessAction(confidence, label) {
  let normalizedScore = 0.5;
  if (label === "POSITIVE") normalizedScore = confidence;
  else if (label === "NEGATIVE") normalizedScore = 1.0 - confidence;

  if (normalizedScore <= 0.4) {
    return { actionCode: "OFFER_COUPON", uiMessage: "We are truly sorry. Please accept this 50% discount coupon.", uiColor: "#ef4444" };
  } else if (normalizedScore < 0.7) {
    return { actionCode: "REQUEST_FEEDBACK", uiMessage: "Thank you! Could you tell us how we can improve?", uiColor: "#6b7280" };
  } else {
    return { actionCode: "ASK_REFERRAL", uiMessage: "Glad you liked it! Refer a friend and earn rewards.", uiColor: "#3b82f6" };
  }
}

function updateActionDOM(decision) {
  const box = document.getElementById("action-result");
  document.getElementById("action-code").textContent = decision.actionCode;
  document.getElementById("action-message").textContent = decision.uiMessage;
  box.style.display = "block";
  box.style.border = `1px solid ${decision.uiColor}`;
  box.style.color = decision.uiColor;
}

function showSentiment(label, score) {
  document.getElementById("sentiment-result").style.display = "block";
  document.getElementById("sentiment-label").textContent = label;
  document.getElementById("sentiment-score").textContent = (score * 100).toFixed(1) + "%";
}

function jsonp(params) {
  return new Promise((resolve, reject) => {
    const cb = "cb_" + Math.random().toString(36).slice(2);
    const url = new URL(GOOGLE_SCRIPT_URL);

    url.searchParams.set("callback", cb);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

    const script = document.createElement("script");
    script.src = url.toString();

    window[cb] = (data) => { cleanup(); resolve(data); };
    script.onerror = () => { cleanup(); reject(new Error("JSONP load failed")); };

    function cleanup() {
      try { delete window[cb]; } catch (_) { window[cb] = undefined; }
      script.remove();
    }

    document.body.appendChild(script);
  });
}

document.getElementById("analyzeBtn").addEventListener("click", async () => {
  const review = document.getElementById("review").value.trim();
  if (!review) return;

  try {
    const res = await jsonp({ action: "analyze", review });
    if (res && res.error) throw new Error(`Analyze error: ${JSON.stringify(res)}`);

    const label = res.label;
    const confidence = res.confidence;

    showSentiment(label, confidence);

    const decision = determineBusinessAction(confidence, label);
    updateActionDOM(decision);

    const logRes = await jsonp({
      action: "log",
      ts_iso: new Date().toISOString(),
      review,
      sentiment: label,
      confidence,
      meta: JSON.stringify({ source: "github-pages" }),
      action_taken: decision.actionCode
    });

    if (logRes && logRes.error) throw new Error(`Log error: ${JSON.stringify(logRes)}`);

  } catch (err) {
    console.error(err);
    alert(String(err.message || err));
  }
});
