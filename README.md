# Invoice Builder

[![License](https://img.shields.io/github/license/piratuks/invoice-builder)](LICENSE)
[![Downloads](https://img.shields.io/github/downloads/piratuks/invoice-builder/total)](https://github.com/piratuks/invoice-builder/releases)
[![Latest Release](https://img.shields.io/github/v/release/piratuks/invoice-builder)](https://github.com/piratuks/invoice-builder/releases)
![Windows](https://img.shields.io/badge/Windows-10%2B-blue?logo=windows)
![Linux](https://img.shields.io/badge/Linux-DEB-blue?logo=linux)
![macOS](https://img.shields.io/badge/macOS-DMG-lightgrey?logo=apple&logoColor=white)

**Offline invoicing with full data ownership.**

**Invoice Builder** is an **offline-first, open-source invoicing and quoting application** for freelancers and small businesses who want full control over their data.

No accounts. No cloud. No subscriptions.  
Your data stays on your machine in a database file you own.

## 📸 Screenshots

![Invoice Form](tutorial/invoice_form.jpg)
![Invoice PDF Preview](tutorial/invoice_pdf_preview.jpg)
![Quote PDF Preview](tutorial/quote_pdf_preview.jpg)

## ❓ Why Invoice Builder?

Invoice Builder is designed for freelancers, contractors, and small businesses who want:

- **Full ownership of their data** — no cloud lock‑in
- **Offline access** — works anywhere, anytime
- **A predictable, transparent tool** — no subscriptions, no hidden sync
- **Cross-platform support** — macOS, Windows & Linux
- **Import/export freedom** — JSON, XLSX, full database backups
- **Highly customizable PDFs** — branding, layout, colors, typography

If you value **privacy, portability, and control**, this app is built for you.

## ✨ Key Features

### Core

- Create and manage **Invoices** and **Quotes**
- Offline-first: works without internet
- Database-file based (create or open a database anywhere)
- Automatic snapshotting of business, client, item, and currency data per invoice/quote
- Multi-currency support: choose the currency for each invoice/quote individually
- Responsive layout - usable on small and large screens, resizable windows supported
- Invoice/Quote translations – select a language per document, independent of app settings

### Business Data Management

- Businesses, Clients, Items, Categories, Units, Currencies
- Search, sort, filter, archive (non-destructive)
- XLSX import/export for most entities
- Automatic creation of missing units/categories on item import

### Financial Flexibility

- Fixed or percentage discounts
- Shipping fees
- Tax:
  - inclusive or exclusive
  - per-item or on total
  - deducted tax
- Partial payments, balance due tracking
- Invoice states: unpaid, partially paid, paid, closed
- Quote states: open, closed

### PDF Generation & Customization

- Live PDF preview
- A4 / Letter formats
- Layout presets
- Color, font size, logo size customization
- Table header & row styles
- Uppercase label toggle
- Quote & invoice watermarks (including paid watermark)
- Attachments: include images in PDFs

### Reports

- Aggregated data
- Charts and summaries

### Import, Export & Backup

- Full database backup & restore
- Export all data to JSON and import back
- Export to XLSX for most entities
- Invoices and quotes support export (historical documents remain immutable)

### Settings & Customization

- Language selection: currently French, English and Lithuanian
- Number & date formatting (e.g. `1,234.10` vs `1.234,10`)
- Invoice/quote number prefix & suffix
- File name customization for exported PDFs
- Light & dark mode
- Enable/disable reports and quotes
- Check for updates via GitHub releases

## 🖥️ Supported Platforms

- **Windows:** 10 or newer, 64-bit
- **Linux:** any modern distribution (Ubuntu, Debian, Linux Mint, etc.) supporting .deb packages
- **macOS:** 11.0 (Big Sur) or newer, Apple Silicon (M1/M2/M3/M4), 64-bit, .dmg installer available
- **Memory:** 2 GB RAM minimum (1 GB may work for very small datasets)
- **Disk space:** ~100 MB for the installer; ~500mb for the app; additional space needed for database files

## 📦 Installation

Download the latest release from the **GitHub Releases** page:

➡️ [Download Latest Release](https://github.com/piratuks/invoice-builder/releases)

No account required.

> ⚠️ **Browser download warning**
>
> When downloading the app, your browser may show a message like:
>
> - “This file is from an unknown source”
> - “This file is rarely downloaded”
>
> This is normal for newly published apps and does **not** indicate a security issue.  
> Simply choose **Keep anyway / Save anyway** to proceed with the download.

> 🐧 **Linux package warning**
>
> On some Linux distributions (Ubuntu, Linux Mint, etc.), you may see messages such as:
>
> - “This package is provided by a third party”
> - “Installing software from outside the official repositories may be unsafe”
>
> This warning appears because the app is not distributed via the default system repositories.  
> If you downloaded the package directly from the official GitHub Releases page, it is safe to proceed.

> 🍎 **macOS Gatekeeper warning**
>
> Because this app is **unsigned**, macOS may display a message like:
>
> - “App is damaged and can’t be opened. Move to Trash”
> - “App is from an unidentified developer”
>
> This happens because macOS Gatekeeper treats all unsigned apps downloaded from the internet as potentially unsafe.  
> It adds a special **quarantine flag** to the app bundle, which prevents it from launching.
>
> To fix this, after downloading and installing it:
>
> 1. Open **Terminal**.
> 2. Run the following command:
>    ```bash
>     sudo xattr -rd com.apple.quarantine "/Applications/Invoice Builder.app"
>    ```

## 🚀 Quick Start

1. Launch the application
2. Create a new database file or open an existing one
3. Add at least:
   - a Business
   - a Currency
   - a Client
   - an Item
4. Create your first Invoice or Quote
5. Preview and export to PDF

## 📘 Tutorial

Detailed tutorials and usage guides are available [here](TUTORIAL.md)

## 🧠 Data Model & Snapshots

When an invoice or quote is created, snapshots of the following are stored with the document to ensure historical accuracy:

- **Business**
- **Client**
- **Items**
- **Currency**

Changes to these entities do **not** affect existing invoices or quotes.  
Snapshots are updated only when editing an invoice or quote and changing the associated **client, business, item, or currency**.

## 🔄 Backups & Data Portability

You can:

- **Back up and reopen** the full database file
- **Export all data to JSON** and import it back
- **Export entities to XLSX** for manual editing
- **Import entities from XLSX**

> **Note:** Invoices and quotes are export-only to preserve historical data integrity.

## 🛠️ Development & Contributing

### 📦 Running Locally

Clone the repository, install dependencies, and start the development server:

```bash
git clone https://github.com/piratuks/invoice-builder.git
cd invoice-builder
npm install
npm run dev
```

### ⚙️ Environment Variables

- .env.development

```env
VITE_ENABLE_MOCKS={true|false} # Enables or disables mock data
```

- .env.production

```env
# Leave empty
```

- .env.test

```env
# Leave empty
```

### 📁 Project Structure

```
/src
  /main             – Electron main process
    /assets         - Static resources required by the main process
    /enums          - Centralized TypeScript enums used by the main process
    /ipc            - Your inter‑process communication layer
    /migrations     - Folder is used to manage and version database schema changes.
    /types          - TypeScript interfaces and type definitions used exclusively by the main process
    /utils          - Utility functions that support the main process
  /preload          – Electron preload scripts
  /renderer         – UI code
    /__tests__      – UI unit tests
    /app            – Core React application
    /assets         – Fonts, images, and other static assets
    /i18n           – Translation files
    /mocks          – MSW (mock service worker) for testing
    /pages          – React components related to routing
    /state          – Redux-related code
    /shared
      /hooks        – Reusable React hooks
      /components   – Shared UI components
      /enums        – TypeScript enums
      /types        – TypeScript types/interfaces
      /utils        – Utility functions
```

### 🛠️ Core Stack

- **Electron** — cross-platform desktop framework
- **SQLite** — lightweight, reliable embedded database
- **TypeScript** — safer, maintainable code
- **React** — UI framework
- **MUI** — styling and UI components
- **exceljs** — XLSX import/export
- **@react-pdf/renderer** — PDF generation

### 🗂️ Database Schema

![Database Schema](schema.png)

### 🤝 Contributing Guidelines

Contributions of all kinds are welcome — bug reports, feature ideas, documentation improvements, and pull requests.  
Please open an issue before starting major work to ensure alignment.

- Report issues or features [here](https://github.com/piratuks/invoice-builder/issues)
- Feature requests and discussions are welcome
- Please follow [guidelines](CONTRIBUTING.md)

## 📚 Documentation

- [Tutorial](TUTORIAL.md)
- [Privacy Policy](PRIVACY-POLICY.md)
- [Terms of Use](TERMS-OF-USE.md)

## 📌 Supported Versions

| Version | Status                |
| ------- | --------------------- |
| v1.2.2  | ✅ Actively supported |
| v1.2.0  | ✅ Actively supported |
| v1.1.4  | ✅ Actively supported |
| v1.1.3  | ✅ Actively supported |
| v1.1.2  | ✅ Actively supported |
| v1.1.1  | ✅ Actively supported |
| v1.1.0  | ✅ Actively supported |
| v1.0.7  | ✅ Actively supported |
| v1.0.5  | ✅ Actively supported |

Details about supported versions and update policy will be documented here.

## 📄 License

This project is licensed under the **MIT License**.  
See the [LICENSE](LICENSE) file for details.
