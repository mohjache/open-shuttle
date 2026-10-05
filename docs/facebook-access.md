# Facebook access for Open Shuttle

The collector reads Page-authored posts and attachments to find Tournamentsoftware links. It does not need permission to publish posts, manage comments, or read private messages.

The dedicated Meta Business app is **Open Shuttle**, app ID `28526695593623461`, with `anaruherbert@gmail.com` as its contact. A Page Public Content Access request has been added to App Review but has not been submitted or approved. Meta's submission screen requires a **verified business portfolio**. The account currently offers AG Badminton and Anaru Herbert portfolios, all marked **Unverified**. The review also asks for app settings (including icon, category, and policy URLs), allowed-usage certification, data-handling details, and reviewer instructions. A token minted now does not grant access to unrelated public Pages.

## If you manage a source Page

1. Sign in at [Meta for Developers](https://developers.facebook.com/apps/) and create an app for this project, or select an existing app you control.
2. In [Graph API Explorer](https://developers.facebook.com/tools/explorer/), select that app and generate a User access token with `pages_show_list` and `pages_read_engagement`. Approve access to the Page you manage.
3. Query `GET /me/accounts?fields=id,name,access_token,tasks`. Meta returns Page IDs and Page access tokens for Pages that user can manage. Confirm the desired Page appears before copying its token. [Meta's Postman example](https://www.postman.com/meta/facebook/request/bqfxwbp/get-access-tokens-of-pages-you-manage) shows the same request.
4. Test `GET /{page-id}/posts?fields=id,message,permalink_url,created_time,attachments&limit=1` in Graph API Explorer using that Page token. A successful response is the useful check; a token's presence alone does not prove access.
5. Store the token only in the server-side `FACEBOOK_PAGE_ACCESS_TOKEN` environment variable, and set the source's numeric `pageId` if its handle fails. Do not commit the token or paste it into an issue or chat.

The current adapter has one token setting for all sources. A token for a Page you manage should only be relied on for that Page. Disable other sources through the admin API until they have a supported access path. For a long-running job, arrange a long-lived or system-user credential through Meta's supported flow and check its actual expiry and permissions in Meta's Access Token Debugger; a short-lived Explorer User token is only a test credential.

## If you do not manage the source Pages

Ask the Page owners to grant Page access to your Meta business/app, or request **Page Public Content Access** for your app through Meta App Review. The latter is the relevant path for collecting public posts from unrelated Pages. Verify a business portfolio, complete the app's review checklist, and submit the draft request. Until approval, obtaining a User or Page token alone will not unlock the three public feeds. See [Meta's Page API requirements](https://developers.facebook.com/docs/graph-api/reference/page/) and [Page Public Content Access](https://developers.facebook.com/docs/features-reference/page-public-content-access/).

You can still import a Tournamentsoftware tournament URL directly through `POST /api/admin/import` without Facebook access.
