import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";

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

    const directIdToken = value.idToken || value.id_token || value.firebaseIdToken || value.token || "";
    const directAccessToken = value.accessToken || value.access_token || "";
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
    throw new Error("Flutter bridge not available");
  }

  const result = await bridge.callHandler("nativeGoogleSignIn");
  const { idToken, accessToken } = extractIdTokenFromResult(result);

  if (!idToken && !accessToken) {
    throw new Error("Google sign-in was cancelled or no idToken was returned");
  }

  const credential = GoogleAuthProvider.credential(idToken || null, accessToken || null);
  const signedIn = await signInWithCredential(firebaseAuth, credential);
  return signedIn?.user || null;
}

