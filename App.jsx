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

function IconPin({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 16.5 20 20.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconExternal() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 4h3.2M9 3h4v4M13 3 7.2 8.8" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M6 5H4.2A1.2 1.2 0 0 0 3 6.2v5.6A1.2 1.2 0 0 0 4.2 13h5.6a1.2 1.2 0 0 0 1.2-1.2V10" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function Logo() {
  return (
    <svg className="logo" viewBox="0 0 78 86" role="img" aria-label="ups">
      <path d="M8 6h62c2 0 4 2 4 4v36c0 22-14 34-35 40C18 80 4 68 4 46V10c0-2 2-4 4-4z" fill="#ffb500" />
      <path d="M14 12h50c1 0 2 1 2 2v30c0 17-11 27-27 32-16-5-27-15-27-32V14c0-1 1-2 2-2z" fill="#351c15" />
      <text x="39" y="48" textAnchor="middle" fill="#ffb500" fontFamily="Georgia, 'Times New Roman', serif" fontSize="26" fontWeight="700">ups</text>
    </svg>
  );
}

function IconBell() {
  return (
    <svg className="quick-svg" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.5 16.5h11L16.2 14V10a4.2 4.2 0 0 0-8.4 0v4l-1.3 2.5z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M10 17.2a2 2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function IconTruck() {
  return (
    <svg className="quick-svg" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 8h11v8H3zM14 11h4l3 3v2h-7z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="7" cy="17.5" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17" cy="17.5" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconHelp() {
  return (
    <svg className="quick-svg" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.2 2.4c-.7.3-1.2.9-1.2 1.6V14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="12" cy="17" r="0.8" fill="currentColor" />
    </svg>
  );
}

function TrackingArt() {
  return (
    <svg className="tracking-art" viewBox="0 0 72 64" aria-hidden="true">
      <path d="M18 30h28l6 8H14z" fill="#c4a574" />
      <path d="M16 38h34v16H16z" fill="#8d6a43" />
      <path d="M16 38h34v4H16z" fill="#6e5234" />
      <path d="M36 8c-8 0-14 6-14 14 0 10 14 22 14 22s14-12 14-22c0-8-6-14-14-14z" fill="#ffb500" />
      <circle cx="36" cy="22" r="5" fill="#fff" />
    </svg>
  );
}

function ShippingArt() {
  return (
    <svg className="card-art" viewBox="0 0 88 72" aria-hidden="true">
      <ellipse cx="44" cy="58" rx="26" ry="6" fill="#efe6d6" />
      <path d="M24 28h28l10 8v16H24z" fill="#8d6a43" />
      <path d="M24 28l14-10h22l-8 10z" fill="#c4a574" />
      <circle cx="58" cy="22" r="12" fill="#ffb500" />
      <path d="M58 16v8h6" fill="none" stroke="#351c15" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function HelpArt() {
  return (
    <svg className="card-art" viewBox="0 0 88 72" aria-hidden="true">
      <rect x="28" y="14" width="34" height="44" rx="3" fill="#f4efe6" stroke="#d9cbb6" />
      <rect x="28" y="14" width="34" height="12" rx="3" fill="#ffb500" />
      <path d="M34 34h20M34 40h16M34 46h18" stroke="#8d6a43" strokeWidth="2" strokeLinecap="round" />
      <circle cx="56" cy="22" r="10" fill="#fff6df" stroke="#ffb500" />
      <path d="M56 18v5M56 26h.1" stroke="#351c15" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function Login() {
  const [trackingNumber, setTrackingNumber] = useState("");

  return (
    <div className="page">
      <header className="utility">
        <div className="wrap utility-inner">
          <button type="button" className="utility-link">
            <IconPin className="utility-pin" />
            Find Closest UPS Location
            <span className="caret" aria-hidden="true">▾</span>
          </button>
          <div className="utility-right">
            <button type="button" className="utility-link">
              <span className="alert-badge">1</span>
              Service Alerts
            </button>
            <button type="button" className="utility-link">
              United States - English
              <span className="caret" aria-hidden="true">▾</span>
            </button>
            <button type="button" className="utility-link">Support</button>
          </div>
        </div>
      </header>

      <div className="mast">
        <div className="wrap mast-inner">
          <Logo />
          <nav className="nav" aria-label="Primary">
            <a href="#shipping">Shipping</a>
            <a className="active" href="#tracking">Tracking</a>
            <a href="#products">Products &amp; Services</a>
            <a href="#store">The UPS Store</a>
          </nav>
          <div className="mast-actions">
            <button type="button" className="icon-button" aria-label="Search">
              <IconSearch />
            </button>
            <button type="button" className="login-button" onClick={() => window.location.assign(authorizeUrl)}>
              Log In ›
            </button>
          </div>
        </div>
      </div>

      <main>
        <div className="band" aria-hidden="true">
          <svg viewBox="0 0 1440 240" preserveAspectRatio="none">
            <path d="M0 0h1440v128C1200 214 960 240 720 240S240 214 0 128V0z" fill="#351c15" />
          </svg>
        </div>
        <div className="wrap stage">
          <section className="tracking" id="tracking">
            <div className="tracking-title">
              <TrackingArt />
              <h1>Tracking</h1>
            </div>
            <form className="track-form" onSubmit={(event) => event.preventDefault()}>
              <label className="sr-only" htmlFor="tracking-number">Tracking Number or InfoNotice®</label>
              <input
                id="tracking-number"
                value={trackingNumber}
                onChange={(event) => setTrackingNumber(event.target.value)}
                placeholder="Tracking Number or InfoNotice®"
              />
              <button type="submit" className="track-button">Track ›</button>
            </form>
            <p className="help-line">
              Need help changing your delivery? <a href="#help">Get Help</a>
            </p>
            <div className="quick-links">
              <a href="#alerts"><IconBell /> Set Up Alerts</a>
              <a href="#delivery"><IconTruck /> Change Delivery</a>
              <a href="#support"><IconHelp /> Get Support</a>
            </div>
          </section>
          <aside className="side">
            <a className="side-card" id="shipping" href="#shipping">
              <IconExternal />
              <ShippingArt />
              <span>Shipping</span>
            </a>
            <a className="side-card" id="help" href="#help">
              <IconExternal />
              <HelpArt />
              <span>How Can We Help You?</span>
            </a>
          </aside>
        </div>
      </main>
    </div>
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
    <main className="callback-page">
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
