/* eslint-env node */
/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * Starts ChainForge for development, from this checkout: the Python server and
 * the React dev server together.
 *
 *   cd chainforge/react-server && npm run dev
 *
 * The React dev server (http://localhost:3000) is a different origin from the
 * Python server (http://localhost:8000), which refuses other origins unless
 * they are allowed (see chainforge/local_access.py). This starts the server
 * with `python -m chainforge serve`, allowing the dev server's origin, waits
 * until it answers, then starts the dev server with `npm run start`. Ctrl+C
 * stops both, and if either one exits, the other is stopped too.
 *
 * Optional settings:
 *   PYTHON  the Python to run the server with (default: python3; python on Windows)
 *   PORT    the React dev server's port (default: 3000)
 * Arguments after `--` go to the server, e.g. `npm run dev -- --dir /tmp/flows`.
 */
"use strict";

const { spawn, spawnSync } = require("child_process");
const http = require("http");
const path = require("path");

const REACT_DIR = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(REACT_DIR, "..", "..");
const IS_WINDOWS = process.platform === "win32";
const PYTHON = process.env.PYTHON || (IS_WINDOWS ? "python" : "python3");
const REACT_PORT = process.env.PORT || "3000";
// In development the front end always talks to this address (FLASK_BASE_URL
// in src/backend/utils.ts).
const SERVER_URL = "http://localhost:8000/";
const DEV_ORIGINS = [
  process.env.CHAINFORGE_DEV_ORIGINS,
  `http://localhost:${REACT_PORT}`,
  `http://127.0.0.1:${REACT_PORT}`,
]
  .filter(Boolean)
  .join(",");

const children = [];
let stopping = false;

/** Starts a labelled process whose output is prefixed line by line. */
function run(label, command, args, options) {
  const child = spawn(command, args, {
    ...options,
    // Its own process group, so stopping it also stops what it started
    // (npm starts webpack as a child). On Windows, taskkill /T does that.
    detached: !IS_WINDOWS,
    shell: IS_WINDOWS,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const prefix = (stream, out) => {
    let pending = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      const lines = (pending + chunk).split(/\r?\n/);
      pending = lines.pop();
      for (const line of lines) out.write(`[${label}] ${line}\n`);
    });
    stream.on("end", () => {
      if (pending) out.write(`[${label}] ${pending}\n`);
    });
  };
  prefix(child.stdout, process.stdout);
  prefix(child.stderr, process.stderr);
  child.on("error", (err) => {
    console.error(`[${label}] could not start "${command}": ${err.message}`);
    stopAll(1);
  });
  child.on("exit", (code, signal) => {
    if (stopping) return;
    console.log(
      `[${label}] exited (${signal || `code ${code}`}); stopping the other one.`,
    );
    stopAll(code || 0);
  });
  children.push(child);
  return child;
}

function exited(child) {
  return child.exitCode !== null || child.signalCode !== null;
}

function signal(child, sig) {
  if (exited(child)) return;
  try {
    if (IS_WINDOWS)
      spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"]);
    else process.kill(-child.pid, sig);
  } catch {
    // Already gone.
  }
}

function stopAll(code) {
  if (stopping) return;
  stopping = true;
  children.forEach((child) => signal(child, "SIGINT"));
  // Anything still running after a grace period is killed outright.
  setTimeout(() => {
    children.forEach((child) => signal(child, "SIGKILL"));
    process.exit(code);
  }, 5000).unref();
  Promise.all(
    children.map((child) =>
      exited(child)
        ? null
        : new Promise((resolve) => child.on("exit", resolve)),
    ),
  ).then(() => process.exit(code));
}

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));

/** Whether anything answers at the server's address. */
function serverAnswers() {
  return new Promise((resolve) => {
    const req = http.get(SERVER_URL, (res) => {
      res.resume();
      resolve(true);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(2000, () => req.destroy());
  });
}

async function waitForServer(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (stopping) return false;
    if (await serverAnswers()) return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function main() {
  if (await serverAnswers()) {
    console.error(
      `Something is already running at ${SERVER_URL}. Stop it first: ` +
        "the dev server needs this checkout's ChainForge server there.",
    );
    process.exit(1);
  }

  console.log(
    `Starting the ChainForge server from ${REPO_ROOT} (${PYTHON})...`,
  );
  run(
    "server",
    PYTHON,
    ["-m", "chainforge", "serve", ...process.argv.slice(2)],
    {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        CHAINFORGE_DEV_ORIGINS: DEV_ORIGINS,
        PYTHONUNBUFFERED: "1",
      },
    },
  );

  // The first start can be slow: RAG libraries take a while to import.
  if (!(await waitForServer(180000))) {
    if (!stopping) {
      console.error(
        `The server did not answer at ${SERVER_URL} within 3 minutes.`,
      );
      stopAll(1);
    }
    return;
  }

  console.log("The server is up. Starting the React dev server...");
  run("react", "npm", ["run", "start"], {
    cwd: REACT_DIR,
    env: { ...process.env, PORT: REACT_PORT },
  });
}

main();
