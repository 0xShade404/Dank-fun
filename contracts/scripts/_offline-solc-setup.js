// One-time local setup: the sandboxed network only allows npm registry access, not
// binaries.soliditylang.org, so Hardhat's built-in solc downloader can never succeed here.
// This script pre-populates Hardhat's compiler cache directly from the `solc` npm package
// (which ships the full soljson.js build in its own tarball, no extra network fetch needed),
// tricking Hardhat's downloader into thinking the native binary "doesn't work" so it falls
// back to the solc-js (WASM) build we've placed by hand. Not part of the app; dev-env only.
const fs = require("fs");
const path = require("path");
const envPaths = require("env-paths");

const VERSION = "0.8.24";
const LONG_VERSION = "0.8.24+commit.e11b9ed9";

const cacheDir = envPaths("hardhat").cache;
const compilersDir = path.join(cacheDir, "compilers-v2");

const soljsonSrc = path.join(__dirname, "..", "node_modules", "solc", "soljson.js");
if (!fs.existsSync(soljsonSrc)) {
  console.error(`Expected ${soljsonSrc} to exist (run npm install first).`);
  process.exit(1);
}

// --- linux-amd64: dummy build, marked as "does not work" so Hardhat skips straight to wasm ---
const linuxDir = path.join(compilersDir, "linux-amd64");
fs.mkdirSync(linuxDir, { recursive: true });
const linuxBuildFile = `solc-linux-amd64-v${LONG_VERSION}`;
fs.writeFileSync(path.join(linuxDir, linuxBuildFile), "not a real binary");
fs.writeFileSync(path.join(linuxDir, `${linuxBuildFile}.does.not.work`), "");
fs.writeFileSync(
  path.join(linuxDir, "list.json"),
  JSON.stringify({
    builds: [
      {
        path: linuxBuildFile,
        version: VERSION,
        build: "commit.e11b9ed9",
        longVersion: LONG_VERSION,
        keccak256: "0x0000000000000000000000000000000000000000000000000000000000000000",
        urls: [],
        platform: "linux-amd64",
      },
    ],
    releases: { [VERSION]: linuxBuildFile },
    latestRelease: VERSION,
  })
);

// --- wasm: the real solc-js build, copied from the npm `solc` package ---
const wasmDir = path.join(compilersDir, "wasm");
fs.mkdirSync(wasmDir, { recursive: true });
const wasmBuildFile = `soljson-v${LONG_VERSION}.js`;
fs.copyFileSync(soljsonSrc, path.join(wasmDir, wasmBuildFile));
fs.writeFileSync(
  path.join(wasmDir, "list.json"),
  JSON.stringify({
    builds: [
      {
        path: wasmBuildFile,
        version: VERSION,
        build: "commit.e11b9ed9",
        longVersion: LONG_VERSION,
        keccak256: "0x0000000000000000000000000000000000000000000000000000000000000000",
        urls: [],
        platform: "wasm",
      },
    ],
    releases: { [VERSION]: wasmBuildFile },
    latestRelease: VERSION,
  })
);

console.log(`Offline solc ${VERSION} cache set up at ${compilersDir}`);
