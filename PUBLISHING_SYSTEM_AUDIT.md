# FULL PUBLISHING SYSTEM AUDIT — Halaqi

> **Date**: 2026-09-04
> **Scope**: End-to-end audit of the publishing system — from user tapping "Publish" to post appearing in feed.
> **Status**: Read-only audit. No files modified.

---

## A) PUBLISH FLOW MAP

```
[1] User Profile → Camera icon → File picker (image only)
      ↓
[2] FileReader.readAsDataURL(file) → preview shown in composer modal
      ↓
[3] User taps "نشر" button (disabled while publishing)
      ↓
[4] compressImageToDataUrl(file) → canvas resize to 1080px, JPEG 0.8
      ↓
[5] api.uploadImage(base64) → POST /api/uploads/image
      ↓
[6] Server: regex validate base64 → decode Buffer → upload to Supabase "avatars" bucket
      ↓
[7] Server returns: { success, imageUrl: supabase_public_url }
      ↓
[8] api.createUserPost({ imageUrl, caption }) → POST /api/user-posts
      ↓
[9] Server: requireAuth (re-fetch user from Neon) → validate → moderateContent(caption)
      ↓
[10] DB: INSERT INTO user_posts → return post object
      ↓
[11] Server returns 201 { success, post }
      ↓
[12] Frontend: notify success → reset composer → prepend post to profile posts array
```

**Feed retrieval (separate path):**
```
[13] PostsView mount → api.getUnifiedPostsFeed() → GET /api/posts/feed
      ↓
[14] DB: UNION salon_posts + user_posts → ORDER BY created_at DESC LIMIT 100
      ↓
[15] In-memory scoring (cold start + interest + trending + diversity pass)
      ↓
[16] app.ts: filter blocked users (extra Neon query)
      ↓
[17] Return all posts → Frontend renders in snap-scroll container
```

---

## B) CURRENT ARCHITECTURE

```
Client (React/Vite)
  │
  ├─ compressImage() → base64 data URL
  │
  ├─ POST /api/uploads/image ─────────→ Express (Vercel Serverless)
  │   (base64 body, no timeout)           │
  │                                       ├─ requireAuth (Neon re-fetch)
  │                                       ├─ regex MIME check
  │                                       ├─ decode base64 → Buffer
  │                                       └─ Supabase storage.from('avatars').upload()
  │                                              ↓
  │                                       Supabase Storage (CDN)
  │
  ├─ POST /api/user-posts ───────────→ Express (Vercel Serverless)
  │   (imageUrl + caption)                 │
  │                                       ├─ requireAuth (Neon re-fetch AGAIN)
  │                                       ├─ moderateContent(caption)
  │                                       └─ INSERT INTO user_posts (Neon)
  │
  └─ GET /api/posts/feed ────────────→ Express (Vercel Serverless)
      (unauthenticated)                    │
                                          ├─ UNION salon_posts + user_posts
                                          ├─ In-memory scoring (JS)
                                          ├─ Filter blocked users
                                          └─ Return 100 posts max
```

**Storage**: Supabase Storage bucket `'avatars'` — images AND videos share same bucket.
**Database**: Neon (PostgreSQL) — serverless pg driver.
**No CDN cache headers**, **no pagination**, **no background jobs**.

---

## C) FINDINGS

### F-01 — CRITICAL: Salon Post Routes Missing (Regression)

- **Severity**: CRITICAL
- **File**: `src/server/app.ts`
- **Lines**: Entire file — `POST /api/salon-posts` and `DELETE /api/salon-posts/:id` absent
- **Problem**: During refactoring, the create and delete endpoints for salon posts were removed from `app.ts`. The DB functions `createSalonPost` and `deleteSalonPost` still exist in `db.ts:5746-5820` and `db.ts:5822-5906`. The client `api.ts:2165-2190` still calls `POST /api/salon-posts` and `DELETE /api/salon-posts/:id`.
- **Why**: Multiple refactors of `app.ts` (backups show the routes existed in `app.ts.before-user-posts-feed-fix` and earlier). Routes were likely dropped when sections were copy-pasted.
- **Impact**: Salon owners get 404 when creating/deleting posts. Completely broken feature.
- **Scenario**: Salon owner taps "Publish" → API returns 404 → user sees error.
- **Fix**: Restore `POST /api/salon-posts` and `DELETE /api/salon-posts/:id` routes in `app.ts`, calling existing `db.createSalonPost` / `db.deleteSalonPost` with proper auth (`requireSalonOwnerOrAdmin`).
- **Files affected**: `src/server/app.ts`
- **Schema change**: No
- **Migration**: No

---

### F-02 — CRITICAL: No Rate Limiting on Post Creation

- **Severity**: CRITICAL
- **File**: `src/server/app.ts:2370-2443` (POST /api/user-posts)
- **Lines**: 2370
- **Problem**: `POST /api/user-posts` has NO rate limiter. An authenticated user can create unlimited posts per second. Same for `POST /api/uploads/image` (line 1940) and `POST /api/uploads/video` (line 2047).
- **Why**: Rate limiters were only added for auth endpoints (login, register, OTP). Post creation was never rate-limited.
- **Impact**: Spam flood, Supabase storage abuse, Neon write storm, degraded experience for all users.
- **Scenario**: Script sends 1000 POST /api/user-posts requests → creates 1000 posts, each with a Supabase upload → storage fills, Neon slows, feed becomes spam.
- **Fix**: Add `postCreateRateLimiter` to `rateLimitStore.ts` (e.g., 10/min per user) and apply to POST /api/user-posts, POST /api/uploads/image, POST /api/uploads/video.
- **Files affected**: `src/server/rateLimitStore.ts`, `src/server/app.ts`
- **Schema change**: No
- **Migration**: No

---

### F-03 — CRITICAL: No Duplicate Post Prevention

- **Severity**: CRITICAL
- **File**: `src/server/db.ts:5650-5744`
- **Lines**: 5687
- **Problem**: `createUserPost` generates ID as `user_post_${Date.now()}_${random5}` with no idempotency key. Double-click (if button is not disabled fast enough) or network retry creates identical posts. `createUserPost` has no `ON CONFLICT DO NOTHING` (unlike `createSalonPost` which has `ON CONFLICT (id) DO NOTHING` at line 5809). The `Date.now()` is millisecond-precision — two requests in the same millisecond could collide on the random suffix.
- **Why**: No deduplication mechanism at any layer.
- **Impact**: Duplicate posts appear in feed. User sees their post twice.
- **Scenario**: User taps "نشر" twice rapidly → two identical posts created → both appear in feed.
- **Fix**: Add client-side debounce + server-side idempotency (e.g., hash(user_id + caption + image_hash) with unique constraint, or ON CONFLICT).
- **Files affected**: `src/server/db.ts`, `src/server/app.ts`, `src/components/profile/UserProfileView.tsx`
- **Schema change**: Possibly (add unique constraint)
- **Migration**: Yes (if adding unique index)

---

### F-04 — HIGH: No Image Size Limit on Upload

- **Severity**: HIGH
- **File**: `src/server/app.ts:1940-2019`
- **Lines**: 1960-1975
- **Problem**: Image upload accepts ANY base64 string matching `data:image/(jpeg|jpg|png|webp);base64,...` with NO file size limit. A 50MB image (approx 67MB base64) is accepted. Video has a 60MB limit (`app.ts:2084`) but images have none.
- **Why**: Only a regex check exists. No `Buffer.byteLength()` check.
- **Impact**: Memory exhaustion on Vercel serverless (80MB body parser limit at `app.ts:53`), large Supabase uploads, slow processing.
- **Scenario**: User uploads a 40MB raw photo → base64 is ~53MB → server allocates 53MB Buffer → hits Vercel's 80MB body limit or runs out of memory.
- **Fix**: Add size check: `if (Buffer.byteLength(match[2], 'base64') > MAX_IMAGE_BYTES) return 413`.
- **Files affected**: `src/server/app.ts`
- **Schema change**: No

---

### F-05 — HIGH: No Server-Side URL Validation on Post Image

- **Severity**: HIGH
- **File**: `src/server/app.ts:2370-2443` (POST /api/user-posts)
- **Lines**: 2378-2387
- **Problem**: The `POST /api/user-posts` endpoint accepts any string as `imageUrl`. It does NOT verify that the URL actually points to the Supabase storage bucket or is even a valid URL. An attacker could pass `https://evil.com/track.gif` and it would be stored in `user_posts.image_url` and served to all feed viewers.
- **Why**: The upload and post-creation are separate requests. The server trusts the client to pass the URL from the upload step.
- **Impact**: XSS via image URL, tracking pixels, serving malicious content to users.
- **Scenario**: Attacker skips upload step, directly calls `POST /api/user-posts` with `{ imageUrl: "https://evil.com/pixel.gif", caption: "Hello" }` → post appears in feed with tracking image.
- **Fix**: Validate `imageUrl` matches `https://<supabase-host>/storage/v1/object/public/avatars/*` pattern before INSERT.
- **Files affected**: `src/server/app.ts`, `src/server/db.ts`
- **Schema change**: No

---

### F-06 — HIGH: Feed Has No Pagination

- **Severity**: HIGH
- **File**: `src/server/db.ts:5335-5648`
- **Lines**: 5456, 76
- **Problem**: `getUnifiedPostsFeed` returns all posts up to `FEED_LIMIT = 100` with no cursor/offset/pagination. The API endpoint `GET /api/posts/feed` accepts no pagination parameters. After 100 posts exist, older posts are unreachable.
- **Why**: Initial MVP design. No pagination was implemented.
- **Impact**: As the platform grows, users can only see the top 100 posts. No way to see older content. Performance degrades as the full UNION query + in-memory scoring must process all posts.
- **Scenario**: Platform has 500 posts → user only sees 100 → scroll reaches bottom → no more content → no "load more".
- **Fix**: Add cursor-based pagination (e.g., `?cursor=<created_at>&limit=20`). Use `created_at` + `id` as cursor for stable ordering.
- **Files affected**: `src/server/app.ts`, `src/server/db.ts`, `src/services/api.ts`, `src/components/posts/PostsView.tsx`
- **Schema change**: No
- **Migration**: No

---

### F-07 — HIGH: No Feed Refresh / Pull-to-Refresh

- **Severity**: HIGH
- **File**: `src/components/posts/PostsView.tsx:199-302`
- **Lines**: 199-302
- **Problem**: Feed loads once on mount via `useEffect`. No pull-to-refresh, no refresh button, no polling, no WebSocket/SSE for live updates. If a user creates a post and navigates to the feed, they must unmount and remount the component to see it.
- **Why**: No real-time infrastructure. Feed was designed as a one-shot load.
- **Impact**: Stale feed. New posts invisible until page reload. Poor UX for a social platform.
- **Scenario**: User creates post → navigates to feed → post not visible → must close app and reopen.
- **Fix**: Add pull-to-refresh (touch gesture or button), or polling with `setInterval`, or optimistic insert from creation flow.
- **Files affected**: `src/components/posts/PostsView.tsx`
- **Schema change**: No

---

### F-08 — HIGH: Orphan Uploads on Post Creation Failure

- **Severity**: HIGH
- **File**: `src/components/profile/UserProfileView.tsx:239-281`
- **Lines**: 260-281
- **Problem**: Two-step process: (1) upload image to Supabase, (2) create post record. If step 1 succeeds but step 2 fails (network error, DB error, moderation block), the image is uploaded to Supabase but never referenced by any post — an orphan file. No cleanup mechanism exists.
- **Why**: No transactional coordination between Supabase upload and Neon INSERT. No compensating action on failure.
- **Impact**: Storage leaks accumulate over time. Storage costs increase.
- **Scenario**: User uploads image → Supabase returns URL → `createUserPost` fails (e.g., moderation block) → user sees error → image remains in Supabase forever.
- **Fix**: On post creation failure, call `deleteStoredMedia(imageUrl)` to clean up. Or use a two-phase commit pattern (staging → confirm → finalize).
- **Files affected**: `src/components/profile/UserProfileView.tsx`, `src/server/app.ts`
- **Schema change**: No

---

### F-09 — MEDIUM: Auth Middleware Re-Fetches Neon on Every Request

- **Severity**: MEDIUM
- **File**: `src/server/authMiddleware.ts:121-198`
- **Lines**: 148
- **Problem**: `requireAuth` calls `db.getUserByIdFromNeon(payload.userId)` on EVERY request. For the post creation flow, this means 2 Neon round-trips (one for upload, one for create). On Vercel cold starts, this adds ~200-500ms per request.
- **Why**: Security design — Neon is source of truth for ban/active status. But it means every authenticated request pays the latency cost.
- **Impact**: Post creation takes 2x Neon latency. Cold starts are slow.
- **Scenario**: User publishes → upload hits Neon (auth check) → create hits Neon again (auth check) → total 2 Neon round-trips just for auth.
- **Fix**: Consider caching user auth state with short TTL (30s) in `state.users`, with `requireAuth` checking cache first and Neon as fallback (like `optionalAuthMiddleware` already does).
- **Files affected**: `src/server/authMiddleware.ts`
- **Schema change**: No

---

### F-10 — MEDIUM: Video Upload No Timeout / Resume

- **Severity**: MEDIUM
- **File**: `src/services/api.ts:958-980`
- **Lines**: 958-980
- **Problem**: `uploadVideo` uses `timeout: 0` (no timeout). Large video files (up to 60MB) upload with no timeout, no progress indicator, no resume capability. If the connection drops mid-upload, the user has no feedback.
- **Why**: `timeout: 0` was set to avoid aborting large uploads.
- **Impact**: Hung uploads, no user feedback, wasted bandwidth on failure.
- **Scenario**: User uploads 50MB video → connection drops at 40MB → spinner spins forever → user force-closes app → upload abandoned → orphan file in Supabase.
- **Fix**: Add upload progress tracking (XMLHttpRequest or `fetch` with `ReadableStream`), timeout with retry, and cleanup on abort.
- **Files affected**: `src/services/api.ts`, `src/server/app.ts`, `src/components/posts/ReelsView.tsx`
- **Schema change**: No

---

### F-11 — MEDIUM: No Lazy Loading for Feed Images

- **Severity**: MEDIUM
- **File**: `src/components/posts/PostsView.tsx`
- **Lines**: Post rendering (snap-scroll container)
- **Problem**: All 100 posts render their images eagerly. No `loading="lazy"`, no intersection observer for images, no placeholder/skeleton. The `ImageViewer.tsx:64` also has no lazy loading.
- **Why**: snap-scroll design renders all posts for smooth scrolling.
- **Impact**: 100 images load simultaneously on feed open. High bandwidth on mobile, slow initial render.
- **Scenario**: User opens feed → 100 images start downloading → mobile data meter drains → initial paint is slow.
- **Fix**: Add `loading="lazy"` to `<img>` tags, use intersection observer for post visibility, consider virtualized list.
- **Files affected**: `src/components/posts/PostsView.tsx`, `src/components/common/ImageViewer.tsx`
- **Schema change**: No

---

### F-12 — MEDIUM: No Post Content Validation (Caption Length)

- **Severity**: MEDIUM
- **File**: `src/server/db.ts:5650-5744`
- **Lines**: 5674-5680
- **Problem**: Caption has no maximum length check. `moderateContent(caption)` runs the profanity filter but doesn't check length. A 100KB caption would be stored and displayed.
- **Why**: No validation was added for caption length.
- **Impact**: oversized text in feed, performance issues, potential XSS vector (though React escapes by default).
- **Scenario**: User pastes 100KB of text → stored in DB → rendered in feed → DOM bloat, scroll performance degrades.
- **Fix**: Add `if (captionText.length > 2000) return { success: false, error: '...' }` server-side and client-side.
- **Files affected**: `src/server/db.ts`, `src/server/app.ts`
- **Schema change**: No

---

### F-13 — MEDIUM: Unauthenticated Feed Endpoint

- **Severity**: MEDIUM
- **File**: `src/server/app.ts:1257-1299`
- **Lines**: 1257
- **Problem**: `GET /api/posts/feed` uses no auth middleware. Anyone (including bots) can fetch the full feed. The `liked_by_me` field is correctly null for unauthenticated users, but the full post data (including user IDs, names, images) is exposed.
- **Why**: Design choice for public browsing.
- **Impact**: Data scraping, bot abuse, no rate limiting on feed reads.
- **Scenario**: Bot crawls `/api/posts/feed` repeatedly → scrapes all post data, user info, images.
- **Fix**: Add rate limiting to feed endpoint. Consider requiring auth for feed access.
- **Files affected**: `src/server/app.ts`
- **Schema change**: No

---

### F-14 — MEDIUM: Post ID is Not a UUID

- **Severity**: MEDIUM
- **File**: `src/server/db.ts:5687`
- **Lines**: 5687
- **Problem**: Post ID is `user_post_${Date.now()}_${random5}` — not a UUID. This is predictable (timestamp-based) and has collision risk (only 5 random chars = 36^5 = ~60M possibilities). If two requests land in the same millisecond, the random suffix could collide.
- **Why**: Legacy ID generation pattern.
- **Impact**: ID collisions (rare but possible), predictable IDs for enumeration.
- **Scenario**: Two concurrent requests at `Date.now() = 1725470000000` → both get `user_post_1725470000000_` → if random suffixes match (1/60M) → one INSERT fails (no ON CONFLICT).
- **Fix**: Use `crypto.randomUUID()` or at least increase random suffix to 12+ chars.
- **Files affected**: `src/server/db.ts`
- **Schema change**: No

---

### F-15 — LOW: Duplicate Route Handlers in app.ts

- **Severity**: LOW
- **File**: `src/server/app.ts`
- **Lines**: Multiple (1403, 1538, 2042, 2298, 2333, 2361)
- **Problem**: Multiple `app.delete('/api/admin/users/:id')` handlers registered. Express calls the first matching handler; later registrations are dead code.
- **Why**: Multiple refactors without cleanup.
- **Impact**: Dead code, confusion during debugging.
- **Fix**: Remove duplicate route registrations.
- **Files affected**: `src/server/app.ts`
- **Schema change**: No

---

### F-16 — LOW: Feed Excludes Video Posts

- **Severity**: LOW (by design, but worth noting)
- **File**: `src/server/db.ts:5452`
- **Lines**: 5452
- **Problem**: `WHERE up.media_type IS DISTINCT FROM 'video'` excludes ALL video/reel posts from the main feed. Videos are only accessible via the Reels tab.
- **Why**: Design choice — separate feed for Reels.
- **Impact**: Video creators get no feed exposure. Engagement is split across two tabs.
- **Fix**: Consider mixing some video posts into the main feed (e.g., 1 video per 10 image posts).
- **Files affected**: `src/server/db.ts`
- **Schema change**: No

---

## D) PLATFORM-GRADE GAP ANALYSIS

| Category | Current | Required (Social Platform) | Gap |
|----------|---------|---------------------------|-----|
| **Reliability** | No retry, no timeout on upload, no cleanup on failure | Retry with backoff, timeout, cleanup, idempotency | 🔴 Critical gap |
| **Consistency** | Two-step (upload + create) with no transaction | Atomic or saga pattern with compensation | 🔴 Critical gap |
| **Idempotency** | None — unlimited duplicates | Client idempotency key + server dedup | 🔴 Critical gap |
| **Upload handling** | No size limit for images, no progress, no resume | Size limits, progress, resume, chunking | 🟡 Major gap |
| **Media processing** | Client-side JPEG compression only | Server-side validation, resize, format conversion, thumbnails | 🟡 Major gap |
| **Feed consistency** | Optimistic prepend (profile only), no refresh | Real-time updates, polling, or SSE | 🟡 Major gap |
| **Caching** | None | HTTP cache headers, CDN, stale-while-revalidate | 🟡 Major gap |
| **Pagination** | Fixed LIMIT 100, no cursor | Cursor-based infinite scroll | 🟡 Major gap |
| **Security** | No rate limiting on posts, no URL validation, no caption length | Rate limits, URL allowlist, length limits | 🔴 Critical gap |
| **Observability** | console.error only | Structured logging, metrics, alerts | 🟡 Major gap |
| **Scalability** | In-memory scoring of 100 posts | DB-level ranking, caching, pagination | 🟡 Major gap |
| **Mobile UX** | No lazy loading, no pull-to-refresh, no progress | Virtualized list, lazy load, pull-to-refresh, upload progress | 🟡 Major gap |

---

## E) TARGET ARCHITECTURE

```
Client (React/Vite)
  │
  ├─ Image: compress → base64 → POST /api/uploads/image
  │                                ↓
  │                           Supabase Storage (avatars bucket)
  │                                ↓
  │                           Return publicUrl
  │
  ├─ Post: POST /api/user-posts {imageUrl, caption}
  │        ↓
  │   requireAuth (cached 30s) → validate URL (allowlist) → moderateContent
  │        ↓
  │   INSERT INTO user_posts (with ON CONFLICT protection)
  │        ↓
  │   Return post → optimistic prepend in feed + profile
  │
  ├─ Feed: GET /api/posts/feed?cursor=<ts>&limit=20
  │        ↓
  │   UNION with cursor pagination → scored in DB → return page
  │        ↓
  │   Client renders page → "Load More" on scroll bottom
  │
  └─ Rate limits:
       - postCreate: 10/min/user
       - uploadImage: 20/min/user
       - feedRead: 60/min/IP
```

**Key improvements over current:**
1. **Rate limiting** on all write endpoints
2. **URL validation** on post creation (allowlist Supabase URLs)
3. **Caption length limit** (2000 chars)
4. **Idempotency key** (hash of user+content+timestamp window)
5. **Orphan cleanup** on post creation failure
6. **Cursor-based pagination** for feed
7. **Image lazy loading** with `loading="lazy"`
8. **Pull-to-refresh** on feed
9. **Auth caching** (30s TTL)
10. **Upload progress** indicator

---

## F) REPAIR PLAN

### P0 — Must Fix Before Any Release

#### F-01: Restore Salon Post Routes
- **Files**: `src/server/app.ts`
- **Change**: Add `POST /api/salon-posts` and `DELETE /api/salon-posts/:id` with `requireSalonOwnerOrAdmin`
- **Why**: Feature completely broken
- **Schema change**: No
- **Migration**: No
- **Dependencies**: None
- **Storage/CDN**: No
- **Environment variables**: No
- **Risk**: Low — routes + DB functions already exist, just need wiring

#### F-02: Rate Limiting on Post/Upload Endpoints
- **Files**: `src/server/rateLimitStore.ts`, `src/server/app.ts`
- **Change**: Add `postCreateRateLimiter`, `uploadRateLimiter`, apply to 3 endpoints
- **Why**: Spam/flood protection
- **Schema change**: No
- **Migration**: No
- **Dependencies**: None
- **Storage/CDN**: No
- **Environment variables**: No
- **Risk**: Low — additive only

#### F-03: Duplicate Post Prevention
- **Files**: `src/server/db.ts`, `src/components/profile/UserProfileView.tsx`
- **Change**: Add client-side debounce (500ms), server-side idempotency hash check
- **Why**: Duplicate posts degrade UX
- **Schema change**: Possibly (add unique constraint on dedup hash)
- **Migration**: Yes (if adding column + index)
- **Dependencies**: None
- **Storage/CDN**: No
- **Environment variables**: No
- **Risk**: Medium — needs careful dedup window design

### P1 — Should Fix Before Scale

#### F-04: Image Size Limit
- **Files**: `src/server/app.ts`
- **Change**: Add `Buffer.byteLength` check, max 10MB
- **Why**: Memory/storage protection
- **Schema change**: No
- **Migration**: No
- **Dependencies**: None
- **Storage/CDN**: No
- **Environment variables**: No
- **Risk**: Low

#### F-05: Server-Side URL Validation
- **Files**: `src/server/app.ts`
- **Change**: Validate `imageUrl` matches Supabase pattern
- **Why**: Security — prevent arbitrary URLs
- **Schema change**: No
- **Migration**: No
- **Dependencies**: None
- **Storage/CDN**: No
- **Environment variables**: No
- **Risk**: Low

#### F-06: Feed Pagination
- **Files**: `src/server/db.ts`, `src/server/app.ts`, `src/services/api.ts`, `src/components/posts/PostsView.tsx`
- **Change**: Cursor-based pagination with `?cursor=&limit=20`
- **Why**: Scalability, performance
- **Schema change**: No
- **Migration**: No
- **Dependencies**: None
- **Storage/CDN**: No
- **Environment variables**: No
- **Risk**: Medium — feed scoring needs to work with pages

#### F-07: Feed Refresh
- **Files**: `src/components/posts/PostsView.tsx`
- **Change**: Add pull-to-refresh or refresh button
- **Why**: UX — users expect to see new content
- **Schema change**: No
- **Migration**: No
- **Dependencies**: None
- **Storage/CDN**: No
- **Environment variables**: No
- **Risk**: Low

#### F-08: Orphan Cleanup
- **Files**: `src/components/profile/UserProfileView.tsx`, `src/components/posts/ReelsView.tsx`
- **Change**: On post creation failure, call `deleteStoredMedia()`
- **Why**: Storage cost, cleanliness
- **Schema change**: No
- **Migration**: No
- **Dependencies**: None
- **Storage/CDN**: No
- **Environment variables**: No
- **Risk**: Low

### P2 — Improve Before Production Scale

#### F-09: Auth Caching
- **Files**: `src/server/authMiddleware.ts`
- **Change**: Cache user auth state with 30s TTL in `state.users`
- **Why**: Reduce Neon latency per request
- **Schema change**: No
- **Migration**: No
- **Risk**: Low — short TTL means stale data window is minimal

#### F-10: Upload Progress/Resume
- **Files**: `src/services/api.ts`, `src/components/posts/ReelsView.tsx`
- **Change**: Use XMLHttpRequest with progress events, add timeout+retry
- **Why**: UX — users need upload feedback
- **Schema change**: No
- **Migration**: No
- **Risk**: Medium — changes upload mechanism

#### F-11: Image Lazy Loading
- **Files**: `src/components/posts/PostsView.tsx`, `src/components/common/ImageViewer.tsx`
- **Change**: Add `loading="lazy"` to `<img>` tags
- **Why**: Performance — reduce initial bandwidth
- **Schema change**: No
- **Migration**: No
- **Risk**: Low

#### F-12: Caption Length Limit
- **Files**: `src/server/db.ts`, `src/server/app.ts`
- **Change**: Add `if (captionText.length > 2000) return error`
- **Why**: Prevent oversized text
- **Schema change**: No
- **Migration**: No
- **Risk**: Low

#### F-13: Feed Rate Limiting
- **Files**: `src/server/app.ts`
- **Change**: Add `feedReadRateLimiter` to GET /api/posts/feed
- **Why**: Prevent bot scraping
- **Schema change**: No
- **Migration**: No
- **Risk**: Low

### P3 — Nice to Have

#### F-14: UUID-based Post IDs
- **Files**: `src/server/db.ts`
- **Change**: Use `crypto.randomUUID()` for post IDs
- **Why**: Collision prevention, non-predictable IDs
- **Schema change**: No
- **Migration**: No
- **Risk**: Low

#### F-15: Remove Duplicate Routes
- **Files**: `src/server/app.ts`
- **Change**: Remove duplicate `app.delete('/api/admin/users/:id')` registrations
- **Why**: Code cleanliness
- **Schema change**: No
- **Migration**: No
- **Risk**: Low

#### F-16: Video in Main Feed
- **Files**: `src/server/db.ts`
- **Change**: Mix video posts into main feed (e.g., 1 per 10 image posts)
- **Why**: Better content discovery for video creators
- **Schema change**: No
- **Migration**: No
- **Risk**: Low

---

## G) TEST PLAN

### Unit Tests

| Test | Scenario | Expected |
|------|----------|----------|
| `createUserPost duplicate` | Same request twice within 1ms | Second returns dedup error or same post |
| `createUserPost moderation block` | Caption contains profanity | blocked=true, no DB insert |
| `createUserPost no media no caption` | Empty post | success=false |
| `uploadImage invalid MIME` | `data:text/html;base64,...` | 400 |
| `uploadImage oversized` | 20MB base64 | 413 |
| `uploadImage valid JPEG` | `data:image/jpeg;base64,...` | 201 + Supabase URL |
| `post URL validation` | imageUrl = `https://evil.com/x.gif` | 400 |
| `caption length` | 10001 chars | 400 |
| `rate limit post creation` | 11 posts in 1 minute | 429 |
| `rate limit upload` | 21 uploads in 1 minute | 429 |

### Integration Tests

| Test | Scenario | Expected |
|------|----------|----------|
| `full publish flow` | Upload → create → verify in feed | Post appears in GET /api/posts/feed |
| `publish + delete` | Create → delete → verify removed + image deleted from Supabase | Post gone, image gone |
| `orphan cleanup` | Upload succeeds, create fails (moderation) | Image cleaned up from Supabase |
| `feed pagination` | Create 30 posts → fetch page 1 (20) → fetch page 2 (10) | Correct posts per page |
| `feed ordering` | Create posts at T1, T2, T3 → fetch feed | T3, T2, T1 order |
| `concurrent publish` | 5 requests in parallel | 5 unique posts, no duplicates |
| `auth expiry during publish` | Token expires between upload and create | 401, no orphan |
| `salon post create/delete` | Salon owner creates → deletes | Both succeed, image cleaned |

### Failure Scenario Tests

| Test | Scenario | Expected |
|------|----------|----------|
| `network timeout on upload` | Abort after 5s | Client error, no orphan |
| `DB failure after upload` | Neon down after Supabase upload | 500, orphan flagged for cleanup |
| `double click publish` | Two rapid clicks | Only one post created |
| `page close during upload` | User closes tab | Orphan in Supabase (acceptable, cleaned by TTL) |
| `expired auth` | Token expired | 401, no upload attempted |
| `invalid media type` | Video file uploaded as image | 400 at regex check |

---

## H) FINAL VERDICT

### Production-Grade Publishing Score: **38/100**

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Reliability | 25/100 | 20% | 5.0 |
| Consistency | 20/100 | 15% | 3.0 |
| Idempotency | 10/100 | 10% | 1.0 |
| Upload handling | 40/100 | 10% | 4.0 |
| Media processing | 35/100 | 5% | 1.75 |
| Feed consistency | 30/100 | 10% | 3.0 |
| Caching | 10/100 | 5% | 0.5 |
| Pagination | 10/100 | 5% | 0.5 |
| Security | 35/100 | 10% | 3.5 |
| Observability | 20/100 | 5% | 1.0 |
| Scalability | 30/100 | 5% | 1.5 |
| **TOTAL** | | **100%** | **24.75 + bonus ~13 = 38** |

**Why 38 and not lower:**
- Moderation system is genuinely strong (dual-layer, multilingual)
- Auth + RBAC is solid (re-fetched from Neon, ban check)
- Supabase CDN for media is a good foundation
- Post deletion properly cleans user-post images
- Interest-based feed scoring is sophisticated

**Why not higher:**
- 3 CRITICAL issues (missing routes, no rate limiting, no dedup)
- No pagination, no refresh, no lazy loading
- Two-step publish without compensation = orphan risk
- No server-side URL validation = security hole
- No image size limit = memory/storage risk

**Bottom line:** The system works for a demo with a handful of users. It is NOT production-ready for a social platform. The P0 fixes (F-01, F-02, F-03) are relatively low-effort and should be done immediately. The P1 fixes (F-04 through F-08) are needed before any public launch.
