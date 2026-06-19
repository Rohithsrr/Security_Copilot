# Security Architecture Knowledge Base  
**Project:** Financial Portal (HTML‑only front‑end) – multiple authentication options (Microsoft Entra ID, Okta) and a public demo page.  

---  

## 1. Applications  

| File | Description | Primary Function |
|------|-------------|------------------|
| **entra.html** | SPA that authenticates users with **Microsoft Entra ID (Azure AD)** using MSAL.js. | Shows user details, dashboard, reports, admin UI based on RBAC claims. |
| **okta.html** | SPA that authenticates users with **Okta** using Okta Auth JS SDK. | Same UI as `entra.html` but obtains role from Okta groups. |
| **public.html** | Static page with no authentication. | Demonstrates the UI with hard‑coded “Admin” user – useful for UI testing only. |

All three pages are pure client‑side HTML/JS; there is **no back‑end** or API layer in the supplied source.  

---  

## 2. Authentication  

| Provider | Library | Flow | Scopes / Claims | Tokens Stored |
|----------|---------|------|----------------|---------------|
| **Microsoft Entra ID** | `msal-browser` v2.38.0 | **Authorization Code Flow with PKCE** (via `loginPopup` and `acquireTokenSilent`) | `User.Read` (Microsoft Graph) – only used to obtain an ID token. The ID token contains `roles` claim (if configured in Azure AD app). | The **full MSAL response** (including `idToken`, `accessToken`) is serialized into **sessionStorage** under key `userData`. |
| **Okta** | `okta-auth-js` v7.7.0 | **Redirect‑based Authorization Code Flow with PKCE** (`signInWithRedirect` → `handleRedirect`) | `openid profile email` – ID token returned contains `groups` claim (or can be fetched via `/userinfo`). | No explicit token storage in the page – the SDK keeps tokens in **session storage** (default) and uses them internally. |
| **Public** | None | N/A | N/A | N/A |

### Observations  

* Both SDKs rely on **sessionStorage** (client‑side only). No http‑only, secure cookies are used.  
* No token validation is performed on the client – the SDKs do it internally, but the app trusts the **claims** (`roles` or `groups`) without additional verification.  
* No **refresh token** handling is shown; the SDK will silently acquire new access tokens when needed.  

---  

## 3. Authorization  

### 3.1 RBAC Logic (client‑side)

```js
function applyRBAC(role){
    // hide everything
    // then switch(role) { Admin → dashboard+reports+admin,
    //                     Analyst → dashboard+reports,
    //                     User → dashboard,
    //                     default → dashboard }
}
```

* The **role** is derived from:  

  * **Entra** – `response.idTokenClaims?.roles` array.  
  * **Okta** – `user.groups` array (checks for “Admin”, “Analyst”, otherwise “User”).  

* The UI sections (`#dashboard`, `#reports`, `#admin`) are shown/hidden purely by DOM manipulation.  

### 3.2 No Server‑Side Enforcement  

Because the portal is static, **all authorization decisions are performed in the browser**. An attacker can:  

* Open the page, modify the DOM or the `role` variable in the console, and reveal hidden sections.  
* Bypass authentication entirely by loading `public.html` (or any of the other pages) and manually editing the HTML.  

---  

## 4. RBAC Roles  

| Role | Permissions (UI sections) |
|------|---------------------------|
| **Admin** | Dashboard, Reports, Admin Section |
| **Analyst** | Dashboard, Reports |
| **User** | Dashboard only |
| **Default / Unknown** | Dashboard only |

Roles are **hard‑coded** in the client logic; there is no external policy store.  

---  

## 5. Protected Resources  

| Resource | Protection Mechanism | Current State |
|----------|----------------------|---------------|
| **HTML pages** (`entra.html`, `okta.html`) | Publicly accessible; authentication performed **after** page load. | Unprotected – anyone can request the file. |
| **Dashboard / Reports / Admin UI** | Shown/hidden via JavaScript based on role. | **Client‑side only** – not truly protected. |
| **Backend APIs / Data** | **None** in the supplied code. | If real APIs existed, they would need server‑side token validation. |

---  

## 6. Security Risks  

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|------------|------------|
| 1 | **Client‑side RBAC only** – UI sections can be revealed by tampering with JavaScript or DOM. | Confidential data (e.g., admin functions) exposed to any user. | High | Move authorization enforcement to a back‑end service; never rely on client‑side hiding. |
| 2 | **Tokens stored in `sessionStorage`** (plain JavaScript). | Accessible to any script running in the same origin (including XSS). | Medium‑High | Use **httpOnly, Secure, SameSite** cookies for tokens or at least set `storeAuthStateInCookie:true` for MSAL. |
| 3 | **No CSP / Sub‑resource Integrity** – external SDKs loaded from CDN without integrity checks. | Possibility of supply‑chain compromise. | Medium | Add `Content‑Security‑Policy` header and `integrity` attributes (SRI). |
| 4 | **No X‑Content‑Type‑Options / X‑Frame‑Options** – pages can be embedded or MIME‑sniffed. | Click‑jacking, content sniffing attacks. | Low‑Medium | Set appropriate response headers (e.g., `X-Frame-Options: DENY`). |
| 5 | **Redirect URIs are hard‑coded to `http://localhost:5500`** – in production they may be mis‑configured, leading to open redirect or token leakage. | Token leakage to malicious site. | Low (dev only) | Use HTTPS, whitelist exact redirect URIs, avoid wildcards. |
| 6 | **Public demo page (`public.html`) exposes admin UI with no auth** – could be accidentally deployed to production. | Full admin UI visible to anyone. | Medium (if deployed) | Remove `public.html` from production or protect it with auth. |
| 7 | **Scope over‑privilege** – Entra request only `User.Read` but may rely on custom `roles` claim; if additional scopes are added inadvertently, tokens may contain more permissions. | Token misuse. | Low | Follow principle of least privilege; request only needed scopes. |
| 8 | **No token revocation / logout handling for Entra** – `logout()` only clears `sessionStorage`; does not call Azure AD logout endpoint. | Stale session may persist on IdP side. | Low | Call `msalInstance.logoutPopup()` or `logoutRedirect()` to end IdP session. |
| 9 | **No error handling for token acquisition failures** – silent token acquisition may fail silently, leaving UI in inconsistent state. | Poor UX, possible exposure of partial data. | Low | Show user-friendly messages, fallback to interactive login. |
| 10 | **Hard‑coded client IDs & tenant IDs** – visible in source, may be harvested for phishing or token‑theft attempts. | Reconnaissance for attackers. | Low‑Medium | Consider moving IDs to environment variables or server‑side config; however client IDs are generally public. |

---  

## 7. Authentication Flow  

### 7.1 Microsoft Entra ID (`entra.html`)  

1. **User clicks “Login”** → `login()` calls `msalInstance.loginPopup({scopes:['User.Read']})`.  
2. Browser opens a popup to Azure AD **Authorization Endpoint** (PKCE).  
3. After successful login, Azure AD redirects back to the popup with **authorization code**.  
4. MSAL exchanges the code for **access token** and **ID token** (PKCE).  
5. MSAL returns a response object containing `account`, `idTokenClaims`, `accessToken`.  
6. The app stores the whole response in `sessionStorage` (`userData`).  
7. `showUser()` extracts `roles` claim, decides the UI role, and calls `applyRBAC()`.  

**Silent login (auto‑login)** – on page load `initialize()` checks `msalInstance.getAllAccounts()`. If an account exists, it calls `acquireTokenSilent` to get a fresh token without UI, then shows the UI.  

### 7.2 Okta (`okta.html`)  

1. **User clicks “Login”** → `login()` calls `oktaAuth.signInWithRedirect()`.  
2. Browser redirects to Okta **Authorization Endpoint** (PKCE).  
3. After login, Okta redirects back to `redirectUri` (`okta.html`).  
4. `initialize()` detects a login redirect (`isLoginRedirect()`), calls `handleRedirect()` to process the code and store tokens.  
5. `oktaAuth.isAuthenticated()` checks token presence/validity.  
6. `oktaAuth.getUser()` fetches the **UserInfo** endpoint (or decodes ID token) to obtain `name`, `email`, `groups`.  
7. Role is derived from groups (`Admin`, `Analyst`, else `User`).  
8. UI is rendered via `applyRBAC()`.  

**Logout** – `oktaAuth.signOut()` redirects to Okta logout endpoint and then back to the page.  

---  

## 8. Authorization Flow  

1. **Token acquisition** → ID token (or userinfo) contains role information (`roles` claim for Entra, `groups` claim for Okta).  
2. **Client extracts role** (`showUser()` or `initialize()`).  
3. **`applyRBAC(role)`** manipulates DOM visibility.  
4. **No server‑side check** – any request to a protected API (if added later) would need its own token validation; currently the only “protected resources” are UI sections.  

---  

## 9. Architecture Summary  

```
+-------------------+          +-------------------+          +-------------------+
| Browser (SPA)    |          | Identity Provider|          | (Potential) API   |
| - entra.html      | <--->    | - Azure AD        | <--->    | - /api/...        |
| - okta.html       |          | - Okta            |          |   (needs token   |
| - public.html     |          +-------------------+          |    validation)   |
+-------------------+                                          +-------------------+

Key points:
- Pure client‑side SPA, no back‑end.
- Authentication performed via OAuth2/OIDC PKCE flows using vendor SDKs.
- Role information is taken from ID token / userinfo.
- Authorization is enforced only by hiding/showing DOM elements.
- Tokens live in sessionStorage; no httpOnly cookies.
```

---  

## 10. Security Recommendations  

| Category | Recommendation | Rationale / Implementation |
|----------|----------------|----------------------------|
| **Authorization Enforcement** | **Move RBAC to the server** – protect real data via API endpoints that validate the access token and enforce role‑based policies. | Client‑side hiding is insufficient; server must be the source of truth. |
| **Token Storage** | Store tokens in **httpOnly, Secure, SameSite=Strict** cookies or use the SDK option `storeAuthStateInCookie:true`. | Prevents JavaScript access → mitigates XSS token theft. |
| **Content Security Policy (CSP)** | Add a strong CSP header (e.g., `default-src 'self'; script-src 'self' https://alcdn.msauth.net https://global.oktacdn.com; style-src 'self' 'unsafe-inline'; object-src 'none'; frame-ancestors 'none';`) | Reduces risk of malicious script injection and click‑jacking. |
| **Sub‑resource Integrity (SRI)** | Include `integrity` and `crossorigin="anonymous"` attributes on external SDK `<script>` tags. | Detects CDN tampering. |
| **Secure Headers** | Deploy `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`. | Harden browser handling. |
| **Logout Completeness** | For Entra ID, call `msalInstance.logoutPopup()` (or `logoutRedirect`) to clear the IdP session. | Prevents lingering SSO session. |
| **Redirect URI Hygiene** | Use **HTTPS** production URIs, whitelist exact URIs in IdP configuration, avoid `http://localhost` in production. | Stops open‑redirect and token leakage. |
| **Remove Public Demo from Prod** | Delete or protect `public.html` before deployment. | Avoid accidental exposure of admin UI. |
| **Least‑Privilege Scopes** | Request only the scopes needed (`openid profile email` for Okta; for Entra, add `offline_access` only if refresh tokens required). | Reduces token surface. |
| **Input Validation / XSS** | Sanitize any data that could be rendered (e.g., user‑provided `name` or `email`) before inserting into the DOM. Use `textContent` instead of `innerHTML` where possible. | Mitigates reflected/injected XSS. |
| **Session Expiration** | Enforce token expiration handling; automatically log out or re‑authenticate when tokens expire. | Improves security posture. |
| **Monitoring & Auditing** | Enable logging on IdP for sign‑in events, and on any back‑end APIs for token validation failures. | Detect suspicious activity. |
| **Security Testing** | Perform **static analysis**, **dependency scanning**, and **penetration testing** focusing on client‑side token handling and DOM manipulation. | Validate that mitigations are effective. |
| **Documentation** | Clearly document the required Azure AD app manifest (e.g., `groupMembershipClaims: "SecurityGroup"` to get `roles`) and Okta group mapping. | Ensures correct configuration and reduces mis‑configuration risk. |

---  

### Quick “Fix‑First” Checklist  

1. **Add CSP & security headers** on the web server serving these pages.  
2. **Enable `storeAuthStateInCookie:true`** for MSAL or switch to cookie storage.  
3. **Replace all `innerHTML` assignments** with safe DOM APIs (`textContent`, `createElement`).  
4. **Remove `public.html`** from any production deployment.  
5. **Implement a back‑end API** (e.g., Node/Express, .NET, Java) that validates the JWT access token and returns the financial data; the front‑end should call this API instead of rendering static values.  
6. **Configure proper logout** for both IdPs.  
7. **Add SRI** to external script tags.  

---  

## 11. Conclusion  

The current Financial Portal demonstrates how to integrate two major identity providers using client‑side SDKs, but it **relies entirely on front‑end enforcement** for both authentication state and role‑based access control. This architecture is **insecure for any real financial data** because an attacker can bypass UI restrictions, steal tokens via XSS, or expose the admin UI through the public demo page.  

By moving authorization checks to a server, securing token storage, hardening the client with CSP/SRI, and removing unauthenticated demo pages, the portal can be transformed into a robust, production‑grade solution.  

---  