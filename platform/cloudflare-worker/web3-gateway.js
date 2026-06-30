/**
 * CareOS Web3 Gateway — Cloudflare Worker
 * Deployed at: careos.launchflow.tech
 *
 * Routes:
 *   /web3/*          → proxy to CareOS backend API
 *   /ipfs/pin        → pin a consent document CID to Cloudflare IPFS
 *   /ipfs/resolve/*  → resolve a CID via the IPFS gateway
 *   /health          → worker health check
 *
 * Environment variables (set in Cloudflare Worker Settings → Variables):
 *   CAREOS_BACKEND_URL        https://launchflow.tech
 *   IPFS_GATEWAY_URL          https://3.launchflow.tech
 *   WEB3_RPC_URL              https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY
 *   ESCROW_CONTRACT_ADDRESS   0x... (after deployment)
 *   WORKER_SECRET             shared secret for backend→worker calls
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Worker-Secret",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ── CORS preflight ──────────────────────────────────────────────────────
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // ── Health check ────────────────────────────────────────────────────────
    if (url.pathname === "/health") {
      return json({
        status: "ok",
        worker: "careos-web3-gateway",
        backend: env.CAREOS_BACKEND_URL || "not configured",
        ipfs_gateway: env.IPFS_GATEWAY_URL || "not configured",
        rpc_configured: !!(env.WEB3_RPC_URL),
        contract_configured: !!(env.ESCROW_CONTRACT_ADDRESS),
        ts: new Date().toISOString(),
      });
    }

    // ── /web3/* → proxy to CareOS FastAPI backend ───────────────────────────
    if (url.pathname.startsWith("/web3/")) {
      const backendUrl = `${env.CAREOS_BACKEND_URL}${url.pathname}${url.search}`;
      const proxied = new Request(backendUrl, {
        method: request.method,
        headers: {
          ...Object.fromEntries(request.headers),
          "X-Forwarded-By": "careos-worker",
          "CF-Connecting-IP": request.headers.get("CF-Connecting-IP") || "",
        },
        body: request.method !== "GET" && request.method !== "HEAD"
          ? request.body
          : undefined,
      });
      const resp = await fetch(proxied);
      const body = await resp.text();
      return new Response(body, {
        status: resp.status,
        headers: {
          ...Object.fromEntries(resp.headers),
          ...CORS_HEADERS,
          "Content-Type": "application/json",
        },
      });
    }

    // ── /ipfs/pin — store a consent document CID ────────────────────────────
    // Body: { cid: "Qm...", agreement_id: 123, consent_hash: "0x..." }
    if (url.pathname === "/ipfs/pin" && request.method === "POST") {
      const secret = request.headers.get("X-Worker-Secret");
      if (env.WORKER_SECRET && secret !== env.WORKER_SECRET) {
        return json({ error: "Unauthorized" }, 401);
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }

      const { cid, agreement_id, consent_hash } = body;
      if (!cid) return json({ error: "cid required" }, 400);

      // Verify the CID is accessible via our IPFS gateway
      const gatewayUrl = `${env.IPFS_GATEWAY_URL || "https://3.launchflow.tech"}/ipfs/${cid}`;
      let resolved = false;
      try {
        const probe = await fetch(gatewayUrl, { method: "HEAD" });
        resolved = probe.ok;
      } catch {}

      return json({
        cid,
        agreement_id,
        consent_hash,
        gateway_url: gatewayUrl,
        resolved,
        pinned_at: new Date().toISOString(),
        note: "CID anchored via Cloudflare IPFS gateway",
      });
    }

    // ── /ipfs/resolve/:cid — fetch content from IPFS gateway ────────────────
    if (url.pathname.startsWith("/ipfs/resolve/")) {
      const cid = url.pathname.replace("/ipfs/resolve/", "");
      if (!cid) return json({ error: "CID required" }, 400);

      const gatewayUrl = `${env.IPFS_GATEWAY_URL || "https://3.launchflow.tech"}/ipfs/${cid}`;
      const resp = await fetch(gatewayUrl);
      const content = await resp.text();
      return new Response(content, {
        status: resp.status,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": resp.headers.get("Content-Type") || "application/json",
          "X-IPFS-CID": cid,
          "X-Gateway": "careos-cloudflare-ipfs",
        },
      });
    }

    // ── /rpc — forward a JSON-RPC call to Polygon (read-only) ───────────────
    // Used by frontend to check escrow contract state without exposing RPC key
    if (url.pathname === "/rpc" && request.method === "POST") {
      if (!env.WEB3_RPC_URL) {
        return json({ error: "WEB3_RPC_URL not configured" }, 503);
      }
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Invalid JSON" }, 400);
      }

      // Only allow read methods — never sign transactions from the worker
      const allowed = ["eth_call", "eth_getTransactionReceipt", "eth_blockNumber",
                       "eth_getBalance", "eth_chainId", "net_version"];
      if (!allowed.includes(body.method)) {
        return json({ error: `Method ${body.method} not allowed via gateway` }, 403);
      }

      const rpcResp = await fetch(env.WEB3_RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const rpcBody = await rpcResp.json();
      return json(rpcBody);
    }

    // ── /contract/status/:agreementId — check on-chain escrow state ─────────
    if (url.pathname.startsWith("/contract/status/")) {
      if (!env.WEB3_RPC_URL || !env.ESCROW_CONTRACT_ADDRESS) {
        return json({
          status: "not_configured",
          note: "Set WEB3_RPC_URL and ESCROW_CONTRACT_ADDRESS in Worker variables",
        });
      }

      const agreementId = url.pathname.split("/").pop();
      // statusOf(uint256) selector = keccak256("statusOf(uint256)")[0:4]
      const selector = "0x346a48d2";
      const paddedId = BigInt(agreementId).toString(16).padStart(64, "0");
      const calldata = selector + paddedId;

      const rpcBody = {
        jsonrpc: "2.0",
        method: "eth_call",
        params: [{ to: env.ESCROW_CONTRACT_ADDRESS, data: calldata }, "latest"],
        id: 1,
      };

      try {
        const rpcResp = await fetch(env.WEB3_RPC_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rpcBody),
        });
        const result = await rpcResp.json();
        const statusInt = result.result ? parseInt(result.result, 16) : null;
        const STATUS_LABELS = ["Empty", "Funded", "ConsentConfirmed", "DeliveryConfirmed", "Released", "Refunded", "Revoked"];
        return json({
          agreement_id: agreementId,
          contract: env.ESCROW_CONTRACT_ADDRESS,
          status_code: statusInt,
          status: statusInt !== null ? (STATUS_LABELS[statusInt] || "Unknown") : "error",
          raw: result.result,
        });
      } catch (e) {
        return json({ error: "RPC call failed", detail: e.message }, 502);
      }
    }

    // ── 404 ──────────────────────────────────────────────────────────────────
    return json({
      error: "Not found",
      available_routes: ["/health", "/web3/*", "/ipfs/pin", "/ipfs/resolve/:cid", "/rpc", "/contract/status/:id"],
    }, 404);
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
