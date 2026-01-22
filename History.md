# Invoice Builder

## 2026-01-22, version 1.3.0

New features & improvements

- Added German language support
- Improved Reporting UI (currency selection dropdown instead of listing all currencies)
- Added the ability to apply a handwritten signature to PDF invoices

Bug Fixes

- Fixed an issue with Invoice Excel export

## 2026-01-12, version 1.2.1

Bug Fixes

- Fixed macOS build.

## 2026-01-08, version 1.2.0

Bug Fixes

- Fixed incorrect translations under the Invoice Status filter.
- Fixed Quantity field error not showing the correct value.
- Fixed Shipping Fees field error not showing the correct value.
- Fixed Closed state incorrectly showing overdue status.
- Fixed Normal watermark not appearing on attachments.
- Fixed Legend in reporting: vertical layout now fits when there are many items.
- Fixed Attachments layout to wrap correctly.
- Fixed Date fields: allow removing value if not required; delete keyboard button no longer triggers errors.
- Fixed Import/Export JSON functionality.
- Fixed Report aggregation to respect date filter.
- Fixed layout issue for invoices on smaller screens.

UX / Interaction Improvements

- Delete now deselects the previous item and shows the correct selection.
- Add New immediately selects the new item after saving.
- Duplicate invoices/quotes now select the newly created item automatically.
- Reports: custom dates are now required.
- Add new items appear at the top instead of the bottom of the list.
- Delete shows a confirmation prompt.
- First screen scroll style is now consistent across all pages.
- Date fields now allow selecting month, similar to year selection.

Functional Updates

- Invoice uniqueness now enforced on: (business ID, and invoice number combined with suffix and prefix).
- Renamed Invoice Number Suffix and Prefix Snapshot columns to clarify they are not snapshots.
- Ghost data cleanup.
- Invoice/Quote translations now allow selecting a language, instead of always using settings language.

Performance / Reporting

- Reports performance improved.

## 2026-01-07, version 1.1.4

Bug Fixes

- Fixed the More Actions dropdown so it hides after an action is selected
- Fixed the Delete action to deselect the previously selected (deleted) item

## 2026-01-07, version 1.1.3

Bug Fixes

- Fixed attachment URL issue.
- Fixed image remove icon visibility over the crop modal (z-index issue).
- Fixed crop modal to allow changing the aspect ratio.
- Stabilized pdf preview to ensure consistent attachment display in PDFs.

## 2026-01-07, version 1.1.2

Bug Fixes

- Export pdf which is empty contained undefined parts in the file name
- Overdue showed always even on paid
- Duplicating was setting issuedAt as current date instead of copying it
- Corrected reporting calculations to properly respect selected date range filters

## 2026-01-06, version 1.1.1

PDF Preview Bug Fixes

- Fixed a UI issue that caused a break when adding a new invoice in preview mode with a logo present.

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
