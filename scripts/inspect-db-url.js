const fs = require("fs");
const env = fs.readFileSync(".env", "utf8");
const m = env.match(/^DATABASE_URL=["']?([^"'\n]+)/m);
if (!m) {
  console.log("no url");
  process.exit(1);
}
const raw = m[1];
const u = new URL(raw.replace(/^postgresql:/, "http:").replace(/^postgres:/, "http:"));
console.log(
  JSON.stringify(
    {
      protocol: raw.split(":")[0],
      host: u.hostname,
      port: u.port || "(default)",
      user: u.username,
      db: u.pathname,
      hasPass: Boolean(u.password),
      passLen: (u.password || "").length,
      search: u.search,
    },
    null,
    2,
  ),
);
