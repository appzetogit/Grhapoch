export class FlutterCameraBridgeError extends Error {
  constructor(code, message, meta = {}) {
    super(message);
    this.name = "FlutterCameraBridgeError";
    this.code = code;
    this.meta = meta;
  }
}

/**
 * Returns true when running inside a Flutter InAppWebView that has callHandler.
 */
export const hasFlutterCameraBridge = () => {
  if (typeof window === "undefined") return false;
  return !!(window.flutter_inappwebview && typeof window.flutter_inappwebview.callHandler === "function");
};

/**
 * Converts a base64 string (with or without the data-URI prefix) to a File object.
 */
export const base64ToFile = (base64Input, mimeType = "image/jpeg", fileName = `capture-${Date.now()}.jpg`) => {
  let normalized = base64Input || "";
  if (normalized.includes(",")) normalized = normalized.split(",")[1];

  const base64Data = normalized.replace(/\s/g, "");
  const byteCharacters = atob(base64Data);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) byteNumbers[i] = slice.charCodeAt(i);
    byteArrays.push(new Uint8Array(byteNumbers));
  }

  return new File([new Blob(byteArrays, { type: mimeType })], fileName, { type: mimeType });
};

/**
 * INTERNAL — call a single Flutter handler with a timeout.
 *
 * Resolves with the raw result object, or throws on error / timeout.
 * Does NOT resolve with null — if Flutter returns null / undefined we treat that as
 * "handler exists but gave us nothing useful", which the caller can decide on.
 */
const callFlutterHandler = (handlerName, payload, timeoutMs) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new FlutterCameraBridgeError("timeout", `Handler "${handlerName}" timed out after ${timeoutMs}ms`)),
      timeoutMs
    );

    window.flutter_inappwebview
      .callHandler(handlerName, payload)
      .then((res) => { clearTimeout(timer); resolve(res); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
};

/**
 * Open the device camera / gallery via the Flutter bridge and return a File object.
 *
 * Behaviour:
 *  • Returns a **File** when the user picked an image successfully.
 *  • Returns **null** when the user explicitly cancelled (Flutter returned a cancellation signal).
 *  • **Throws** FlutterCameraBridgeError("handler_missing") when no handler responded at all
 *    — the caller should fall back to a native <input type="file"> in this case.
 *
 * @param {{ source?: 'camera'|'gallery', fileNamePrefix?: string, quality?: number, handlerTimeoutMs?: number }} options
 * @returns {Promise<File|null>}
 */
export const requestImageFileFromFlutter = async ({
  source = "camera",
  fileNamePrefix = "capture",
  quality = 0.8,
  handlerTimeoutMs = 2500,  // Short timeout per handler — unregistered handlers hang, so we time out fast
} = {}) => {
  if (!hasFlutterCameraBridge()) {
    throw new FlutterCameraBridgeError("bridge_unavailable", "Flutter bridge not available");
  }

  const payload = { source, accept: "image/*", multiple: false, quality };

  const handlersToTry =
    source === "gallery"
      ? ["openGallery", "pickFromGallery", "openMediaPicker"]
      : ["openCamera", "takePhoto", "captureImage"];

  for (const handlerName of handlersToTry) {
    let result;
    try {
      result = await callFlutterHandler(handlerName, payload, handlerTimeoutMs);
    } catch {
      // Handler threw / timed out → not implemented, try next one
      continue;
    }

    // Handler responded — it IS implemented.
    // Now interpret the response:

    if (result === null || result === undefined) {
      // Handler exists but returned nothing — could be unimplemented stub.
      // Continue trying other handler names.
      continue;
    }

    // Explicit cancellation from Flutter
    if (result.cancelled === true || result.success === false) {
      return null;
    }

    // Success — extract the image
    if (result.success === true) {
      if (!result.base64) {
        console.warn(`[cameraBridge] Handler "${handlerName}" returned success but no base64 data`);
        return null;
      }
      const mimeType = result.mimeType || "image/jpeg";
      const fileName = result.fileName || `${fileNamePrefix}-${Date.now()}.jpg`;
      return base64ToFile(result.base64, mimeType, fileName);
    }

    // Unknown response shape — treat as not-implemented and try next
    continue;
  }

  // None of the handlers worked
  throw new FlutterCameraBridgeError(
    "handler_missing",
    `No working Flutter bridge handler found for source="${source}"`
  );
};

/**
 * Trigger a native <input type="file"> element programmatically.
 * Pass captureMode="camera" to add capture="environment" so mobile browsers open the camera directly.
 *
 * @param {string} inputId - ID of the hidden <input type="file"> element
 * @param {'camera'|'gallery'|null} [captureMode]
 */
export const triggerNativeFileInput = (inputId, captureMode = null) => {
  const el = document.getElementById(inputId);
  if (!el) return;
  if (captureMode === "camera") {
    el.setAttribute("capture", "environment");
  } else {
    el.removeAttribute("capture");
  }
  el.click();
};
