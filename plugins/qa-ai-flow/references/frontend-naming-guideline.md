**Scope:** Web & Mobile Frontend

**Participants:** Designer, Frontend Developer, QA

---

## 1. Purpose & Core Principle

The goal is to enable **QA automation development in parallel with frontend development**, rather than waiting until development is finished.

All parties share one principle:

> **UI elements that need to be tested must have a stable, meaningful automation identifier.**
> 

The identifier should describe the **functional purpose** of the element, not its appearance, position, displayed text, or technical implementation.

The guideline applies to both Web and Mobile projects.

---

## 2. Roles & Workflow

### Responsibility

| Role | Responsibility |
| --- | --- |
| **Designer** | Clearly identify interactive/testable components, their purpose, and important states. No need to create technical automation IDs. |
| **Developer** | Apply the naming convention and implement the automation identifiers. |
| **QA** | Use the identifiers for automation and validate that required elements are accessible and stable. |

### Workflow

```
Requirement
     ↓
Design
     ↓
Identify testable UI
     ↓
Development
     ↓
Apply automation ID convention
     ↓
QA prepares automation in parallel
     ↓
Developer + QA verification
     ↓
Automation execution
     ↓
Release
```

The important change is that **QA automation preparation starts during development**, not after development is completed.

---

## 3. When an Automation ID Is Required

An automation ID should be added when QA needs to **interact with, validate, or uniquely identify** an element.

### Common examples

**Interactive**

- Button
- Input
- Search
- Checkbox
- Radio
- Switch
- Dropdown
- Tab
- Navigation
- Menu
- Card / List Item

**Validation**

- Error message
- Success message
- Loading state
- Empty state
- Status
- Badge
- Important business information

**Business entities**

- Product
- Order
- Transaction
- User
- Payment

Decorative UI elements generally do not require automation IDs.

---

## 4. Naming Convention

### Standard format

```
<page>_<element>_<component>
```

Use:

- Lowercase
- `snake_case`
- Functional names
- Page name
- Standard component suffix

### Examples

```
login_page_email_input
login_page_password_input
login_page_login_button

product_list_page_search_input
product_list_page_product_card

product_detail_page_add_to_cart_button
checkout_page_place_order_button
```

### Why include the page?

A module can contain multiple pages with similar components.

Instead of:

```
email_input
email_input
email_input
```

Use:

```
login_page_email_input
forgot_password_page_email_input
reset_password_page_email_input
```

This makes identifiers easier to understand and reduces ambiguity.

### Do not use page numbers

Avoid:

```
page_1_button
login_page_2_button
```

Use the functional page name instead.

---

## 5. Standard Component Vocabulary

Use a consistent vocabulary across projects.

| Component | Suffix | Example |
| --- | --- | --- |
| Text Input | `_input` | `email_input` |
| Search | `_search_input` | `product_search_input` |
| Button | `_button` | `login_button` |
| Checkbox | `_checkbox` | `remember_me_checkbox` |
| Radio | `_radio` | `payment_method_radio` |
| Switch | `_switch` | `notification_switch` |
| Dropdown | `_dropdown` | `country_dropdown` |
| Tab | `_tab` | `history_tab` |
| Navigation | `_nav` | `profile_nav` |
| Card | `_card` | `product_card` |
| List Item | `_item` | `order_item` |
| Image | `_image` | `product_image` |
| Label | `_label` | `status_label` |
| Badge | `_badge` | `cart_badge` |
| Modal | `_modal` | `delete_account_modal` |
| Dialog | `_dialog` | `confirmation_dialog` |
| Bottom Sheet | `_bottom_sheet` | `filter_bottom_sheet` |
| Error | `_error` | `login_error` |
| Loading | `_loading` | `product_loading` |

If a new component type is needed, add it to the shared standard instead of creating an inconsistent project-specific convention.

---

## 6. Naming Rules & Dynamic Components

### 6.1 Name by function

✅

```
login_page_login_button
```

❌

```
login_page_blue_button
login_page_bottom_button
login_page_button_1
```

### 6.2 Don't use displayed text

✅

```
product_detail_page_add_to_cart_button
```

❌

```
"Add to Cart"
```

This prevents automation from breaking because of copywriting or localization changes.

### 6.3 Don't use position

Avoid:

```
first_product
second_product
top_button
bottom_button
```

### 6.4 Don't use implementation details

Avoid:

```
flutter_button
custom_widget
div_button
container_1
widget_123
```

The naming should remain valid even if the underlying technology changes.

### 6.5 Dynamic components

For repeated elements, use a stable business identifier.

Format:

```
<page>_<element>_<component>_<identifier>
```

Example:

```
product_list_page_product_card_12345
product_list_page_add_to_cart_button_12345
order_list_page_order_item_ORD001
```

Use stable identifiers such as:

- Product ID
- Order ID
- User ID
- Transaction ID

Avoid list indexes:

```
product_card_1
product_card_2
product_card_3
```

because ordering can change.

### 6.6 Component state

The identifier should normally **remain the same across states**.

For example:

```
product_detail_page_favorite_button
```

can represent:

- Selected
- Not selected
- Disabled
- Loading

State should be validated separately through the automation/accessibility mechanism.

---

## 7. Developer & QA Rules

### Developer

Developer must:

- Apply the standard naming convention.
- Include the page name.
- Use the standard component vocabulary.
- Add IDs to required testable elements.
- Use stable identifiers for dynamic components.
- Keep existing IDs stable.
- Ensure IDs are accessible to the automation framework.
- Inform QA before changing an existing ID.

### QA

QA should:

- Use automation IDs as the primary selector.
- Avoid position-based selectors.
- Avoid styling-based selectors.
- Avoid fragile XPath/CSS hierarchy where possible.
- Avoid using displayed text when a stable ID exists.
- Report missing or incorrect IDs during development.
- Validate that IDs are unique and usable.

### Recommended selector priority

```
Automation ID
      ↓
Accessibility ID
      ↓
Stable semantic attribute
      ↓
Text
      ↓
UI hierarchy / XPath
```

The exact implementation may vary depending on the automation framework.

---

## 8. Change Management, DoD & Quick Reference

### Changing an existing ID

An automation ID should be treated as part of the **testing contract**.

Changing:

```
login_page_login_button
```

to:

```
login_page_submit_button
```

may break existing automation.

Therefore:

> **Do not change an existing automation ID without a valid reason and communication with QA.**
> 

When a change is necessary:

1. Developer informs QA.
2. QA identifies affected tests.
3. Developer implements the change.
4. QA updates the automation.
5. Both teams verify the affected tests.

---

### Automation Readiness — Definition of Done

A feature is automation-ready when:

- [ ]  Required testable elements have automation IDs.
- [ ]  Naming follows the standard.
- [ ]  Page name is included.
- [ ]  Standard component vocabulary is used.
- [ ]  Dynamic components use stable identifiers.
- [ ]  IDs are accessible to QA automation.
- [ ]  QA can successfully locate required elements.
- [ ]  Existing IDs have not been unintentionally changed.

---

### Quick Reference

**Format**

```
<page>_<element>_<component>
```

**Dynamic**

```
<page>_<element>_<component>_<identifier>
```

**Always**

- Lowercase
- `snake_case`
- Include page name
- Name by function
- Use standard component suffixes
- Use stable business IDs for dynamic components
- Keep existing IDs stable

**Never**

- Use page numbers
- Use UI position
- Use colors/appearance
- Use displayed text as the primary ID
- Use temporary names
- Use random/generated IDs
- Use framework-specific names
- Use list indexes

---

## Final Principle

> **Designer defines what the UI does.
The organization defines how it is named.
Developer implements the identifier.
QA automates against the identifier.
Everyone protects its stability.**
>