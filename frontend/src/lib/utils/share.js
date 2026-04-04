const FLUTTER_SHARE_HANDLERS = [
  "share",
  "nativeShare",
  "openShareSheet",
  "shareContent",
  "shareText"
];

const toTrimmedString = (value) => String(value || "").trim();

const getSharePayload = ({ title = "", text = "", url = "" } = {}) => {
  const safeTitle = toTrimmedString(title);
  const safeText = toTrimmedString(text);
  const safeUrl = toTrimmedString(url);

  const payload = {};
  if (safeTitle) payload.title = safeTitle;
  if (safeText) payload.text = safeText;
  if (safeUrl) payload.url = safeUrl;

  return payload;
};

const getClipboardText = ({ title = "", text = "", url = "" } = {}) => {
  const safeTitle = toTrimmedString(title);
  const safeText = toTrimmedString(text);
  const safeUrl = toTrimmedString(url);
  return [safeTitle, safeText, safeUrl].filter(Boolean).join("\n").trim();
};

const copyToClipboard = async (text) => {
  const content = toTrimmedString(text);
  if (!content) return false;

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(content);
      return true;
    }
  } catch (_) {
    // Fallback to textarea below.
  }

  try {
    const textArea = document.createElement("textarea");
    textArea.value = content;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textArea);
    return copied;
  } catch (_) {
    return false;
  }
};

const tryFlutterShare = async (payload) => {
  const bridge = window?.flutter_inappwebview;
  if (!bridge || typeof bridge.callHandler !== "function") return false;

  for (const handlerName of FLUTTER_SHARE_HANDLERS) {
    try {
      const result = await bridge.callHandler(handlerName, {
        ...payload,
        message: payload.text || payload.url || ""
      });

      // Most bridges return object/true on success, false or { success:false } on failure.
      if (result === false || result?.success === false) continue;
      return true;
    } catch (_) {
      // Try next possible handler.
    }
  }

  return false;
};

export async function shareContent({ title = "", text = "", url = "" } = {}) {
  const payload = getSharePayload({ title, text, url });

  if (!payload.title && !payload.text && !payload.url) {
    return { status: "unsupported" };
  }

  try {
    if (navigator?.share) {
      if (navigator.canShare && !navigator.canShare(payload)) {
        // Continue to native bridge/clipboard fallback.
      } else {
        await navigator.share(payload);
        return { status: "shared", method: "web-share" };
      }
    }
  } catch (error) {
    if (error?.name === "AbortError") {
      return { status: "cancelled", method: "web-share" };
    }
  }

  try {
    const flutterShared = await tryFlutterShare(payload);
    if (flutterShared) {
      return { status: "shared", method: "flutter-bridge" };
    }
  } catch (_) {
    // Continue to clipboard fallback.
  }

  const copied = await copyToClipboard(getClipboardText(payload));
  if (copied) {
    return { status: "copied", method: "clipboard" };
  }

  return { status: "unsupported" };
}
