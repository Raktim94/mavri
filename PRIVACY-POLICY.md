# Privacy policy

*Last updated: 13 October 2026*

Mavri is software you run yourself. This page explains what that means for your information.

## Who holds your data

You do. Mavri stores everything (your account, invoices, quotes, customers, products, payments, settings and API keys) in a SQLite database in the data folder of the machine or container where you installed it. NodeDR Infotech Private Limited and the Mavri maintainers do not host that data, cannot see it, and cannot recover it for you. Back it up with **Settings → Backup** or by copying the data folder.

## What Mavri sends out

Mavri has no analytics, no advertising and no tracking, and it does not report usage to anyone. The only connections it makes by itself are:

| When | To | What is sent |
| --- | --- | --- |
| You open Settings or the sidebar (cached for 10 minutes) | `raw.githubusercontent.com` and `ghcr.io` | An ordinary web request asking for the latest published version. Your invoices and account details are never included; GitHub sees your server's IP address like any web request. |
| You press **Update now** | The updater container on your own network, which then downloads the image from `ghcr.io` | The version number to install. |
| A store connection you set up sends an order | Nothing leaves your server; the order arrives at Mavri | n/a |

Set `UPDATE_CHECK=off` in the container's environment to stop the version check completely.

## Accounts and sign-in

The first account you create becomes the owner. Passwords are stored only as salted hashes. Sessions use an HTTP-only cookie. API keys are stored as hashes and shown once, when you create them. Store webhook secrets are encrypted with the key kept in your data folder.

## Services you choose to use

If you save a PDF to a cloud drive, email an invoice, expose Mavri through a tunnel or reverse proxy, or connect a shop, those services handle the data under their own policies.

## Your responsibilities

Secure the machine Mavri runs on, use HTTPS when it is reachable from the internet, keep backups, and keep the software up to date. If your invoices contain personal data about other people, you are the one who decides how it is used and for how long it is kept.

## Changes

If this policy changes, the new version is published in the repository with a new date. Questions: open an issue or write to the address in [MAINTAINERS.md](MAINTAINERS.md).
