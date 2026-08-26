import { readFile } from "node:fs/promises";
import path from "node:path";
import type { InterfaceAbi } from "ethers";
import { projectRoot } from "../attestcoin/paths.js";
import { ProtocolCommandError } from "./errors.js";

interface FoundryArtifact {
  abi: InterfaceAbi;
  bytecode: { object: string };
}

export async function loadContractArtifact(name: string): Promise<FoundryArtifact> {
  const artifactPath = path.join(projectRoot, "out", `${name}.sol`, `${name}.json`);
  try {
    const parsed = JSON.parse(await readFile(artifactPath, "utf8")) as FoundryArtifact;
    if (!Array.isArray(parsed.abi) || !parsed.bytecode?.object) throw new Error("artifact has no ABI or bytecode");
    return parsed;
  } catch (error) {
    throw new ProtocolCommandError(
      "Loading contract artifacts",
      `Could not load ${name}: ${error instanceof Error ? error.message : String(error)}.`,
      "Run pnpm protocol:build before deploying or inspecting.",
    );
  }
}
