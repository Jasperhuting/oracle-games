// Passkey (WebAuthn) utility functions

export interface PasskeyCredential {
  id: string;
  publicKey: string;
  counter: number;
}

// Check if browser supports WebAuthn
export function isPasskeySupported(): boolean {
  return (
    window?.PublicKeyCredential !== undefined &&
    navigator?.credentials?.create !== undefined
  );
}

// Create a new passkey credential
export async function createPasskey(
  email: string,
  displayName: string,
  userId: string
): Promise<{ credentialId: string; publicKey: string; challenge: string }> {
  if (!isPasskeySupported()) {
    throw new Error('Passkeys worden niet ondersteund in deze browser');
  }

  // Get challenge from server
  const challengeResponse = await fetch('/api/passkey/challenge', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId,
      type: 'registration',
    }),
  });

  if (!challengeResponse.ok) {
    throw new Error('Kon challenge niet ophalen van server');
  }

  const { challenge: challengeBase64 } = await challengeResponse.json();
  const challenge = base64ToArrayBuffer(challengeBase64);

  const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
    challenge,
    rp: {
      name: 'Oracle Games',
      id: window.location.hostname,
    },
    user: {
      id: new TextEncoder().encode(email),
      name: email,
      displayName: displayName,
    },
    pubKeyCredParams: [
      { alg: -7, type: 'public-key' }, // ES256
      { alg: -257, type: 'public-key' }, // RS256
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      requireResidentKey: true,
      residentKey: 'required',
      userVerification: 'required',
    },
    timeout: 60000,
    attestation: 'none',
  };

  try {
    const credential = (await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions,
    })) as PublicKeyCredential;

    if (!credential) {
      throw new Error('Geen credential aangemaakt');
    }

    const response = credential.response as AuthenticatorAttestationResponse;
    
    // Convert credential ID to base64
    const credentialId = arrayBufferToBase64(credential.rawId);
    
    // Get public key from attestation object
    const publicKey = arrayBufferToBase64(response.getPublicKey()!);

    return { credentialId, publicKey, challenge: challengeBase64 };
  } catch (error: unknown) {
    console.error('Error creating passkey:', error);
    if (error && typeof error === 'object' && 'name' in error && error.name === 'NotAllowedError') {
      throw new Error('Passkey aanmaken geannuleerd');
    }
    throw new Error('Kon passkey niet aanmaken');
  }
}

// Authenticate with existing passkey
export async function authenticateWithPasskey(): Promise<{
  credentialId: string;
  signature: string;
  authenticatorData: string;
  clientDataJSON: string;
  challenge: string;
  challengeId: string;
}> {
  if (!isPasskeySupported()) {
    throw new Error('Passkeys worden niet ondersteund in deze browser');
  }

  // Get challenge from server (no userId needed for authentication)
  const challengeResponse = await fetch('/api/passkey/challenge', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'authentication',
    }),
  });

  if (!challengeResponse.ok) {
    throw new Error('Kon challenge niet ophalen van server');
  }

  const { challenge: challengeBase64, challengeId } = await challengeResponse.json();
  const challenge = base64ToArrayBuffer(challengeBase64);

  const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
    challenge,
    timeout: 60000,
    rpId: window.location.hostname,
    userVerification: 'required',
  };

  try {
    const credential = (await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions,
    })) as PublicKeyCredential;

    if (!credential) {
      throw new Error('Geen credential gevonden');
    }

    const response = credential.response as AuthenticatorAssertionResponse;

    return {
      credentialId: arrayBufferToBase64(credential.rawId),
      signature: arrayBufferToBase64(response.signature),
      authenticatorData: arrayBufferToBase64(response.authenticatorData),
      clientDataJSON: arrayBufferToBase64(response.clientDataJSON),
      challenge: challengeBase64,
      challengeId,
    };
  } catch (error: unknown) {
    console.error('Error authenticating with passkey:', error);
    if (error && typeof error === 'object' && 'name' in error && error.name === 'NotAllowedError') {
      throw new Error('Passkey authentication cancelled');
    }
    throw new Error('Could not log in with passkey');
  }
}

// Helper function to convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper function to convert base64url to standard base64
function base64urlToBase64(base64url: string): string {
  // Replace URL-safe characters with standard base64 characters
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  const padding = base64.length % 4;
  if (padding > 0) {
    base64 += '='.repeat(4 - padding);
  }
  return base64;
}

// Helper function to convert base64 to ArrayBuffer
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  // Convert base64url to standard base64 if needed
  const standardBase64 = base64urlToBase64(base64);
  const binary = atob(standardBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
