import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const redirectUri = "http://localhost:8000/callBack";
const tokenEndpoint = "https://ptt.id.ups.com/oauth/token";

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function tokenExchange(env) {
  return {
    name: "ptt-token-exchange",
    configureServer(server) {
      server.middlewares.use("/api/token", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "method_not_allowed" }));
          return;
        }
        try {
          const { code } = await readJson(req);
          if (!code) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "missing_code", error_description: "Authorization code was not sent." }));
            return;
          }
          const tokenRes = await fetch(tokenEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type: "authorization_code",
              client_id: env.CLIENT_ID,
              client_secret: env.CLIENT_SECRET,
              code,
              redirect_uri: redirectUri,
            }),
          });
          const payload = await tokenRes.text();
          res.statusCode = tokenRes.status;
          res.setHeader("Content-Type", "application/json");
          res.end(payload);
        } catch (error) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "token_exchange_failed", error_description: error.message }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), tokenExchange(env)],
    server: {
      port: 8000,
      strictPort: true,
    },
  };
});
