const FLUTTER_SHARE_HANDLERS = [
  "share",
  "nativeShare",
  "nativeShareSheet",
  "openShare",
  "openShareSheet",
  "shareContent",
  "shareText",
  "shareData"
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

const getMessageText = ({ title = "", text = "", url = "" } = {}) => {
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

  const message = getMessageText(payload);

  const normalizeBridgeResult = (result) => {
    if (typeof result === "string") {
      const trimmed = result.trim();
      if (!trimmed) return {};
      try {
        return JSON.parse(trimmed);
      } catch (_) {
        return { raw: trimmed };
      }
    }
    if (result && typeof result === "object") return result;
    return {};
  };

  for (const handlerName of FLUTTER_SHARE_HANDLERS) {
    try {
      const result = await bridge.callHandler(handlerName, {
        ...payload,
        message
      });
      const normalizedResult = normalizeBridgeResult(result);

      // Many native bridges are fire-and-forget and return null/undefined on success.
      if (result == null) return true;

      // Most bridges return object/true on success, false or { success:false } on failure.
      if (result === false || normalizedResult.success === false || normalizedResult.cancelled === true) continue;
      return true;
    } catch (_) {
      // Try next possible handler with text-only argument (some bridges expect a string).
      try {
        const fallbackResult = await bridge.callHandler(handlerName, message);
        const normalizedFallback = normalizeBridgeResult(fallbackResult);
        if (fallbackResult == null) return true;
        if (
          fallbackResult !== false &&
          normalizedFallback.success !== false &&
          normalizedFallback.cancelled !== true
        ) {
          return true;
        }
      } catch (_) {
        // Try next possible handler.
      }
    }
  }

  return false;
};

const tryAndroidWebViewShare = async (payload) => {
  const message = getMessageText(payload);
  if (!message) return false;
  const androidBridge = window?.Android || window?.AndroidInterface;
  if (!androidBridge) return false;

  const methodNames = ["share", "shareText", "openShareSheet", "nativeShare"];
  for (const methodName of methodNames) {
    const method = androidBridge?.[methodName];
    if (typeof method !== "function") continue;
    try {
      method(message);
      return true;
    } catch (_) {
      // Try next bridge method.
    }
  }
  return false;
};

const isNativeRuntime = () => {
  if (typeof window === "undefined") return false;
  return Boolean(
    window?.flutter_inappwebview?.callHandler ||
    window?.Android ||
    window?.AndroidInterface ||
    window?.Capacitor?.Plugins?.Share
  );
};

export async function shareContent({ title = "", text = "", url = "" } = {}) {
  const payload = getSharePayload({ title, text, url });
  const isAppRuntime = isNativeRuntime();
  const messageText = getMessageText(payload);

  if (!payload.title && !payload.text && !payload.url) {
    return { status: "unsupported" };
  }

  try {
    if (navigator?.share) {
      if (navigator.canShare && !navigator.canShare(payload)) {
        // Some environments reject URL payloads but allow text-only shares.
        const textOnlyPayload = {
          ...(payload.title ? { title: payload.title } : {}),
          ...(messageText ? { text: messageText } : {})
        };
        if (!navigator.canShare || navigator.canShare(textOnlyPayload)) {
          await navigator.share(textOnlyPayload);
          return { status: "shared", method: "web-share-text" };
        }
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
    if (flutterShared) return { status: "shared", method: "flutter-bridge" };
  } catch (_) {}

  try {
    const androidShared = await tryAndroidWebViewShare(payload);
    if (androidShared) return { status: "shared", method: "android-bridge" };
  } catch (_) {}

  // In native app runtimes, avoid silent clipboard fallback for share actions.
  if (isAppRuntime) {
    return { status: "unsupported", method: "native-share-unavailable" };
  }

  const copied = await copyToClipboard(getClipboardText(payload));
  if (copied) {
    return { status: "copied", method: "clipboard" };
  }

  return { status: "unsupported" };
}
