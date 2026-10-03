import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import { Wallet } from "ethers";

const amountBaseUnits = "10000000000000000";
const chainId = 9182;
const types = {
  AirdropIntent: [
    { name: "action", type: "string" },
    { name: "audience", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "recipient", type: "address" },
    { name: "amountBaseUnits", type: "uint256" },
    { name: "nonce", type: "bytes32" },
    { name: "deadline", type: "uint256" },
  ],
};

function required(name) {
  const value = process.env[name]?.trim();
  if (!value || value.startsWith("REPLACE_") || value.includes("REPLACE_WITH")) {
    throw new Error("Set " + name + " in your local .env file.");
  }
  return value;
}

function apiUrl() {
  const value = required("BRIVON_API_BASE_URL");
  const url = new URL(value);
  const isLocalHttp = url.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.protocol !== "https:" && !isLocalHttp) {
    throw new Error("BRIVON_API_BASE_URL must use HTTPS (HTTP is allowed only for localhost).");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("BRIVON_API_BASE_URL must not contain credentials, a query, or a fragment.");
  }
  return url;
}

async function readJson(response) {
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > 64 * 1024) throw new Error("The API response was too large.");
  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error("The API returned an invalid JSON response.");
  }
  if (!response.ok) {
    const message = payload?.error?.message ?? "The faucet request could not be completed.";
    throw new Error(response.status + " " + message);
  }
  return payload;
}

async function main() {
  const baseUrl = apiUrl();
  const apiAudience = required("BRIVON_API_AUDIENCE").replace(/\/$/, "");
  let audienceUrl;
  try {
    audienceUrl = new URL(apiAudience);
  } catch {
    throw new Error("BRIVON_API_AUDIENCE must be an HTTPS origin.");
  }
  if (audienceUrl.protocol !== "https:" || audienceUrl.origin !== baseUrl.origin ||
      audienceUrl.pathname !== "/" || audienceUrl.search || audienceUrl.hash) {
    throw new Error("BRIVON_API_AUDIENCE must be an HTTPS origin.");
  }
  const publicAppKey = required("BRIVON_PUBLIC_APP_KEY");
  const wallet = new Wallet(required("FAUCET_WALLET_PRIVATE_KEY"));

  const intent = {
    action: "airdrop",
    audience: apiAudience,
    chainId,
    recipient: wallet.address,
    amountBaseUnits,
    nonce: "0x" + randomBytes(32).toString("hex"),
    deadline: Math.floor(Date.now() / 1000) + 300,
  };
  const domain = { name: "Brivon Settlement", version: "1", chainId };
  const signature = await wallet.signTypedData(domain, types, intent);

  console.log(JSON.stringify({
    mode: process.argv.includes("--submit") ? "submit" : "preview",
    network: "Brivon Testnet",
    chainId,
    recipient: wallet.address,
    amountBaseUnits,
    deadline: intent.deadline,
  }, null, 2));

  if (!process.argv.includes("--submit")) {
    console.log("Preview only. Add --submit to send this signed testnet request.");
    return;
  }

  const endpoint = new URL("/v1/faucet/requests", baseUrl);
  const proof = { intent, signature };
  const response = await fetch(endpoint, {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-API-Key": publicAppKey,
      "Idempotency-Key": randomUUID(),
    },
    body: JSON.stringify(proof),
  });
  const created = await readJson(response);
  const requestId = created?.data?.id;
  if (typeof requestId !== "string") {
    throw new Error("The API accepted no recognizable Airdrop request.");
  }

  const statusEndpoint = new URL(
    "/v1/faucet/requests/" + encodeURIComponent(requestId),
    baseUrl,
  );
  const ownerProof = Buffer.from(JSON.stringify(proof)).toString("base64url");
  const statusResponse = await fetch(statusEndpoint, {
    signal: AbortSignal.timeout(15_000),
    headers: {
      Accept: "application/json",
      "X-API-Key": publicAppKey,
      "X-Brivon-Owner-Proof": ownerProof,
    },
  });
  const status = await readJson(statusResponse);
  console.log(JSON.stringify(status.data, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "The request failed.");
  process.exitCode = 1;
});
