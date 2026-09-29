import { useEffect, useRef, useState } from "react";

const pttDomain = "ptt.id.ups.com";
const devDomain = "dev.id.ups.com";
const clientId = "KIDej415T498rgiiAW2BRVfRqY5HY0yA";
const devClientId = "IZ27gtwV4pWCMhvh4E6Isz403FNFCIol";
const appOrigin = "http://localhost:8000";

const pttLogoutUrl = `https://${pttDomain}/v2/logout?${new URLSearchParams({
  client_id: clientId,
  returnTo: appOrigin,
}).toString()}`;

const devLogoutUrl = `https://${devDomain}/v2/logout?${new URLSearchParams({
  client_id: devClientId,
}).toString()}`;

function logoutTenants() {
  const popup = window.open(devLogoutUrl, "dev-logout", "width=480,height=420");
  if (!popup) return false;
  window.setTimeout(() => {
    if (!popup.closed) popup.close();
    window.location.assign(pttLogoutUrl);
  }, 1500);
  return true;
}

const authorizeUrl = `https://ptt.id.ups.com/authorize?${new URLSearchParams({
  response_type: "code",
  scope: "openid profile email",
  client_id: clientId,
  redirect_uri: "http://localhost:8000/callBack",
  prompt: "login",
  max_age: "0",
  response_mode: "query",
  "ups-returnto": "https://www.ups.com/us/en/home",
  "ext-loc": "en_US",
  ui_locales: "en",
}).toString()}`;

const exchanges = new Map();

function exchangeCode(code) {
  if (!exchanges.has(code)) {
    exchanges.set(
      code,
      fetch("/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      }).then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error_description || payload.error || "Token exchange failed.");
        }
        return payload;
      })
    );
  }
  return exchanges.get(code);
}

function decodeJwt(token) {
  const part = token.split(".")[1];
  if (!part) return null;
  const padded = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
  const json = new TextDecoder().decode(Uint8Array.from(atob(padded), (char) => char.charCodeAt(0)));
  return JSON.parse(json);
}

function formatClaim(value) {
  if (value == null || value === "") return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatTime(seconds) {
  if (!seconds) return "";
  return new Date(seconds * 1000).toISOString();
}

const hiddenClaims = new Set(["nickname", "email_verified"]);

const detailFields = [
  ["name", "Name"],
  ["email", "Email"],
  ["organization", "Organization"],
  ["sub", "Subject"],
  ["iss", "Issuer"],
  ["aud", "Audience"],
  ["iat", "Issued"],
  ["exp", "Expires"],
];

function organizationText(claims) {
  const lines = [];
  if (claims.org_name || claims.org_id) {
    lines.push([claims.org_name, claims.org_id].filter(Boolean).join(" — "));
  }
  for (const [key, value] of Object.entries(claims)) {
    if (key === "org_id" || key === "org_name" || !/org/i.test(key)) continue;
    const list = Array.isArray(value) ? value : [value];
    for (const org of list) {
      if (org == null || org === "") continue;
      if (typeof org === "string") lines.push(org);
      else lines.push([org.name || org.display_name, org.id].filter(Boolean).join(" — ") || formatClaim(org));
    }
  }
  return [...new Set(lines)].join("\n") || "Not in the ID token";
}

function shownClaims(claims) {
  return Object.fromEntries(Object.entries(claims).filter(([key]) => !hiddenClaims.has(key)));
}

function Login() {
  return (
    <main>
      <h1>PTT login</h1>
      <p>Sign in through the PTT tenant. The ID token is shown here after the callback.</p>
      <button type="button" onClick={() => window.location.assign(authorizeUrl)}>Log in</button>
    </main>
  );
}

function Callback() {
  const [idToken, setIdToken] = useState("");
  const [claims, setClaims] = useState(null);
  const [status, setStatus] = useState("Waiting for the authorization code.");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.search);
    const callbackError = params.get("error_description") || params.get("error");
    const code = params.get("code");
    if (callbackError) {
      setStatus(callbackError);
      return;
    }
    if (!code) {
      setStatus("No authorization code was returned.");
      return;
    }
    setStatus("Exchanging the authorization code.");
    exchangeCode(code)
      .then((tokens) => {
        const token = tokens.id_token || "";
        setIdToken(token);
        setClaims(token ? decodeJwt(token) : null);
        setStatus(token ? "ID token received." : "The token response did not include an ID token.");
      })
      .catch((error) => {
        setStatus(error.message);
      });
  }, []);

  return (
    <main>
      <h1>PTT callback</h1>
      <p>{status}</p>
      {claims ? (
        <dl>
          {detailFields.map(([key, label]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>{key === "organization" ? organizationText(claims) : key === "iat" || key === "exp" ? formatTime(claims[key]) : formatClaim(claims[key])}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <form onSubmit={(event) => event.preventDefault()}>
        <label htmlFor="claims">Token details</label>
        <textarea id="claims" name="claims" readOnly value={claims ? JSON.stringify(shownClaims(claims), null, 2) : ""} rows={12} />
        <label htmlFor="idToken">ID token</label>
        <textarea id="idToken" name="idToken" readOnly value={idToken} rows={6} />
      </form>
      {idToken ? (
        <button
          type="button"
          className="secondary"
          onClick={() => {
            if (!logoutTenants()) setStatus("Allow pop-ups for this site, then click Log out again.");
          }}
        >
          Log out
        </button>
      ) : null}
    </main>
  );
}

export default function App() {
  return window.location.pathname === "/callBack" ? <Callback /> : <Login />;
}
