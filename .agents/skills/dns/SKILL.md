---
name: dns
description: DNS and Infrastructure Configuration for RoboSteading
---

# DNS & Infrastructure Configuration

This skill documents the DNS, Cloudflare, and GitHub Pages configuration for `robosteding.com` and the process we took to build it.

## 1. Cloudflare Configuration (DNSControl)

The domain uses **Cloudflare** for DNS management, but we use a **DNS-as-code** approach utilizing `dnscontrol`.

### Setup Steps taken:

1. Created `dnsconfig.js` in the repository root to define the GitHub Pages apex A records, the WWW CNAME, and a special TXT record for GitHub Organization verification.
2. Created a `creds.json` file for `dnscontrol` containing the Cloudflare API token.
3. Added `creds.json` to `.gitignore` to prevent secret leakage.
4. Ran `dnscontrol push` via a Docker container to apply the changes to Cloudflare.

```javascript
// dnsconfig.js
var REG_NONE = NewRegistrar("none");
var CF = NewDnsProvider("cloudflare");

D(
  "robosteding.com",
  REG_NONE,
  DnsProvider(CF),
  A("@", "185.199.108.153"),
  A("@", "185.199.109.153"),
  A("@", "185.199.110.153"),
  A("@", "185.199.111.153"),
  CNAME("www", "closedloop-technologies.github.io."),
  TXT("_gh-closedloop-technologies-o", "95d22fabea"),
);
```

### API Access

The Cloudflare API Token used for DNSControl has the following permissions:

**Permissions**:

- **Account** (Sean@closedloop.tech's Account):
  - Workers R2 Storage:Edit
  - Account Settings:Read
- **Zone** (`robosteading.com`):
  - Zone:Read
  - DNS:Edit
- **All users**:
  - User Details:Read

**Expiry Date**: April 30, 2026

## 2. GitHub Pages Verification

GitHub Pages was enabled for the `robosteading.com` custom domain. We had to provision a special TXT DNS record `_gh-closedloop-technologies-o.robosteading.com` to verify domain ownership to our organization.

### How to Detect Verification and HTTPS Status

To programmatically check if GitHub has verified the domain and successfully provisioned the SSL certificate (Enforced HTTPS), you can check the GitHub API for the pages configuration.

Using the `gh` cli:

```bash
gh api /repos/closedloop-technologies/robosteading/pages
```

Look for the following keys in the JSON response:

- `"status": "built"` (or similar depending on the deployment state)
- `"protected_domain_state": "verified"` (indicates GitHub has successfully verified the TXT record)
- `"https_enforced": true` (indicates the SSL certificate was successfully provisioned and HTTPS is active)
- `"pending_domain_unverified_at": null`

_(Note: If `https_enforced` is false and you want to enforce it via the API once it's available, you can send a PUT request to the same endpoint with `{"https_enforced": true}`)_
