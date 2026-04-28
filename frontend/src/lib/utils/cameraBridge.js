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

  try {
    return new File([new Blob(byteArrays, { type: mimeType })], fileName, { type: mimeType });
  } catch (err) {
    console.warn("[cameraBridge] File constructor failed, using Blob fallback:", err);
    // Fallback for older environments
    const blob = new Blob(byteArrays, { type: mimeType });
    // Add properties that File would have
    Object.defineProperty(blob, 'name', { value: fileName, writable: false });
    Object.defineProperty(blob, 'lastModified', { value: Date.now(), writable: false });
    return blob;
  }
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
  handlerTimeoutMs = 300000,  // 5 minutes — taking/picking photos takes human time
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
    } catch (error) {
      // Handler threw / timed out → not implemented, try next one
      console.warn(`[cameraBridge] Handler "${handlerName}" failed/timed out:`, error?.message || error);
      continue;
    }

    // Handler responded — it IS implemented.
    console.log(`[cameraBridge] Handler "${handlerName}" responded successfully`);

    if (result === null || result === undefined) {
      console.log(`[cameraBridge] Handler "${handlerName}" returned null/undefined, trying next name`);
      continue;
    }

    // CASE 1: Raw base64 string response
    if (typeof result === "string" && (result.length > 50 || result.startsWith("data:image"))) {
      console.log(`[cameraBridge] Handler "${handlerName}" returned raw base64 string (len: ${result.length})`);
      return base64ToFile(result, "image/jpeg", `${fileNamePrefix}-${Date.now()}.jpg`);
    }

    // CASE 2: Standard object response { success, base64, ... }
    if (typeof result === "object") {
      // Check for cancellation or failure
      if (result.cancelled === true || result.success === false) {
        console.log(`[cameraBridge] Handler "${handlerName}" reported cancellation/failure (success: ${result.success})`);
        return null;
      }

      // Success — extract the image (check multiple common field names)
      const base64Data = result.base64 || result.data || result.image || result.fileData || result.imageData || result.fileContent;
      
      if (result.success === true || base64Data) {
        if (!base64Data) {
          console.warn(`[cameraBridge] Handler "${handlerName}" returned success=true but no base64 data found. Keys:`, Object.keys(result));
          continue; 
        }
        
        const mimeType = result.mimeType || result.contentType || result.type || "image/jpeg";
        const fileName = result.fileName || result.name || `${fileNamePrefix}-${Date.now()}.jpg`;
        
        console.log(`[cameraBridge] Success! Creating file from base64 (MIME: ${mimeType}, Name: ${fileName})`);
        return base64ToFile(base64Data, mimeType, fileName);
      }
    }

    console.warn(`[cameraBridge] Handler "${handlerName}" returned unrecognized response shape:`, typeof result);
    continue;
  }

    // Unknown response shape — treat as not-implemented and try next
    console.warn(`[cameraBridge] Handler "${handlerName}" returned unknown response shape:`, typeof result);
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
