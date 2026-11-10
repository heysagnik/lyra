import { describe, it, expect, vi } from "vitest";
import { verifyWorkerRequest } from "./verify";
import { getEnv } from "@/lib/env";
import * as qstashModule from "@upstash/qstash";

describe("Worker Signature & Secret Verification", () => {
  it("authenticates worker requests with correct x-worker-secret", async () => {
    const env = getEnv();
    const req = new Request("http://localhost:3000/api/workers/summarize", {
      method: "POST",
      headers: {
        "x-worker-secret": env.WORKER_SECRET,
      },
      body: JSON.stringify({ test: true }),
    });

    const isVerified = await verifyWorkerRequest(req, JSON.stringify({ test: true }));
    expect(isVerified).toBe(true);
  });

  it("rejects worker requests with invalid secret and missing signature", async () => {
    const req = new Request("http://localhost:3000/api/workers/summarize", {
      method: "POST",
      headers: {
        "x-worker-secret": "wrong-secret-value",
      },
      body: JSON.stringify({ test: true }),
    });

    const isVerified = await verifyWorkerRequest(req, JSON.stringify({ test: true }));
    expect(isVerified).toBe(false);
  });

  it("verifies request with valid QStash signature", async () => {
    vi.spyOn(qstashModule.Receiver.prototype, "verify").mockResolvedValueOnce(true);

    const req = new Request("http://localhost:3000/api/workers/summarize", {
      method: "POST",
      headers: {
        "upstash-signature": "valid-sig-123",
      },
      body: JSON.stringify({ test: true }),
    });

    const isVerified = await verifyWorkerRequest(req, JSON.stringify({ test: true }));
    expect(isVerified).toBe(true);
  });

  it("rejects request when QStash receiver throws error", async () => {
    vi.spyOn(qstashModule.Receiver.prototype, "verify").mockRejectedValueOnce(
      new Error("Invalid cryptographic signature")
    );

    const req = new Request("http://localhost:3000/api/workers/summarize", {
      method: "POST",
      headers: {
        "upstash-signature": "corrupted-sig",
      },
      body: JSON.stringify({ test: true }),
    });

    const isVerified = await verifyWorkerRequest(req, JSON.stringify({ test: true }));
    expect(isVerified).toBe(false);
  });
});

