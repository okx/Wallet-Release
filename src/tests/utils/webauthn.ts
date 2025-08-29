import * as crypto from "crypto";

// Helper functions to create enum instances that match Anchor IDL format
export const WebAuthnStringHelpers = {
  Direct: (value: string) => ({ direct: [value] }),
  Index: (value: number[]) => ({ index: [value] }),
};

export const WebAuthnAuthDataHelpers = {
  Direct: (value: Buffer) => ({ direct: [Array.from(value)] }),
  Index: (value: number) => ({ index: [value] }),
};

export function buildWebauthnMessage(
  challenge: string,
  origin: string,
  androidPackageName?: string
) {
  // 1. build authData
  const authData = buildAuthData(origin);

  // 2. build clientDataJSON
  const clientJson = {
    type: "webauthn.get",
    challenge,
    origin,
    ...(androidPackageName ? { androidPackageName } : {}),
  };
  const clientDataJSON = new TextEncoder().encode(JSON.stringify(clientJson));

  // 3. build message
  // message = SHA256(authData || SHA256(clientDataJSON))
  const clientHash = crypto
    .createHash("sha256")
    .update(clientDataJSON)
    .digest();
  const message = crypto
    .createHash("sha256")
    .update(Buffer.concat([authData, clientHash]))
    .digest();

  return { message, authData, clientJson: JSON.stringify(clientJson) };
}

export function buildAuthData(origin: string) {
  const rpIdHash = crypto.createHash("sha256").update(origin).digest(); // 32B
  const flags = Buffer.from([0x01]); // user present
  const signCount = Buffer.alloc(4); // 0
  const authData = Buffer.concat([rpIdHash, flags, signCount]);
  return authData;
}
