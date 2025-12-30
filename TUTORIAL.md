# Invoice Builder Tutorial

> 💡 **Note:** The interface is fully responsive and works well on resizable windows, making it suitable for users on Linux tiling window managers, small screens, or any desktop setup.

## Database creation screen

The first screen of the application allows you to **create a new database** at a chosen location or **open an existing one**.

Recently opened databases are displayed in a **quick access list** for faster reopening.

![First screen](tutorial/initial_screen.jpg)

## Settings screen

The **Settings** screen allows you to configure application behavior, manage data, and customize document output.

### General & Data Management

From this screen you can:

- Enable or disable optional layouts (**Quotes** and **Reports**)
- Export all application data to **JSON**
- Import previously exported data
- Access project resources:
  - GitHub repository
  - Issue tracker
  - Tutorial
  - Project homepage
  - Privacy Policy
  - Terms of Use
- Check for application updates via GitHub Releases

![Look and feel](tutorial/settings_page_3.jpg)

### Localization & Formatting

You can customize:

- Application language
- Number (amount) formatting
- Date formatting

![Language and format](tutorial/settings_page_1.jpg)

### Invoice & File Naming

The following options are available:

- Customize invoice and quote numbers using:
  - Prefix
  - Suffix
- Customize exported PDF file names

By default, files are named: "{Invoice|Quote}\_{InvoiceNumber}.pdf"

You can optionally include:

- Year
- Month
- Business name

![Customize invoice](tutorial/settings_page_2.jpg)

## Businesses screen

The **Businesses** screen allows you to **create, read, update, and delete (CRUD)** business data. You can also **filter**, **import**, and **export** businesses via XLSX.

### Adding a Business

Click the **Add** button at the bottom to open a modal where you can:

- Enter business information
- Upload a logo (crop and adjust as needed)

![Businesses creation](tutorial/businesses_page_1.jpg)

### Editing/Deleting a Business

Once businesses are added, select one from the list to edit it on the right side. Each business item also shows:

- Number of invoices created
- Number of quotes created (hidden if the layout is disabled in settings)

You can also:

- **Search businesses by name**
- **Delete a business** by clicking the red trash icon

![Businesses list](tutorial/businesses_page_2.jpg)

### Filters

Businesses have filters to control what is displayed. By default:

- **Active**: shows all businesses except archived

The **archived flag** can be toggled during creation or editing. This flag only affects filtering and does not delete the business.

![Businesses filters](tutorial/businesses_page_3.jpg)

### Sorting

Businesses can be sorted by:

- Name
- Last updated date

![Businesses sort](tutorial/businesses_page_4.jpg)

### Import & Export

You can:

- Export businesses to XLSX
- Import businesses from XLSX
- Download a XLSX template for business import

![Businesses import/export](tutorial/businesses_page_5.jpg)

## Clients screen

The **Clients** screen allows you to **create, read, update, and delete (CRUD)** client data. You can also **filter**, **import**, and **export** clients via XLSX.

### Adding a Client

Click the **Add** button at the bottom to open a modal where you can:

- Enter client information

![Clients creation](tutorial/clients_page_1.jpg)

### Editing/Deleting a Client

Once clients are added, select one from the list to edit it on the right side. Each client item also shows:

- Number of invoices created
- Number of quotes created (hidden if the layout is disabled in settings)

You can also:

- **Search clients by name**
- **Delete a client** by clicking the red trash icon

![Clients list](tutorial/clients_page_2.jpg)

### Filters

Clients have filters to control what is displayed. By default:

- **Active**: shows all clients except archived

The **archived flag** can be toggled during creation or editing. This flag only affects filtering and does not delete the client.

![Clients filters](tutorial/clients_page_3.jpg)

### Sorting

Clients can be sorted by:

- Name
- Last updated date

![Clients sort](tutorial/clients_page_4.jpg)

### Import & Export

You can:

- Export clients to XLSX
- Import clients from XLSX
- Download a XLSX template for client import

![Clients import/export](tutorial/clients_page_5.jpg)

## Categories screen

The **Categories** screen allows you to **create, read, update, and delete (CRUD)** category data. You can also **filter**, **import**, and **export** categories via XLSX.

### Adding a Category

Click the **Add** button at the bottom to open a modal where you can:

- Enter category information
  > 💡 **Note:** Category names must be unique. You cannot create two categories with the same name.

![Categories creation](tutorial/categories_page_1.jpg)

### Editing/Deleting a Category

Once categories are added, select one from the list to edit it on the right side. Each category item also shows:

- Number of invoices created
- Number of quotes created (hidden if the layout is disabled in settings)

You can also:

- **Search categories by name**
- **Delete a category** by clicking the red trash icon

![Categories list](tutorial/categories_page_2.jpg)

### Filters

Categories have filters to control what is displayed. By default:

- **Active**: shows all categories except archived

The **archived flag** can be toggled during creation or editing. This flag only affects filtering and does not delete the category.

![Categories filters](tutorial/categories_page_3.jpg)

### Sorting

Categories can be sorted by:

- Name
- Last updated date

![Categories sort](tutorial/categories_page_4.jpg)

### Import & Export

You can:

- Export categories to XLSX
- Import categories from XLSX
- Download a XLSX template for category import

![Categories import/export](tutorial/categories_page_5.jpg)

## Units screen

The **Units** screen allows you to **create, read, update, and delete (CRUD)** unit data. You can also **filter**, **import**, and **export** units via XLSX.

### Adding a Unit

Click the **Add** button at the bottom to open a modal where you can:

- Enter unit information
  > 💡 **Note:** Unit names must be unique. You cannot create two units with the same name.

![Units creation](tutorial/units_page_1.jpg)

### Editing/Deleting a Unit

Once units are added, select one from the list to edit it on the right side. Each unit item also shows:

- Number of invoices created
- Number of quotes created (hidden if the layout is disabled in settings)

You can also:

- **Search units by name**
- **Delete a unit** by clicking the red trash icon

![Units list](tutorial/units_page_2.jpg)

### Filters

Units have filters to control what is displayed. By default:

- **Active**: shows all units except archived

The **archived flag** can be toggled during creation or editing. This flag only affects filtering and does not delete the unit.

![Units filters](tutorial/units_page_3.jpg)

### Sorting

Units can be sorted by:

- Name
- Last updated date

![Units sort](tutorial/units_page_4.jpg)

### Import & Export

You can:

- Export units to XLSX
- Import units from XLSX
- Download a XLSX template for unit import

![Units import/export](tutorial/units_page_5.jpg)

## Currencies screen

The **Currencies** screen allows you to **create, read, update, and delete (CRUD)** currency data. You can also **filter**, **import**, and **export** currencies via XLSX.

### Adding a Currency

Click the **Add** button at the bottom to open a modal where you can:

- Enter currency information
  > 💡 **Note:** Currency symbols must be unique. You cannot create two currencies with the same symbol.  
  > 💡 **Subunit:** Defines how many subunits make up one unit of the currency.  
  > For example:
  >
  > - USD and EUR: 100 subunits = 1 USD/EUR
  > - Japanese Yen (JPY): 1 subunit = 1 JPY

![Currencies creation](tutorial/currencies_page_1.jpg)

### Editing/Deleting a Currency

Once currencies are added, select one from the list to edit it on the right side. Each currency item also shows:

- Number of invoices created
- Number of quotes created (hidden if the layout is disabled in settings)

You can also:

- **Search currencies by text**
- **Delete a currency** by clicking the red trash icon

![Currencies list](tutorial/currencies_page_3.jpg)

### Filters

Currencies have filters to control what is displayed. By default:

- **Active**: shows all currencies except archived

The **archived flag** can be toggled during creation or editing. This flag only affects filtering and does not delete the currency.

![Currencies filters](tutorial/currencies_page_2.jpg)

### Sorting

Currencies can be sorted by:

- Text
- Last updated date

![Currencies sort](tutorial/currencies_page_4.jpg)

### Import & Export

You can:

- Export currencies to XLSX
- Import currencies from XLSX
- Download a XLSX template for currency import

![Currencies import/export](tutorial/currencies_page_5.jpg)

## Items screen

The **Items** screen allows you to **create, read, update, and delete (CRUD)** item data. You can also **filter**, **import**, and **export** items via XLSX.

### Adding a Item

Click the **Add** button at the bottom to open a modal where you can:

- Enter item information

![Items creation](tutorial/items_page_1.jpg)

### Editing/Deleting a Item

Once items are added, select one from the list to edit it on the right side. Each item also shows:

- Number of invoices created
- Number of quotes created (hidden if the layout is disabled in settings)

You can also:

- **Search items by name**
- **Delete a item** by clicking the red trash icon

![Items list](tutorial/items_page_2.jpg)

### Filters

Items have filters to control what is displayed. By default:

- **Active**: shows all items except archived

The **archived flag** can be toggled during creation or editing. This flag only affects filtering and does not delete the item.

![Items filters](tutorial/items_page_3.jpg)

### Sorting

Items can be sorted by:

- Name
- Last updated date

![Items sort](tutorial/items_page_4.jpg)

### Import & Export

You can:

- Export items to XLSX
- Import items from XLSX
- Download a XLSX template for item import

> 💡 **Note:** When importing items from XLSX, if a unit or category name is provided and does not already exist in the system, it will be automatically created.

![Items import/export](tutorial/items_page_5.jpg)
