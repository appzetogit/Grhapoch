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
  if (!result) return "";
  if (typeof result === "string") return result;
  if (typeof result === "object") {
    if (result.success === false) return "";
    return result.idToken || result.id_token || result.token || "";
  }
  return "";
}

export async function signInWithFlutterGoogle(firebaseAuth) {
  const bridge = getFlutterBridge();
  if (!bridge) {
    throw new Error("Flutter bridge not available");
  }

  const result = await bridge.callHandler("nativeGoogleSignIn");
  const idToken = extractIdTokenFromResult(result);

  if (!idToken) {
    throw new Error("Google sign-in was cancelled or no idToken was returned");
  }

  const credential = GoogleAuthProvider.credential(idToken);
  const signedIn = await signInWithCredential(firebaseAuth, credential);
  return signedIn?.user || null;
}

