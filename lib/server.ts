import http, { IncomingMessage, ServerResponse } from "node:http";
import https from "node:https";
import { randomBytes, timingSafeEqual, scryptSync } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
interface Session {
  expires: number;
  csrf: string;
}
export function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 32).toString("hex");
}
export function passwordMatches(password: string, stored: string) {
  try {
    const [salt, hash] = stored.split(":");
    const expected = Buffer.from(hash, "hex");
    const actual = scryptSync(password, salt, 32);
    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  } catch {
    return false;
  }
}
export class DashboardServer {
  private sessions = new Map<string, Session>();
  private attempts = new Map<string, { count: number; until: number }>();
  private server?: http.Server;
  private cleanup?: NodeJS.Timeout;
  constructor(
    private api: any,
    private directory: string,
  ) {}
  async start(options: any) {
    const handler = (req: IncomingMessage, res: ServerResponse) => {
      this.handle(req, res, !!options.tls).catch(() => {
        if (!res.headersSent) this.json(res, 500, { error: "Interner Fehler" });
        else res.end();
      });
    };
    this.server = options.tls
      ? https.createServer(options.tls, handler)
      : http.createServer(handler);
    this.server.requestTimeout = 20000;
    this.server.headersTimeout = 10000;
    await new Promise<void>((resolve, reject) => {
      this.server!.once("error", reject);
      this.server!.listen(options.port, options.bind, resolve);
    });
    this.cleanup = setInterval(() => {
      const now = Date.now();
      for (const [id, s] of this.sessions)
        if (s.expires < now) this.sessions.delete(id);
      for (const [id, s] of this.attempts)
        if (s.until < now) this.attempts.delete(id);
    }, 60000);
  }
  private json(res: ServerResponse, code: number, value: any) {
    res.writeHead(code, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(value));
  }
  private async body(req: IncomingMessage) {
    let data = "";
    for await (const chunk of req) {
      data += chunk;
      if (data.length > 150000) throw Error("Anfrage zu groß");
    }
    return JSON.parse(data || "{}");
  }
  private async handle(
    req: IncomingMessage,
    res: ServerResponse,
    secure: boolean,
  ) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'",
    );
    const url = new URL(
      req.url || "/",
      `${secure ? "https" : "http"}://${req.headers.host || "localhost"}`,
    );
    if (req.headers.origin && req.headers.origin !== url.origin)
      return this.json(res, 403, { error: "Fremder Ursprung gesperrt" });
    if (url.pathname === "/api/login" && req.method === "POST") {
      const address = req.socket.remoteAddress || "";
      let attempts = this.attempts.get(address);
      if (attempts && attempts.until > Date.now() && attempts.count >= 6)
        return this.json(res, 429, {
          error: "Bitte in einer Minute erneut versuchen",
        });
      if (!attempts || attempts.until < Date.now()) {
        attempts = { count: 0, until: Date.now() + 60000 };
        this.attempts.set(address, attempts);
      }
      attempts.count++;
      const body = await this.body(req);
      if (
        typeof body.password !== "string" ||
        body.password.length > 512 ||
        !(await this.api.authenticate(body.username, body.password))
      )
        return this.json(res, 401, { error: "Anmeldung fehlgeschlagen" });
      if (this.sessions.size >= 100)
        return this.json(res, 429, { error: "Zu viele Sitzungen" });
      const id = randomBytes(32).toString("hex"),
        csrf = randomBytes(24).toString("hex");
      this.sessions.set(id, { csrf, expires: Date.now() + 8 * 3600000 });
      res.setHeader(
        "Set-Cookie",
        `ec_session=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure ? "; Secure" : ""}`,
      );
      return this.json(res, 200, { csrf });
    }
    if (url.pathname.startsWith("/api/")) {
      const id =
        /\bec_session=([a-f0-9]{64})\b/.exec(req.headers.cookie || "")?.[1] ||
        "";
      const session = this.sessions.get(id);
      if (!session || session.expires < Date.now())
        return this.json(res, 401, { error: "Bitte anmelden" });
      if (req.method !== "GET" && req.headers["x-csrf-token"] !== session.csrf)
        return this.json(res, 403, {
          error: "Sicherheitsprüfung fehlgeschlagen",
        });
      try {
        if (url.pathname === "/api/session" && req.method === "GET")
          return this.json(res, 200, { csrf: session.csrf });
        if (url.pathname === "/api/logout" && req.method === "POST") {
          this.sessions.delete(id);
          res.setHeader(
            "Set-Cookie",
            "ec_session=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/",
          );
          return this.json(res, 200, { ok: true });
        }
        if (url.pathname === "/api/snapshot" && req.method === "GET")
          return this.json(res, 200, await this.api.snapshot());
        if (url.pathname === "/api/config" && req.method === "GET")
          return this.json(res, 200, this.api.settings());
        if (url.pathname === "/api/config" && req.method === "PUT")
          return this.json(res, 200, await this.api.save(await this.body(req)));
        if (url.pathname === "/api/datapoints" && req.method === "GET")
          return this.json(
            res,
            200,
            await this.api.browse(
              (url.searchParams.get("q") || "").slice(0, 100),
            ),
          );
        if (url.pathname === "/api/history" && req.method === "POST")
          return this.json(
            res,
            200,
            await this.api.history(await this.body(req)),
          );
        if (url.pathname === "/api/control" && req.method === "POST")
          return this.json(res, 403, {
            error: "Gerätesteuerung ist in dieser Version deaktiviert",
          });
      } catch (e) {
        return this.json(res, 400, {
          error: e instanceof Error ? e.message : "Ungültige Anfrage",
        });
      }
      return this.json(res, 404, { error: "Unbekannte Funktion" });
    }
    if (req.method !== "GET")
      return this.json(res, 405, { error: "Methode nicht erlaubt" });
    const name =
      url.pathname === "/"
        ? "index.html"
        : decodeURIComponent(url.pathname.slice(1));
    if (!/^[a-zA-Z0-9_./-]+$/.test(name) || name.split("/").includes(".."))
      return this.json(res, 404, {});
    try {
      const data = await readFile(path.join(this.directory, name));
      const type: Record<string, string> = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".json": "application/json",
        ".png": "image/png",
      };
      res.writeHead(200, {
        "Content-Type":
          (type[path.extname(name)] || "application/octet-stream") +
          "; charset=utf-8",
        "Cache-Control": "no-cache",
      });
      res.end(data);
    } catch {
      this.json(res, 404, { error: "Nicht gefunden" });
    }
  }
  async stop() {
    if (this.cleanup) clearInterval(this.cleanup);
    this.sessions.clear();
    const force = setTimeout(() => this.server?.closeAllConnections(), 1500);
    await new Promise<void>((resolve) =>
      this.server ? this.server.close(() => resolve()) : resolve(),
    );
    clearTimeout(force);
  }
}
