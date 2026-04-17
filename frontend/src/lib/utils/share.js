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
  const parts = [];
  if (title) parts.push(title);
  if (text) parts.push(text);
  if (url) parts.push(url);
  return parts.join("\n\n").trim();
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

      if (result == null) return true;
      if (result === false || normalizedResult.success === false || normalizedResult.cancelled === true) continue;
      return true;
    } catch (_) {
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
      } catch (_) {}
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
    } catch (_) {}
  }
  return false;
};

const isNativeRuntime = () => {
  if (typeof window === "undefined") return false;
  
  // Check for specific bridge properties
  const hasFlutter = !!window?.flutter_inappwebview?.callHandler;
  const hasAndroid = !!(window?.Android || window?.AndroidInterface);
  const hasIOS = !!window?.webkit?.messageHandlers?.share;
  const hasJSBridge = !!window?.JSBridge;
  const hasCapacitor = !!window?.Capacitor?.Plugins?.Share;
  
  // Also check User Agent for common WebView markers if bridges aren't immediately detectable
  const ua = navigator.userAgent.toLowerCase();
  const isWebView = /(iphone|ipod|ipad).*applewebkit(?!.*safari)/i.test(ua) || 
                    ua.includes('wv') || 
                    ua.includes('android');

  return hasFlutter || hasAndroid || hasIOS || hasJSBridge || hasCapacitor || (isWebView && !ua.includes('chrome') && !ua.includes('safari'));
};

export async function shareContent({ title = "", text = "", url = "" } = {}) {
  const payload = getSharePayload({ title, text, url });
  const isAppRuntime = isNativeRuntime();
  const messageText = getMessageText(payload);
  const clipboardText = getClipboardText(payload);

  if (!payload.title && !payload.text && !payload.url) {
    return { status: "unsupported" };
  }

  // 1. Try Web Share API (Primary for browsers)
  if (navigator?.share) {
    try {
      // First try complete payload
      if (!navigator.canShare || navigator.canShare(payload)) {
        await navigator.share(payload);
        return { status: "shared", method: "web-share" };
      }
      
      // Secondary attempt with text only if URL causes issues
      const textOnlyPayload = {
        ...(payload.title ? { title: payload.title } : {}),
        text: messageText
      };
      if (!navigator.canShare || navigator.canShare(textOnlyPayload)) {
        await navigator.share(textOnlyPayload);
        return { status: "shared", method: "web-share-text" };
      }
    } catch (error) {
      if (error?.name === "AbortError") {
        return { status: "cancelled", method: "web-share" };
      }
      // If other types of errors, proceed to native bridges
    }
  }

  // 2. Try Native Bridges (For Android/iOS/Flutter wrappers)
  try {
    const flutterShared = await tryFlutterShare(payload);
    if (flutterShared) return { status: "shared", method: "flutter-bridge" };
  } catch (_) {}

  try {
    const androidShared = await tryAndroidWebViewShare(payload);
    if (androidShared) return { status: "shared", method: "android-bridge" };
  } catch (_) {}

  // 3. Fallback to Clipboard (Only if not in a native app where we expect a share menu)
  // If we suspect a native runtime but all bridges failed, still try clipboard but prioritize logging
  const copied = await copyToClipboard(clipboardText);
  if (copied) {
    return { status: "copied", method: "clipboard" };
  }

  return { status: "unsupported" };
}

