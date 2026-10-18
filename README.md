# fb-marketplace-mcp

MCP server. Lets Claude search Facebook Marketplace, vet sellers, flag scams, check prices, and prep listings.

**Status: work in progress.** Only a `ping` tool works today. Do not install expecting features yet.

## Read this first

Facebook has no public API for Marketplace search or personal listings. This server talks to Facebook the way a browser does. Automated access is against Meta's Terms of Service. Use it at your own risk.

- Search runs logged out. No account involved.
- Seller detail and listing prefill use your own logged-in browser. That can trigger checkpoints or restrictions on your account.
- The server never clicks Publish. You do.
- The server never sees or stores your password. You log in yourself in a real browser window.
- Facebook changes its internals often. Expect breakage.

## Planned tools

| Tool | Does | Needs login |
|---|---|---|
| `search_listings` | Multi-phrasing search, strict filters, risk score per result | no |
| `get_listing` | Full listing detail plus risk flags with reasons | no |
| `get_seller` | Seller profile, trust summary, other listings | maybe |
| `check_price` | Comparable listings: median, range, confidence | no |
| `validate_listing_draft` | Check draft against Marketplace commerce policies | no |
| `prefill_listing` | Fill the Create Listing form, stop before Publish | yes |
| `login` | Open a browser window for manual login | n/a |

## Design

- Local only. Runs over stdio on your machine. Cookies never leave it.
- Fixed rate limit, about 1 request per 2-3 s. Not configurable on purpose.
- Listing text from sellers is untrusted. Returned as labeled data, never as instructions.
- Diagrams: open `docs/diagrams.html` in a browser.

## Develop

Needs Node 22.12+.

```sh
npm install
npm test          # unit + contract tests, never hits Facebook
npm run lint
npm run inspect   # build, then open MCP Inspector
```

Add to Claude Code:

```sh
npm run build
claude mcp add fbm -- node "$PWD/dist/index.js"
```

## Credit

Facebook endpoint research draws on [secondhand-mcp](https://github.com/jlsookiki/secondhand-mcp) (MIT).

## License

MIT
