import { copyFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor < 20) {
  console.error(`Node.js 20 or newer is required. You are using ${process.version}.`);
  process.exit(1);
}

if (!existsSync(".env")) {
  copyFileSync(".env.example", ".env");
  console.log("Created .env from .env.example.");
  console.log("If your PostgreSQL password is not \"postgres\", edit DATABASE_URL before continuing.\n");
}

console.log("Installing packages...\n");
execSync("npm install", { stdio: "inherit" });

console.log("\nCreating the game tables...\n");
try {
  execSync("npx drizzle-kit push", { stdio: "inherit" });
} catch {
  console.error("\nThe database step failed. PostgreSQL must already be running and the database in DATABASE_URL must exist.");
  console.error("Create it, then run this setup again. Example:");
  console.error("  createdb gacha_debt");
  process.exit(1);
}

console.log("\nSetup complete. Start the game with:\n  npm run dev\nThen open http://localhost:3000\n");
