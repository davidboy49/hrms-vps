// Local PostgreSQL without Docker. Run: npm run db:local  (keeps running; Ctrl+C to stop)
import EmbeddedPostgres from "embedded-postgres"
import fs from "node:fs"

const dir = ".pgdata"
const pg = new EmbeddedPostgres({ databaseDir: dir, user: "peopledesk", password: "peopledesk", port: 5433, persistent: true, initdbFlags: ["--encoding=UTF8", "--locale=C"] })
if (!fs.existsSync(`${dir}/PG_VERSION`)) await pg.initialise()
await pg.start()
try { await pg.createDatabase("peopledesk") } catch {}
console.log("PostgreSQL ready on localhost:5433 (db: peopledesk)")
const stop = async () => { await pg.stop(); process.exit(0) }
process.on("SIGINT", stop)
process.on("SIGTERM", stop)
setInterval(() => {}, 1 << 30)
