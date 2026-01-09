# LinkedIn Authority Engine v2: The Human Rewrite

**Shift: From incident reports to belief archaeology.**

---

## WEEK 1

### POST 1: The Deployment That Broke My Confidence

**Opening: Doubt**

---

I used to believe that if tests pass and code compiles, deployment is just logistics.

Then I watched 13 commits fail in 48 hours while a demo sat waiting.

Not because of bugs. Not because of logic errors. Because I built on Windows and deployed to Linux, and nobody told me that `npm ci` trusts your lockfile completely. If your lockfile was generated on the wrong OS, you're shipping a bomb with a green checkmark.

**What broke:**

Sharp. Rollup. Esbuild. Lightningcss. Every native binary in our stack, one after another.

**What I tried:**

1. Adding Linux binaries to `optionalDependencies` — didn't work
2. `postinstall` scripts to rebuild sharp — inconsistent
3. Deleting the lockfile in CI — worked, felt like cheating
4. Switching from `npm ci` to `npm install` — fixed it, broke reproducibility

I sat at my desk at 11 PM watching Render fail for the 9th time, and I realized: I had never actually understood what a lockfile does.

**The actual fix:**

```yaml
# .npmrc
supportedArchitectures:
  os: [linux, darwin, win32]
  cpu: [x64, arm64]
```

Three lines. pnpm's `supportedArchitectures` includes all platform binaries in one lockfile. Problem solved.

**Belief destroyed:**

I used to think deployment failures meant something was wrong with my code.

Now I understand: deployment is where your assumptions about infrastructure die. The code was fine. My mental model of the build system was wrong. And I had been lucky, not competent, every time it worked before.

**One human sentence:**

When the 13th commit finally deployed, I didn't celebrate. I just sat there wondering how many other things I thought I understood but didn't.

---

**Visual Plan:**

Dark background. A single commit timeline spiraling downward, each node a failed attempt. At the bottom, a tiny green checkmark. Caption: "13 commits. One lesson. I never understood builds."

---

### POST 2: The Secret I Shipped

**Opening: Anger at past self**

---

I found a hardcoded JWT secret in our production auth code yesterday.

I wrote it.

```typescript
const jwtSecret = process.env.JWT_SECRET || 'development-secret-change-me';
```

That `||` was a kindness to myself six months ago. "Just make it work in dev," I thought. "I'll fix it later."

Later never came. The code worked. Tests passed. The fallback silently caught every environment where I forgot to set the variable—including production.

**The fix was four lines:**

```typescript
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret && process.env.NODE_ENV !== 'test') {
  throw new Error('FATAL: JWT_SECRET is required');
}
```

**Belief destroyed:**

I used to believe that working code is safe code.

Now I understand: convenience in security-critical paths is always a deferred vulnerability. The line I wrote to help myself was the line that could have destroyed us. "Helpful" and "dangerous" can be the same thing.

**One human sentence:**

I stared at that `||` operator for a full minute, trying to remember who I was when I wrote it. I couldn't. That scared me more than the bug.

**Principle:**

I no longer write fallbacks in auth code. If something is required, it must crash loudly when missing. Silence is the enemy.

---

**Visual Plan:**

Split screen. Left: the dangerous line, highlighted in red, with a friendly comment "// for dev convenience". Right: the fixed version, highlighted in green, with the comment crossed out. Caption: "The most dangerous code I ever wrote looked helpful."

---

## WEEK 2

### POST 3: Rotating Secrets Without Permission

**Opening: Relief**

---

We needed to rotate our JWT secret after finding the hardcoded fallback.

The obvious approach: change the secret, deploy, watch 10,000 users get logged out simultaneously.

I almost did it. I had the PR ready. Then I stopped and asked: what if I'm wrong about how many active sessions exist?

**The dual-key pattern:**

```typescript
function verifyAccessToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, config.secret);
  } catch (err) {
    if (config.secretOld) {
      return jwt.verify(token, config.secretOld);
    }
    throw err;
  }
}
```

Set the old secret as `JWT_SECRET_OLD`. Set the new secret as `JWT_SECRET`. Deploy. Wait for token TTL. Remove old secret. Done.

Nobody logged out. Nobody noticed.

**Belief destroyed:**

I used to believe that credential rotation was inherently disruptive—that you had to accept some pain to do it right.

Now I know that's a failure of imagination. Any system that forces you to choose between security and user experience is a system that wasn't designed for the real world.

**One human sentence:**

The rotation completed at 2 PM on a Tuesday. I refreshed our analytics looking for a spike in logouts. Nothing. I refreshed again. Still nothing. I didn't trust it for three days.

**Principle:**

I no longer accept "this will log users out" as a constraint. That's not a fact about rotation. That's a fact about how you built rotation.

---

**Visual Plan:**

A calendar showing "Tuesday, 2:14 PM" with a tiny annotation: "Secret rotated. No one noticed." Below: the rotation timeline showing both secrets valid simultaneously. Caption: "The best security operations are invisible."

---

### POST 4: Catching Thieves

**Opening: Wrong decision revealed**

---

For months, our refresh token system had a simple rule: if the token is valid, grant access.

I thought that was correct. Valid token = legitimate user.

I was wrong.

**The scenario I never considered:**

Attacker steals a refresh token. Attacker uses it. I issue a new token to the attacker. Real user tries to refresh. Their token is still valid—but the attacker already used it.

Both tokens are valid. Both users are "legitimate." I have no way to know which is real.

**The fix: token families**

```
Login: token(fid=abc, gen=1)
Refresh: token(fid=abc, gen=1) → token(fid=abc, gen=2)
         [gen=1 marked as used]

Attacker uses: token(fid=abc, gen=1)
System: "gen=1 already used" → REVOKE entire family
```

One-time use. Generation tracking. If any token in a family is used twice, someone has a copy. Burn the whole family.

**Belief destroyed:**

I used to believe that token validity was binary—either it's valid or it's not.

Now I understand: validity is necessary but not sufficient. A token can be valid and stolen. A token can be correctly signed and used by an attacker. My auth system was checking the wrong thing.

**One human sentence:**

I implemented theft detection in four hours. Then I lay awake that night thinking about how long the vulnerability had existed. I couldn't calculate it. I didn't want to.

**Principle:**

I no longer trust any auth system that cannot detect its own compromise. If you can't see the attack, you can't stop the attack.

---

**Visual Plan:**

Two timelines running in parallel: "Legitimate User" and "Attacker". They diverge at "Stolen Token". The attacker's path hits a wall labeled "ALREADY USED". Caption: "The system doesn't ask 'is this valid?' It asks 'is this the first time?'"

---

## WEEK 3

### POST 5: Killing My Darlings

**Opening: Anger at past self**

---

At one point, I had three E2E testing frameworks in the same codebase.

Cypress. Puppeteer. Playwright.

I told myself it was "defense in depth." Different tools for different needs. Comprehensive coverage.

It was actually cowardice. I was afraid to delete things.

**The reality:**

- CI took 45 minutes
- Three different APIs to remember
- Three debugging workflows
- Tests that did the same thing in different syntax
- Nobody knew which framework to use for new tests

**The day I killed them:**

```
- Remove Cypress E2E tests (21 files)
- Remove Puppeteer tests (8 files)
- Remove Cypress CI workflow
- Playwright is now the single E2E framework
```

29 files deleted. CI dropped to 12 minutes. Cognitive load dropped to zero.

**Belief destroyed:**

I used to believe that more testing infrastructure meant better testing.

Now I know: testing infrastructure has negative returns. Every additional framework is a tax on every developer, on every PR, forever. The goal isn't more coverage—it's more clarity.

**One human sentence:**

Deleting those 29 files felt like admitting I had wasted months of work. I had. Admitting it was the first step to moving faster.

**Principle:**

I no longer measure testing by quantity of tools. I measure it by speed of feedback. One framework with fast feedback beats three frameworks with slow feedback, every time.

---

**Visual Plan:**

A graveyard with two tombstones: "Cypress" and "Puppeteer". In the background, a single healthy tree labeled "Playwright". Caption: "29 files deleted. Zero coverage lost."

---

### POST 6: The Dashboard That Lied

**Opening: Shame**

---

A user asked why their document count was always "12" even after uploading 50 documents.

I checked the code. The dashboard was hardcoded.

Not some of it. A lot of it.

```typescript
// In useApiData.ts - what I shipped
const documents = data || [/* 12 fake documents */];
```

The History page: static fake jobs.
The Settings page: "user@example.com" hardcoded.
The Quick Action buttons: did nothing.
The document count: always 12.

**How it happened:**

1. Designer gave me mockups with placeholder content
2. I built components with fake data "to test layout"
3. Real API wasn't ready
4. Someone else was supposed to wire it up
5. Nobody did
6. We shipped

**The cleanup commit:**

```
8 files changed
1,043 insertions(+)
884 deletions(-)
```

Almost 2,000 lines of code to make a dashboard stop lying.

**Belief destroyed:**

I used to believe that if it looks right, it's probably right.

Now I understand: demos are dangerous. A component that renders correctly with fake data is indistinguishable from a component that works. The visual output lied to me because I let it.

**One human sentence:**

When I found the hardcoded "12", I laughed. Then I searched the codebase for `|| []` and stopped laughing.

**Principle:**

I no longer allow fallback data in UI hooks. If the API fails, the UI fails. Loading state or error state. Never fake state.

---

**Visual Plan:**

A pristine dashboard with callout arrows pointing to each element. Each arrow labeled: "Fake" / "Hardcoded" / "Did nothing". Caption: "It looked finished. It was a lie."

---

## WEEK 4

### POST 7: The Bill That Almost Came

**Opening: Discovery**

---

I opened Upstash and saw 450,000 Redis requests.

In week two.

Free tier is 500,000 per month.

We had four Bull queues. They processed maybe 200 jobs a day total. There was no reason for that volume.

**What I found:**

Bull's defaults are aggressive:
- `stalledInterval`: 30 seconds (checks for stuck jobs)
- `guardInterval`: 5 seconds (internal heartbeat)
- `drainDelay`: 5 seconds
- `retryProcessDelay`: 5 seconds

With 4 queues at those settings: ~100,000 requests per day. On queues that were empty 99% of the time.

**The fix:**

```typescript
stalledInterval: 30_000 → 300_000  // 5 min
guardInterval: 5_000 → 300_000     // 5 min
drainDelay: 5_000 → 60_000         // 1 min
retryProcessDelay: 5_000 → 60_000  // 1 min
```

100,000/day → 5,000/day. One config change.

**Belief destroyed:**

I used to believe that library defaults were reasonable for my use case.

Now I know: library defaults optimize for the library's demo, not your reality. Every default is a decision someone else made about tradeoffs you never agreed to.

**One human sentence:**

I spent 30 minutes looking at the Upstash graph, watching the line climb toward 500k, doing math in my head. The queues were doing nothing. They were doing it loudly.

**Principle:**

I no longer trust defaults. Every configuration value is a question: "Is this appropriate for my scale, my budget, my latency requirements?" Usually the answer is no.

---

**Visual Plan:**

Two Redis usage graphs. Left: steep climb labeled "DEFAULTS" with a red danger zone at 500k. Right: flat line at 5k labeled "CONFIGURED". Caption: "The queues were empty. The requests were not."

---

### POST 8: The Crash I Couldn't Catch

**Opening: Confusion**

---

Our server kept dying.

No error. No stack trace. No caught exception. The process just... stopped. Health check failed. Restart. Work for a while. Die again.

I added try-catch blocks everywhere. Didn't help.

I added global error handlers. Didn't help.

I added uncaughtException handlers. Didn't help.

**The problem was invisible:**

Tesseract.js runs OCR in worker threads. When a worker encounters a bad image—corrupt file, weird encoding, password-protected PDF—it doesn't throw to your try-catch. It terminates. Emits an 'error' event. If you're not listening, the error bubbles up and kills the parent.

```typescript
// This catches nothing:
try {
  await worker.recognize(imagePath);
} catch (err) {
  // Worker errors don't come here
}

// This catches everything:
worker.on('error', (err) => {
  logger.error('Worker failed', { error: err });
});
```

**Belief destroyed:**

I used to believe that try-catch was sufficient error handling.

Now I understand: different execution contexts have different error semantics. Worker threads. Child processes. Streams. Promises before I added handlers. Try-catch is one tool for one context. The others will kill you while you're not looking.

**One human sentence:**

I found the fix by accident—reading Tesseract docs about something else, saw the .on('error') example, felt my stomach drop. That was it. That was the bug.

**Principle:**

I no longer assume I know how errors propagate. Every time I use workers, streams, or child processes, I explicitly map the error paths. Where do errors go? Not where I expect.

---

**Visual Plan:**

A try-catch block with an arrow showing an error going around it, not through it. The arrow leads to "PROCESS EXIT". Caption: "The error I couldn't catch was the one that didn't throw."

---

## WEEK 5

### POST 9: Running Two Auth Systems

**Opening: Fear**

---

We were migrating from custom JWT auth to Supabase.

The obvious approach: big-bang cutover. New auth on Tuesday. Old sessions invalid. Users re-login.

I couldn't do it. Too scared. What if Supabase had a bug? What if our integration was wrong? What if users couldn't log in for the launch?

So I built something weird: dual auth.

**For three weeks, our middleware did this:**

```typescript
async function verifyAuth(req, res, next) {
  // Try new system first
  const supabaseUser = await verifySupabaseToken(req);
  if (supabaseUser) return next();

  // Fall back to old system
  const legacyUser = await verifyLegacyJWT(req);
  if (legacyUser) {
    req.shouldMigrate = true;
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized' });
}
```

Old users kept working. New signups used Supabase. We watched metrics. Nothing broke.

**Belief destroyed:**

I used to believe that migrations required courage—that you had to accept risk to make progress.

Now I know: that's not courage, it's impatience. Real courage is building the escape hatch before you need it. Running both systems in parallel isn't indecision. It's engineering.

**One human sentence:**

For three weeks I checked the metrics every morning, waiting for the dual-auth system to fail. It never did. The fear never went away. It just became quieter.

**Principle:**

I no longer migrate critical systems without a parallel-run period. The old system stays alive until the new system proves itself. Not one day. Weeks. Long enough to trust.

---

**Visual Plan:**

A bridge being built next to another bridge. Cars driving on the old one while construction continues. Caption: "We didn't burn the old bridge until we trusted the new one."

---

### POST 10: The Colors That Lied

**Opening: Frustration**

---

Our dark mode looked wrong.

Not broken. Just... off. The green that popped in light mode looked muddy in dark mode. Warnings looked dimmer than errors. Hover states clashed with base colors.

I kept adjusting values manually. A little lighter here. More saturated there. Endless tweaking.

Then I learned that HSL lies.

**The problem:**

```css
/* HSL says these have the same "lightness" */
--green: hsl(142, 76%, 36%);  /* Looks bright */
--blue: hsl(220, 76%, 36%);   /* Looks dark */
```

"50% lightness" in HSL doesn't mean "50% perceived brightness." Human eyes perceive different hues at different intensities. HSL doesn't know that.

**The fix: OKLCH**

```css
/* OKLCH: perceptually uniform */
--green: oklch(0.65 0.19 145);  /* Actually same brightness */
--blue: oklch(0.65 0.18 255);   /* Actually same brightness */
```

Same lightness value = same perceived brightness. Dark mode becomes math, not guessing.

**60+ hardcoded colors replaced. 116 semantic tokens created.**

**Belief destroyed:**

I used to believe that color systems were "close enough"—that small perception differences didn't matter.

Now I understand: design systems that ignore perceptual reality create invisible debt. Every "slightly off" color is a judgment call waiting to be revisited. OKLCH made dark mode boring. That's the point.

**One human sentence:**

I spent two hours reading about color perception, feeling like I'd been lied to by every CSS tutorial I'd ever read. I had been.

**Principle:**

I no longer accept "looks about right" for systematic design decisions. If there's a mathematically correct answer, I want the math. Eyeballing creates hidden inconsistency.

---

**Visual Plan:**

Two color rows. Top row: HSL colors labeled "Same lightness value" but visually different brightness. Bottom row: OKLCH colors, actually uniform. Caption: "HSL lies. OKLCH doesn't."

---

## WEEK 6

### POST 11: The Test That Failed 40% of the Time

**Opening: Denial**

---

"Flaky."

That's what we called it. The auth test that passed locally and failed in CI 40% of the time. "It's just flaky. Re-run it."

I said that for two weeks. Then I decided to actually look.

**The bug:**

Parallel test workers shared a storage state file. Two workers would simultaneously:
1. Check if auth state exists
2. Both see it doesn't
3. Both login
4. Both write to the same file
5. Last write wins
6. Other worker's session is now invalid

Classic race condition. Obvious in hindsight. Invisible until I sat down and traced it.

**The fix:**

```typescript
async function getStorageState(user: string) {
  // Fast path: already exists
  if (await isValidState(statePath)) return statePath;

  // Acquire lock
  const lock = await acquireLock(`${user}.lock`);
  try {
    // Double-check after lock
    if (await isValidState(statePath)) return statePath;

    // Actually login
    await login(user, statePath);
    return statePath;
  } finally {
    await lock.release();
  }
}
```

40% failure rate → 0%.

**Belief destroyed:**

I used to believe that "flaky" was a category of test behavior.

Now I know: "flaky" is a confession that I haven't understood the bug yet. Every flaky test has a deterministic cause. The flakiness is in my knowledge, not the test.

**One human sentence:**

The moment I understood the race condition, I felt embarrassed. Not because it was hard. Because it was easy, and I had been too lazy to look.

**Principle:**

I no longer say "flaky" without following it with "...which means I need to investigate." The word isn't a diagnosis. It's an admission.

---

**Visual Plan:**

A test results screen showing "PASSED" and "FAILED" alternating randomly. Below it, a magnifying glass revealing the race condition diagram. Caption: "'Flaky' is not a root cause."

---

### POST 12: Building Something That Can Think

**Opening: Humility**

---

Our first AI feature was a single LLM call.

Document in. JSON out. Hope it worked.

It worked 80% of the time. The other 20%: hallucinated data, wrong field mappings, missed extractions. Users blamed themselves. "Maybe I uploaded a bad document."

No. The system was brittle. I had built a prototype and called it a product.

**The rewrite:**

```
[Classify] → [Extract] → [Map] → [QA] → [Finalize]
                                  ↓ (failure)
                           [Error Recover] → [QA]
```

Six nodes. State checkpoints. QA validation that catches hallucinations. Retry logic with temperature variation. Graceful degradation after three attempts.

**What tutorials don't tell you:**

1. LLM calls take 30+ seconds. Servers restart. You need persistent state.
2. Same input → same hallucination. Retry with variation.
3. "Try again" isn't error handling. Structured recovery is.
4. The QA node that validates output is more valuable than clever prompts.

**Belief destroyed:**

I used to believe that AI features were about prompt engineering—that if you got the prompt right, the system would work.

Now I understand: prompts are 20% of production AI. The other 80% is error handling, validation, observability, and the humility to admit that LLMs will be wrong and you need a plan for when they are.

**One human sentence:**

The first time the QA node caught a hallucination and the retry succeeded, I didn't feel smart. I felt lucky. Lucky I'd built the safety net before needing it.

**Principle:**

I no longer ship AI features without a QA layer. If I can't automatically detect when the model is wrong, I'm not building a system. I'm building a lottery.

---

**Visual Plan:**

A simple "Document → LLM → Output" pipeline labeled "Tutorial". Below it, the full 6-node pipeline with error paths labeled "Production". Caption: "The tutorial version worked 80% of the time. Production demands more."

---

# EDITORIAL REVIEW v2

## What Changed

| Aspect | v1 | v2 |
|--------|----|----|
| Opening | Context statement | Emotional state (doubt, anger, fear, shame) |
| Closing | Tactical advice | Belief destroyed + principle |
| Voice | Expert documenting | Human evolving |
| Structure | Consistent template | Deliberately varied |
| Human element | Code snippets | One revealing sentence per post |

## Belief Shifts Across the Arc

| Post | Belief Destroyed |
|------|-----------------|
| 1 | "Passing builds means deployment will work" |
| 2 | "Working code is safe code" |
| 3 | "Security requires user pain" |
| 4 | "Valid token = legitimate user" |
| 5 | "More testing tools = better testing" |
| 6 | "If it looks right, it is right" |
| 7 | "Library defaults are sensible" |
| 8 | "Try-catch catches errors" |
| 9 | "Migrations require courage/risk" |
| 10 | "Close enough is close enough for design" |
| 11 | "Flaky is a type of test" |
| 12 | "Good prompts = good AI" |

## Narrative Arc

The posts now trace an internal evolution:

**Weeks 1-2**: Learning that safety is an illusion
**Weeks 3-4**: Learning that systems lie to you
**Weeks 5-6**: Learning that caution is a feature, not a weakness

## Human Sentences (The Vulnerability Layer)

1. "I just sat there wondering how many other things I thought I understood but didn't."
2. "I stared at that || operator for a full minute. I couldn't remember who I was when I wrote it."
3. "I didn't trust it for three days."
4. "I lay awake thinking about how long the vulnerability had existed."
5. "Deleting those files felt like admitting I had wasted months."
6. "I searched for `|| []` and stopped laughing."
7. "The queues were doing nothing. They were doing it loudly."
8. "I felt my stomach drop. That was it. That was the bug."
9. "The fear never went away. It just became quieter."
10. "I felt like I'd been lied to by every CSS tutorial."
11. "It was easy, and I had been too lazy to look."
12. "I felt lucky. Lucky I'd built the safety net before needing it."

---

## Principles (The Memorable Layer)

1. "Deployment is where your assumptions about infrastructure die."
2. "Convenience in security-critical paths is always a deferred vulnerability."
3. "Any system that forces you to choose between security and UX wasn't designed for the real world."
4. "If you can't see the attack, you can't stop the attack."
5. "One framework with fast feedback beats three with slow feedback."
6. "Never fake state. Loading or error. Nothing else."
7. "Every default is a decision someone else made about tradeoffs you never agreed to."
8. "Try-catch is one tool for one context. The others will kill you."
9. "Running both systems in parallel isn't indecision. It's engineering."
10. "If there's a mathematically correct answer, I want the math."
11. "'Flaky' is not a root cause."
12. "If I can't detect when the model is wrong, I'm building a lottery."

---

*This is no longer an incident log. This is the evolution of an engineering mind.*
