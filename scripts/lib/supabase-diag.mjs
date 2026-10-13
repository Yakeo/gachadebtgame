// Shared, secret-safe diagnostics for the Supabase / GitHub Actions deploy.
//
// Nothing in this module ever prints a connection string, a password, or a
// Supabase project ref. It only reports *shape* facts (is it a pooler host?
// which port? is the password URL-encoded?) plus Postgres error codes, so the
// output is safe to show in a public repository's Actions log.
//
// Used by:
//   scripts/diagnose-supabase.mjs        (manual / preflight report)
//   scripts/apply-supabase-schema.mjs    (fails with an actionable message)

export const SUPABASE_TABLES = ["auth_limits", "game_saves", "game_sessions", "game_users"];

// Text that means "this is still the example from .env.example".
const PLACEHOLDERS = [
  "[YOUR-PASSWORD]",
  "YOUR_PROJECT_REF",
  "YOUR_REGION",
  "<region>",
  "<ref>",
  "<password>",
  "<project-ref>",
  "<project>",
];

/** Escape a value for a GitHub Actions workflow command (`::error::...`). */
export function ghEscape(value) {
  return String(value ?? "")
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A");
}

/** Emit a GitHub Actions annotation (shows on the run page; readable via API). */
export function annotate(level, title, message) {
  const line = `::${level} title=${ghEscape(title)}::${ghEscape(message)}`;
  process.stdout.write(`${line}\n`);
}

/**
 * Strip anything sensitive out of arbitrary text (e.g. a pg error message).
 * `url` is the connection string the error came from, if known.
 */
export function redact(text, url) {
  let out = String(text ?? "");
  if (url) {
    const creds = splitCredentials(url);
    if (creds?.password) out = out.replaceAll(creds.password, "***");
    if (creds?.user && creds.user.length > 8) out = out.replaceAll(creds.user, "postgres.<ref>");
  }
  // Any connection string that leaked into the message.
  out = out.replace(/postgres(?:ql)?:\/\/\S+/gi, "postgresql://<redacted>");
  // Bare Supabase project refs (20 lowercase alphanumerics).
  out = out.replace(/\b[a-z0-9]{20}\b/g, "<ref>");
  return out;
}

/** Pull `user`/`password` out of a URL string without throwing on odd input. */
export function splitCredentials(raw) {
  const schemeAt = raw.indexOf("://");
  if (schemeAt < 0) return null;
  const rest = raw.slice(schemeAt + 3);
  const at = rest.lastIndexOf("@");
  if (at < 0) return null;
  const creds = rest.slice(0, at);
  const colon = creds.indexOf(":");
  if (colon < 0) return { user: creds, password: "" };
  return { user: creds.slice(0, colon), password: creds.slice(colon + 1) };
}

// Characters that break a URL's userinfo section. `%` is included because a
// lone percent sign (not followed by two hex digits) is an invalid escape.
const UNENCODED = /[/@#?%[\]{}|^`\\ "<>]/;
const ENCODE_HINT = { "@": "%40", "#": "%23", "/": "%2F", "?": "%3F", ":": "%3A", "%": "%25", " ": "%20" };

/**
 * Host + port of a Postgres URL, tolerating forms `new URL()` rejects but pg
 * accepts — most importantly unix-socket targets such as
 * `postgresql://user:pw@/db?host=/var/run/postgresql`.
 *
 * @returns {{host:string, port:number, tolerant:boolean}|null} null if the value
 *          does not look like `scheme://...` at all.
 */
export function hostOf(raw) {
  const value = String(raw ?? "").trim();
  if (!/^[a-z0-9+.-]+:\/\//i.test(value)) return null;

  try {
    const parsed = new URL(value);
    return { host: parsed.hostname.toLowerCase(), port: parsed.port ? Number(parsed.port) : 5432, tolerant: false };
  } catch {
    // Everything after the last "@" is the host, minus a trailing ":port".
    const authority = /^[a-z0-9+.-]+:\/\/([^/?#]*)/i.exec(value)?.[1] ?? "";
    const afterCreds = authority.slice(authority.lastIndexOf("@") + 1);
    const portMatch = /:(\d+)$/.exec(afterCreds);
    const host = (portMatch ? afterCreds.slice(0, -portMatch[1].length - 1) : afterCreds)
      .replace(/^\[|\]$/g, "")
      .toLowerCase();
    return { host, port: portMatch ? Number(portMatch[1]) : 5432, tolerant: true };
  }
}

/**
 * TLS options for a connection string, matching src/db/index.ts: an explicit
 * sslmode wins, Supabase hosts force TLS (its pooler URL's `?sslmode=require`
 * is downgraded by some pg versions), and anything else — a local Postgres, a
 * self-hosted server — is left to pg's default so it is not broken.
 *
 * @returns {false|{rejectUnauthorized:boolean}|undefined}
 */
export function sslFor(raw) {
  const mode = /[?&]sslmode=([a-z-]+)/i.exec(String(raw ?? ""))?.[1]?.toLowerCase();
  if (mode === "disable") return false;
  if (mode === "require" || mode === "prefer" || mode === "allow" || mode === "verify-ca" || mode === "verify-full") {
    return { rejectUnauthorized: false };
  }
  const { host } = hostOf(raw) ?? {};
  if (host && (host.endsWith(".supabase.co") || host.endsWith(".supabase.com"))) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

/**
 * Describe a connection string without revealing it.
 *
 * @param raw   the value of the secret
 * @param role  "ddl"     -> must be able to run DDL (Session pooler, :5432)
 *              "runtime" -> used by the app (Transaction pooler, :6543)
 * @returns {{present:boolean, ok:boolean, problems:string[], notes:string[]}}
 */
export function classifyUrl(raw, { role = "runtime", label = "connection string" } = {}) {
  const problems = [];
  const notes = [];
  const value = (raw ?? "").trim();

  if (!value) {
    problems.push(
      `${label} is empty. Either no repository secret exists under this exact name, it was saved with no ` +
        `value, or it is an *environment* secret (Settings -> Environments) while the workflow expects a ` +
        `repository secret (Settings -> Secrets and variables -> Actions).`,
    );
    return { present: false, ok: false, problems, notes };
  }

  for (const placeholder of PLACEHOLDERS) {
    if (value.includes(placeholder)) {
      problems.push(
        `value still contains the example placeholder ${placeholder} — replace it with your real password/region/project ref.`,
      );
    }
  }

  const creds = splitCredentials(value);
  if (creds?.password) {
    // Ignore valid percent-escapes when looking for characters that break the URL.
    const rawPassword = creds.password.replace(/%[0-9A-Fa-f]{2}/g, "");
    const found = UNENCODED.exec(rawPassword);
    if (found) {
      const ch = found[0];
      const encoded = ENCODE_HINT[ch] ?? `%${ch.charCodeAt(0).toString(16).toUpperCase()}`;
      problems.push(
        `the database password contains an unencoded ${JSON.stringify(ch)} character. ` +
          `URL-encode it as ${encoded} (e.g. "@" becomes %40, "/" becomes %2F), or change the ` +
          `Supabase password to letters and digits only.`,
      );
    }
  }

  const schemeMatch = /^([a-z0-9+.-]+):\/\//i.exec(value);
  if (!schemeMatch) {
    problems.push(
      "not a parseable URL. It must start with postgresql:// — by far the most common cause is an unencoded special character in the database password.",
    );
    return { present: true, ok: false, problems, notes };
  }
  if (!/^postgres(ql)?:$/i.test(schemeMatch[1] + ":")) {
    problems.push(`scheme is "${schemeMatch[1]}://" but must be postgresql://.`);
  }

  const { host, port, tolerant } = hostOf(value);
  if (tolerant) {
    notes.push("parsed with the tolerant parser (pg accepts forms `new URL()` rejects, e.g. `?host=` directories).");
  }

  const localTargets = { "": "has no host (a unix-socket / ?host= connection string)", localhost: "points at localhost", "127.0.0.1": "points at localhost", "::1": "points at localhost" };
  if (Object.hasOwn(localTargets, host)) {
    // Legitimate for local development, fatal on a GitHub runner.
    const message = `${localTargets[host]}, which a GitHub runner cannot reach`;
    if (process.env.CI) {
      problems.push(`${message} — use your Supabase pooler host (see DEPLOYMENT.md §1a).`);
    } else {
      notes.push(`${message} — expected for local development.`);
    }
  } else if (/^db\.[a-z0-9-]+\.supabase\.co$/i.test(host)) {
    problems.push(
      "this is the DIRECT connection host (db.<ref>.supabase.co). It is IPv6-only, so GitHub runners (IPv4-only) fail with ENOTFOUND / EHOSTUNREACH. Use the Session pooler instead: postgres.<ref>@aws-<n>-<region>.pooler.supabase.com:5432.",
    );
  } else if (host.endsWith(".pooler.supabase.com")) {
    notes.push("host is a Supabase pooler (aws-<n>-<region>.pooler.supabase.com) — reachable from GitHub runners.");
    if (role === "ddl" && port === 6543) {
      problems.push(
        "port 6543 is the Transaction pooler, and it cannot run DDL (CREATE TABLE / ALTER TABLE). The schema step needs the Session pooler on port 5432.",
      );
    }
    if (role === "runtime" && port === 5432) {
      notes.push(
        "port 5432 is the Session pooler: it works, but the app should normally use the Transaction pooler on 6543 so many serverless instances share Supabase's connection limit.",
      );
    }
    if (port !== 5432 && port !== 6543) {
      notes.push(`unusual pooler port ${port} (Supabase uses 6543 transaction / 5432 session).`);
    }
    if (!(splitCredentials(value)?.user ?? "").includes(".")) {
      problems.push(
        `pooler usernames must be postgres.<project-ref> (got a username without the .<ref> suffix) — the plain "postgres" user only exists on the direct host.`,
      );
    }
  } else {
    notes.push(`host does not look like *.supabase.com / *.pooler.supabase.com (self-hosted or custom proxy?).`);
  }

  const encoding = value.match(/sslmode=([a-z]+)/i);
  if (!encoding) {
    notes.push("no ?sslmode=... in the URL; the app and the schema script force TLS for Supabase hosts anyway.");
  }

  return { present: true, ok: problems.length === 0, problems, notes };
}

/** Turn a pg/network error into (safe message, likely cause + fix). */
export function explainError(error, url) {
  const code = error?.code ?? "";
  const rawMessage = error?.message ?? String(error);
  const message = redact(rawMessage, url);

  const byCode = {
    ENOTFOUND: "DNS could not resolve the host. Usually a typo'd host, the IPv6-only direct host (db.<ref>.supabase.co), or a region that does not match the project.",
    EAI_AGAIN: "Temporary DNS failure — usually the region in the pooler host does not match your project's region.",
    ECONNREFUSED: "The host is reachable but refused the connection — wrong port, or the pooler is not enabled for this project.",
    ETIMEDOUT: "Connection timed out — wrong host/region, or an outbound firewall (self-hosted runner / network restriction).",
    ECONNRESET: "Connection was reset mid-handshake — often a TLS problem or a proxy in the way.",
    EHOSTUNREACH: "No route to host — typical for the IPv6-only direct host on an IPv4-only runner.",
    ENETUNREACH: "Network unreachable — typical for the IPv6-only direct host on an IPv4-only runner.",
    "28P01": "Postgres rejected the password (invalid_password). Re-copy the database password — or URL-encode special characters in it.",
    "28000": "Authentication rejected before the password was checked (pg_hba / SSL). Supabase requires TLS; keep the pooler host and sslmode=require.",
    "3D000": "The database in the URL does not exist. Supabase's database is named postgres.",
    "42501": "The role lacks privileges for this operation — you are not connecting as postgres.<ref>.",
    "53300": "Too many connections (Supavisor limit). Retry, or use the transaction pooler for runtime traffic.",
  };

  // node-postgres often reports no SQLSTATE for handshake-level failures,
  // so recognise the well-known phrases too.
  if (/password authentication failed|invalid_password/i.test(rawMessage)) {
    return {
      code: code || "28P01",
      message,
      cause:
        "Supabase rejected the password. Re-copy the database password from Supabase (Project Settings -> Database -> Reset database password if unsure) and remember special characters must be URL-encoded.",
    };
  }
  if (/no pg_hba\.conf entry|SSL off|server does not support SSL/i.test(rawMessage)) {
    return {
      code: code || "28000",
      message,
      cause:
        "TLS was not negotiated. Supabase requires SSL: keep the *.pooler.supabase.com host and ?sslmode=require (the scripts force TLS for Supabase hosts).",
    };
  }
  if (/connection terminated/i.test(rawMessage)) {
    return {
      code: code || "(none)",
      message,
      cause:
        "The pooler closed the connection during/after the handshake. Usually a wrong database password, a wrong project ref in the username (postgres.<ref>), or an unencoded special character in the password. Run the \"Diagnose Supabase config\" workflow to check the shape of the stored secret.",
    };
  }

  const timedOut = /timeout|timed out/i.test(rawMessage);
  const certIssue = /self[- ]signed certificate|certificate/i.test(rawMessage);

  const cause =
    byCode[code] ??
    (timedOut
      ? byCode.ETIMEDOUT
      : certIssue
        ? "TLS/certificate problem talking to the pooler."
        : "Unknown connection error — see the message above.");

  return { code: code || "(none)", message, cause };
}
