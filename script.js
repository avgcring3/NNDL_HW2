// 1) SET THESE TWO:
const HF_TOKEN = "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";
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzO8GjQo46GEtzYEoeJPPOWFPlSyYpRVfcsGtS6P9n3pInmQP6yyddB6PWH9hmBKfQ/exec";

// Hugging Face sentiment model
const HF_MODEL = "distilbert-base-uncased-finetuned-sst-2-english";

function determineBusinessAction(confidence, label) {
  let normalizedScore = 0.5;

  if (label === "POSITIVE") normalizedScore = confidence;
  else if (label === "NEGATIVE") normalizedScore = 1.0 - confidence;

  if (normalizedScore <= 0.4) {
    return {
      actionCode: "OFFER_COUPON",
      uiMessage: "We are truly sorry. Please accept this 50% discount coupon.",
      uiColor: "#ef4444"
    };
  } else if (normalizedScore < 0.7) {
    return {
      actionCode: "REQUEST_FEEDBACK",
      uiMessage: "Thank you! Could you tell us how we can improve?",
      uiColor: "#6b7280"
    };
  } else {
    return {
      actionCode: "ASK_REFERRAL",
      uiMessage: "Glad you liked it! Refer a friend and earn rewards.",
      uiColor: "#3b82f6"
    };
  }
}

function updateActionDOM(decision) {
  const box = document.getElementById("action-result");
  const code = document.getElementById("action-code");
  const msg  = document.getElementById("action-message");

  code.textContent = decision.actionCode;
  msg.textContent = decision.uiMessage;

  box.style.display = "block";
  box.style.border = `1px solid ${decision.uiColor}`;
  box.style.color = decision.uiColor;
}

function showSentiment(label, score) {
  document.getElementById("sentiment-result").style.display = "block";
  document.getElementById("sentiment-label").textContent = label;
  document.getElementById("sentiment-score").textContent = (score * 100).toFixed(1) + "%";
}

async function analyzeSentiment(text) {
  const resp = await fetch(`https://api-inference.huggingface.co/models/${HF_MODEL}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${HF_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ inputs: text })
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`HF error ${resp.status}: ${t}`);
  }

  const data = await resp.json();

  // Usually: [ {label, score}, {label, score} ] or nested.
  // Normalize to one best result.
  let best = null;

  if (Array.isArray(data) && Array.isArray(data[0])) {
    // sometimes [[{...},{...}]]
    best = data[0].sort((a,b) => b.score - a.score)[0];
  } else if (Array.isArray(data)) {
    best = data.sort((a,b) => b.score - a.score)[0];
  } else {
    throw new Error("Unexpected HF response: " + JSON.stringify(data));
  }

  return { label: best.label, confidence: best.score };
}

async function logToGoogleSheet(payload) {
  if (!GOOGLE_SCRIPT_URL.startsWith("http")) return; // allow running without sheets for now

  const resp = await fetch(GOOGLE_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Sheets log error ${resp.status}: ${t}`);
  }
}

document.getElementById("analyzeBtn").addEventListener("click", async () => {
  const review = document.getElementById("review").value.trim();
  if (!review) return;

  try {
    const { label, confidence } = await analyzeSentiment(review);
    showSentiment(label, confidence);

    const decision = determineBusinessAction(confidence, label);
    updateActionDOM(decision);

    const payload = {
      ts_iso: new Date().toISOString(),
      review,
      sentiment: label,
      confidence,
      meta: JSON.stringify({ source: "github-pages" }),
      action_taken: decision.actionCode
    };

    await logToGoogleSheet(payload);
  } catch (err) {
    alert(String(err.message || err));
  }
});
