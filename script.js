const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzO8GjQo46GEtzYEoeJPPOWFPlSyYpRVfcsGtS6P9n3pInmQP6yyddB6PWH9hmBKfQ/exec";

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

async function postToScript(body) {
  const resp = await fetch(GOOGLE_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const text = await resp.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!resp.ok || data.error) throw new Error(`Script error: ${JSON.stringify(data)}`);
  return data;
}

document.getElementById("analyzeBtn").addEventListener("click", async () => {
  const review = document.getElementById("review").value.trim();
  if (!review) return;

  try {
    // 1) Analyze via Apps Script (server-side call to HF, no CORS)
    const res = await postToScript({ action: "analyze", review });

    const label = res.label;
    const confidence = res.confidence;

    showSentiment(label, confidence);

    // 2) Decide action
    const decision = determineBusinessAction(confidence, label);
    updateActionDOM(decision);

    // 3) Log to sheet via Apps Script
    await postToScript({
      action: "log",
      ts_iso: new Date().toISOString(),
      review,
      sentiment: label,
      confidence,
      meta: JSON.stringify({ source: "github-pages" }),
      action_taken: decision.actionCode
    });

  } catch (err) {
    console.error(err);
    alert(String(err.message || err));
  }
});
