
export class FlutterCameraBridgeError extends Error {
  constructor(code, message, meta = {}) {
    super(message);
    this.name = "FlutterCameraBridgeError";
    this.code = code;
    this.meta = meta;
  }
}

/**
 * Checks if the app is running inside a Flutter InAppWebView with the required bridge.
 */
export const hasFlutterCameraBridge = () => {
  if (typeof window === "undefined") return false;
  return !!(window.flutter_inappwebview && typeof window.flutter_inappwebview.callHandler === "function");
};

/**
 * Converts a base64 string to a File object.
 */
export const base64ToFile = (base64Input, mimeType = "image/jpeg", fileName = `capture-${Date.now()}.jpg`) => {
  let normalized = base64Input || "";
  if (normalized.includes(",")) {
    normalized = normalized.split(",")[1];
  }

  const base64Data = normalized.replace(/\s/g, '');
  const byteCharacters = atob(base64Data);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  const blob = new Blob(byteArrays, { type: mimeType });
  return new File([blob], fileName, { type: mimeType });
};

/**
 * Calls the Flutter bridge to open camera or gallery and returns a File object.
 */
export const requestImageFileFromFlutter = async ({
  source = "camera",
  fileNamePrefix = "capture",
  quality = 0.8
} = {}) => {
  if (!hasFlutterCameraBridge()) {
    throw new FlutterCameraBridgeError("bridge_unavailable", "Flutter bridge not available");
  }

  const payload = {
    source, // 'camera' or 'gallery'
    accept: "image/*",
    multiple: false,
    quality
  };

  const tryHandler = async (handlerName) => {
    try {
      return await window.flutter_inappwebview.callHandler(handlerName, payload);
    } catch (err) {
      return null;
    }
  };

  let result = null;
  let handlerFound = false;
  
  const handlersToTry = source === "gallery" 
    ? ["openGallery", "pickFromGallery", "openMediaPicker"]
    : ["openCamera", "takePhoto", "captureImage"];

  for (const handlerName of handlersToTry) {
    try {
      // Check if handler exists (some versions of inappwebview allow this)
      // or just try calling it.
      result = await window.flutter_inappwebview.callHandler(handlerName, payload);
      handlerFound = true;
      break;
    } catch (err) {
      // If error indicates handler not found, continue to next
      continue;
    }
  }

  if (!handlerFound) {
    throw new FlutterCameraBridgeError("handler_missing", `No bridge handler found for ${source}`);
  }

  if (!result || result.success !== true) {
    // User cancelled or Flutter side error
    return null;
  }

  // Expecting base64 from the bridge
  if (!result.base64) {
    console.warn("Flutter bridge returned success but no base64 data");
    return null;
  }

  const mimeType = result.mimeType || "image/jpeg";
  const fileName = result.fileName || `${fileNamePrefix}-${Date.now()}.jpg`;
  
  return base64ToFile(result.base64, mimeType, fileName);
};
