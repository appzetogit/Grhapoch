import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";

export class FlutterGoogleSignInError extends Error {
  constructor(code, message, meta = {}) {
    super(message);
    this.name = "FlutterGoogleSignInError";
    this.code = code;
    this.meta = meta;
  }
}

function getFlutterBridge() {
  if (typeof window === "undefined") return null;
  const bridge = window.flutter_inappwebview;
  if (!bridge || typeof bridge.callHandler !== "function") return null;
  return bridge;
}

export function isFlutterInAppWebView() {
  return !!getFlutterBridge();
}

function extractIdTokenFromResult(result) {
  const tryExtract = (value) => {
    if (!value) return { idToken: "", accessToken: "" };
    if (typeof value === "string") {
      // Handle JSON-string payload from Flutter bridge.
      const trimmed = value.trim();
      if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        try {
          return tryExtract(JSON.parse(trimmed));
        } catch (_) {
          return { idToken: "", accessToken: "" };
        }
      }
      // Raw token string fallback.
      return { idToken: trimmed, accessToken: "" };
    }

    if (typeof value !== "object") return { idToken: "", accessToken: "" };
    if (value.success === false || value.cancelled === true) {
      return { idToken: "", accessToken: "" };
    }

    const authObj = value.authentication || value.auth || value.googleAuth || {};
    const directIdToken =
      value.idToken ||
      value.id_token ||
      value.firebaseIdToken ||
      value.googleIdToken ||
      value.token ||
      authObj.idToken ||
      authObj.id_token ||
      "";
    const directAccessToken =
      value.accessToken ||
      value.access_token ||
      authObj.accessToken ||
      authObj.access_token ||
      "";
    if (directIdToken || directAccessToken) {
      return { idToken: directIdToken, accessToken: directAccessToken };
    }

    // Common nested payload shapes from Flutter.
    if (value.data) return tryExtract(value.data);
    if (value.result) return tryExtract(value.result);
    if (value.user) return tryExtract(value.user);
    if (value.credential) return tryExtract(value.credential);

    return { idToken: "", accessToken: "" };
  };

  return tryExtract(result);
}

export async function signInWithFlutterGoogle(firebaseAuth) {
  const bridge = getFlutterBridge();
  if (!bridge) {
    throw new FlutterGoogleSignInError("bridge_unavailable", "Flutter bridge not available");
  }

  let result;
  try {
    result = await bridge.callHandler("nativeGoogleSignIn");
  } catch (error) {
    throw new FlutterGoogleSignInError(
      "bridge_call_failed",
      "nativeGoogleSignIn bridge call failed",
      { message: error?.message || "unknown" }
    );
  }
  const { idToken, accessToken } = extractIdTokenFromResult(result);
  console.info("[FlutterGoogle] token_extracted", {
    hasIdToken: !!idToken,
    idTokenLength: idToken ? String(idToken).length : 0,
    hasAccessToken: !!accessToken,
    accessTokenLength: accessToken ? String(accessToken).length : 0
  });

  if (!idToken && !accessToken) {
    throw new FlutterGoogleSignInError(
      "missing_token",
      "Google sign-in was cancelled or no id/access token was returned",
      {
        resultType: typeof result,
        keys: result && typeof result === "object" ? Object.keys(result).slice(0, 20) : []
      }
    );
  }

  try {
    const credential = GoogleAuthProvider.credential(idToken || null, accessToken || null);
    const signedIn = await signInWithCredential(firebaseAuth, credential);
    return signedIn?.user || null;
  } catch (error) {
    throw new FlutterGoogleSignInError(
      "credential_exchange_failed",
      error?.message || "Firebase credential exchange failed",
      { message: error?.message || "unknown" }
    );
  }
}

