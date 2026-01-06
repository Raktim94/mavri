# Invoice Builder

## 2026-01-06, version 1.1.0

New features & improvements

- Added French language support (translations provided by the community)
- Quantity now supports decimal values (up to 3 decimal places)
- macOS support
- Partial payment status fix - invoices and quotes no longer remain marked as “partial” after all payments are removed.

## 2026-01-02, version 1.0.7

PDF Preview Bug Fixes & Improvements

- Fixed an issue where the Payment Information label did not respond correctly to the upper/lower case toggle
- Added missing translations for the Lithuanian (LTU) language
- Improved the look and feel of layout options for a more consistent user experience
- Watermark, Paid Watermark, Attachments, and Business Logo are now correctly included in the generated PDF files. (Previously, these elements were visible only in the live preview)

## 2025-12-30, version 1.0.5

Initial release with the following functionality

- Create and manage Invoices and Quotes
- Full offline-first operation with local SQLite database
- Business, Client, Item, Category, Unit, and Currency management
- Multi-currency support per invoice/quote
- Discounts (fixed & percentage), shipping fees, and flexible tax options
- Partial payments and balance tracking
- PDF generation with live preview and customization (layout, colors, fonts, logo size)
- Attachments support in PDFs
- XLSX import/export for most entities
- Full database backup & restore
- Export all data to JSON
- Reports with aggregated data and charts
- Light & dark mode
- Language support: English & Lithuanian
- Customizable numbering, formatting, and file naming
- Windows & Linux builds
- Invoice/Quote state tracking (unpaid, partially paid, paid, closed; quote open/closed)
- Automatic snapshotting of business, client, item, and currency data for historical accuracy
