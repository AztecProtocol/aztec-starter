/**
 * Verify contracts on AztecScan after deployment.
 *
 * Two-step verification:
 * 1. Artifact verification — uploads the contract artifact JSON so AztecScan can
 *    match it byte-for-byte against the on-chain bytecode.
 * 2. Instance verification — sends the deployment parameters (salt, deployer,
 *    publicKeysString, constructorArgs) so AztecScan can recompute and confirm
 *    the contract address.
 *
 * Uses raw fetch — no SDK dependency required.
 */

import type { AztecScanConfig } from "../../config/config.js";

// ── Types ───────────────────────────────────────────────────────────

export interface VerificationResult {
    ok: boolean;
    status: number;
    statusText: string;
}

export interface VerifyInstanceArgs {
    publicKeysString: string;
    deployer: string;
    salt: string;
    constructorArgs: string[];
}

// ── Artifact verification ───────────────────────────────────────────

/**
 * Verify a contract artifact (contract class) on AztecScan.
 *
 * POST /v1/{apiKey}/l2/contract-classes/{classId}/versions/{version}
 * Body: { stringifiedArtifactJson: string }
 *
 * Returns 200 if already verified, 201 if newly verified.
 */
export async function verifyArtifactOnAztecScan(
    config: AztecScanConfig,
    contractClassId: string,
    version: number,
    artifact: Record<string, unknown>,
): Promise<VerificationResult> {
    const url = `${config.apiUrl}/v1/${config.apiKey}/l2/contract-classes/${contractClassId}/versions/${version}`;

    // Handle { default: artifact } module-style exports
    const raw = "default" in artifact && typeof artifact.default === "object"
        ? artifact.default
        : artifact;

    const body = JSON.stringify({ stringifiedArtifactJson: JSON.stringify(raw) });
    const sizeMB = (new TextEncoder().encode(body).length / 1_000_000).toFixed(2);

    console.log(`[aztecscan] Verifying artifact -> POST ${url} (${sizeMB} MB)`);

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
    });

    console.log(`[aztecscan] Artifact verification: ${response.status} ${response.statusText}`);
    if (!response.ok) {
        const text = await response.text().catch(() => "(no body)");
        console.log(`[aztecscan] Artifact verification response: ${text.slice(0, 500)}`);
    }
    return { ok: response.ok, status: response.status, statusText: response.statusText };
}

// ── Instance verification ───────────────────────────────────────────

/**
 * Verify a contract instance deployment on AztecScan.
 *
 * POST /v1/{apiKey}/l2/contract-instances/{address}
 * Body: { verifiedDeploymentArguments: { salt, deployer, publicKeysString, constructorArgs, stringifiedArtifactJson? } }
 *
 * The server recomputes the contract address from the provided parameters.
 */
export async function verifyInstanceOnAztecScan(
    config: AztecScanConfig,
    contractAddress: string,
    args: VerifyInstanceArgs,
    artifact?: Record<string, unknown>,
): Promise<VerificationResult> {
    // Validate field lengths (matching server-side Zod schema)
    if (args.publicKeysString.length !== 514) {
        throw new Error(`Invalid publicKeysString length: expected 514, got ${args.publicKeysString.length}`);
    }
    if (args.deployer.length !== 66) {
        throw new Error(`Invalid deployer length: expected 66, got ${args.deployer.length}`);
    }
    if (args.salt.length !== 66) {
        throw new Error(`Invalid salt length: expected 66, got ${args.salt.length}`);
    }

    const url = `${config.apiUrl}/v1/${config.apiKey}/l2/contract-instances/${contractAddress}`;

    const verifiedDeploymentArguments: Record<string, unknown> = {
        salt: args.salt,
        deployer: args.deployer,
        publicKeysString: args.publicKeysString,
        constructorArgs: args.constructorArgs,
    };

    // Optionally include the artifact for combined verification
    if (artifact) {
        const raw = "default" in artifact && typeof artifact.default === "object"
            ? artifact.default
            : artifact;
        verifiedDeploymentArguments.stringifiedArtifactJson = JSON.stringify(raw);
    }

    const body = JSON.stringify({ verifiedDeploymentArguments });
    const sizeMB = (new TextEncoder().encode(body).length / 1_000_000).toFixed(2);

    console.log(`[aztecscan] Verifying instance -> POST ${url} (${sizeMB} MB)`);

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
    });

    console.log(`[aztecscan] Instance verification: ${response.status} ${response.statusText}`);
    if (!response.ok) {
        const text = await response.text().catch(() => "(no body)");
        console.log(`[aztecscan] Instance verification response: ${text.slice(0, 500)}`);
    }
    return { ok: response.ok, status: response.status, statusText: response.statusText };
}
