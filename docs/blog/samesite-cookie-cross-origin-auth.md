# Why Your httpOnly Refresh Token Cookie Isn't Being Sent (And How to Fix It)

## The Silent Killer of Cross-Origin Authentication

*A tale of SameSite cookies, mysterious 400 errors, and the debugging journey that cost me hours so you don't have to.*

---

You've done everything right. Your authentication flow is secure:

- Access tokens stored in memory (not localStorage) to prevent XSS
- Refresh tokens in httpOnly cookies to prevent JavaScript access
- CORS configured with `credentials: true`
- Axios configured with `withCredentials: true`

You deploy your React frontend to Vercel (`app.yourdomain.com`) and your Express backend to AWS (`api.yourdomain.com`). Login works perfectly. The `Set-Cookie` header comes back with your refresh token. Life is good.

Then you refresh the page.

**Boom.** Redirected to login. Session gone. Your users are furious.

## The Symptoms

Here's what I was seeing:

1. **Login worked fine** — User authenticates, backend returns `Set-Cookie: refreshToken=abc123...`
2. **Cookie appeared to be stored** — Browser DevTools showed the cookie
3. **Page refresh killed the session** — Silent refresh returned 400: "Refresh token is required"
4. **The cookie wasn't being sent** — Network tab showed no `Cookie` header on the refresh request

The maddening part? Everything worked perfectly in local development.

## The Debugging Dead Ends

I checked everything:

```javascript
// ✅ Axios configured correctly
const api = axios.create({
  baseURL: 'https://api.yourdomain.com',
  withCredentials: true, // This enables cookies
});

// ✅ CORS configured correctly
app.use(cors({
  origin: 'https://app.yourdomain.com',
  credentials: true, // This allows credentials
}));

// ✅ Cookie had the right domain
Set-Cookie: refreshToken=abc123; Domain=.yourdomain.com; Path=/api/auth; HttpOnly; Secure; SameSite=Lax
```

The domain was correct (`.yourdomain.com` covers both subdomains). The path was correct. `Secure` was set. `credentials: true` everywhere.

**What was I missing?**

## The Culprit: SameSite=Lax

Here's the thing about `SameSite=Lax` that isn't immediately obvious:

> **SameSite=Lax cookies are NOT sent with cross-origin programmatic requests (fetch/XHR).**

They're only sent with:
- Top-level navigations (clicking a link)
- GET requests that result from navigations

They are NOT sent with:
- `fetch()` POST requests
- `XMLHttpRequest` (axios) POST requests
- Any programmatic API calls

This is by design. `SameSite=Lax` was created as a CSRF protection that balances security with usability for navigations, but it intentionally blocks cross-origin API calls from including cookies.

### But wait — aren't my frontend and backend on the same domain?

Here's the key insight: **different subdomains are considered cross-origin for SameSite purposes.**

- `app.yourdomain.com` → `api.yourdomain.com` = **Cross-origin**
- `yourdomain.com` → `yourdomain.com/api` = **Same-origin**

When your frontend on Vercel makes an axios POST to your backend on AWS, the browser sees this as a cross-origin request. With `SameSite=Lax`, it silently drops the cookie.

## The Fix

Change `SameSite` from `Lax` to `None`:

```javascript
// Before (broken for cross-origin)
res.cookie('refreshToken', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',  // ❌ Won't be sent with cross-origin fetch
  domain: '.yourdomain.com',
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

// After (works for cross-origin)
res.cookie('refreshToken', token, {
  httpOnly: true,
  secure: true,        // Required for SameSite=None
  sameSite: 'none',    // ✅ Sent with all requests including cross-origin
  domain: '.yourdomain.com',
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
});
```

**Important:** `SameSite=None` requires `Secure=true`. The browser will reject the cookie if you try to use `SameSite=None` without HTTPS.

## Security Implications

"But wait," you say, "doesn't `SameSite=None` make me vulnerable to CSRF?"

Yes, you lose the automatic CSRF protection that `SameSite=Lax` provides. But here's why it's still secure for refresh tokens:

1. **The cookie is httpOnly** — JavaScript can't read it
2. **You're using it for token refresh, not state-changing operations** — A CSRF attack could trigger a refresh, but they can't access the new tokens (they're returned in the response body and stored in memory)
3. **Your actual API endpoints should validate the access token** — Which is stored in memory, not cookies
4. **You can add additional CSRF protection** — Like requiring a custom header that proves the request came from your frontend

The refresh token cookie is essentially a "session resumption" mechanism, not an authentication bypass.

## The Complete Picture

Here's the secure authentication architecture that works across subdomains:

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER                                  │
├─────────────────────────────────────────────────────────────────┤
│  Memory (JavaScript)          │  Cookie Storage (httpOnly)      │
│  ┌─────────────────────────┐  │  ┌─────────────────────────┐    │
│  │ accessToken: "eyJ..."   │  │  │ refreshToken: "abc..."  │    │
│  │ (XSS protected by       │  │  │ (XSS protected by       │    │
│  │  not being in storage)  │  │  │  httpOnly flag)         │    │
│  └─────────────────────────┘  │  └─────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                                │
                 ┌──────────────┴──────────────┐
                 ▼                             ▼
    Authorization: Bearer eyJ...     Cookie: refreshToken=abc...
    (attached by JavaScript)         (attached by browser automatically)
                 │                             │
                 ▼                             ▼
        Protected API calls            POST /api/auth/refresh
```

**Key points:**
- Access token in memory → Attached to requests via `Authorization` header
- Refresh token in httpOnly cookie → Automatically attached by browser (if SameSite allows)
- `SameSite=None` + `Secure` + `httpOnly` = Secure cross-origin refresh

## Quick Checklist

If your httpOnly cookie isn't being sent cross-origin, verify:

- [ ] `SameSite=None` (not `Lax` or `Strict`)
- [ ] `Secure=true` (required for `SameSite=None`)
- [ ] `Domain` set to parent domain (`.yourdomain.com`)
- [ ] Backend CORS has `credentials: true`
- [ ] Frontend axios/fetch has `withCredentials: true` / `credentials: 'include'`
- [ ] You're on HTTPS (not localhost with HTTP)

## Local Development Tip

For local development where frontend and backend are on `localhost` (same origin), `SameSite=Lax` works fine. You can conditionally set it:

```javascript
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  // ...
};
```

This gives you the best of both worlds: `Lax` protection in development, `None` for cross-origin production deployments.

## Conclusion

The `SameSite` cookie attribute is a powerful security feature, but its behavior with cross-origin requests isn't always intuitive. If you're deploying your frontend and backend to different subdomains (which is extremely common with Vercel, Netlify, AWS, etc.), you need `SameSite=None` for cookies to be sent with programmatic API requests.

The fix is one line of code. The debugging journey to find it? That's the expensive part.

Hopefully this saves you a few hours.

---

*Found this helpful? I write about full-stack development, authentication, and the debugging war stories that teach us the most. Follow for more.*

**Tags:** #javascript #authentication #cookies #webdev #security #react #nodejs #debugging
