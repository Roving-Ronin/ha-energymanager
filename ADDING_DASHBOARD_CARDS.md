# Contributing Cards to the Energy Manager Dashboard

Energy Manager welcomes proposals for new dashboard cards. If you've made a card that could benefit other users, you can submit it through a GitHub pull request for review.

**Submitting a card does not guarantee it will be included.** The Energy Manager maintainer will review each proposal for usefulness, compatibility, reliability, clarity, and impact on the existing dashboard.

This guide applies to the **Overview view** in [`config/dashboards/energy_manager_pv.yaml`](config/dashboards/energy_manager_pv.yaml), which uses the `custom:energy-manager-layout` layout manager.

## Before you start

- Check the existing dashboard first to avoid duplicating an existing card.
- Prefer cards that use entities already provided by Energy Manager or standard Home Assistant integrations.
- Make the card useful for more than just your particular system. If it requires optional hardware, an electricity provider, or a particular integration, document that requirement and use an appropriate conditional card where possible.
- Avoid new third-party custom-card dependencies unless they are genuinely needed. Explain any additional dependencies in the pull request; do not assume they will be accepted.
- Do not introduce new helpers, services, entities, scripts, automations, or backend changes just to support a dashboard card without explaining and separately proposing those requirements.
- Keep your change limited to the proposed card and any directly necessary documentation. Do not reformat or rearrange unrelated YAML.

## 1. Find the correct location

Open [`config/dashboards/energy_manager_pv.yaml`](config/dashboards/energy_manager_pv.yaml).

At the beginning of the file, the Overview view is structured like this:

```yaml
views:
  - type: custom:energy-manager-layout
    icon: mdi:home-lightning-bolt
    path: em-overview
    title: Overview
    layout_columns: 3
    cards:
      # Existing Overview cards are here.
```

**Add your proposed card under this view's `cards:` list.** Do not create another top-level `views:` entry for an ordinary Overview card. Follow the indentation of the existing cards, and put `view_layout:` on the same level as that card's `type:`.

The file also contains other dashboard views. Make sure you're editing the Overview view, not one of the later views.

## 2. Add the required layout information

Every proposed Overview card should have a `view_layout` section so Energy Manager can identify and arrange it.

```yaml
view_layout:
  em_id: example-solar-summary
  em_name: Solar Summary
  em_column: 1
  em_order: 99
  em_width: 12
  em_hidden: true
```

| Setting | Purpose |
| --- | --- |
| `em_id` | **Required.** A stable, unique identifier for the card, such as `example-solar-summary`. Never reuse an existing card ID. |
| `em_name` | **Required for contributions.** Readable name shown in the dashboard's customisation and visibility controls. |
| `em_column` | Default main column: `0` = left, `1` = centre, `2` = right. |
| `em_order` | Default order within that column. Use an appropriate number; the maintainer may adjust it during review. |
| `em_width` | Default width from `1` to `12`, measured **within its main column**. `12` fills the column; `6` takes half. |
| `em_hidden` | Use `true` to make a new optional card hidden by default, so existing users can opt in. |

**Use `em_hidden: true` for community-submitted cards unless there is a compelling reason for them to be visible by default.** This keeps updates from cluttering existing users' dashboards.

The layout manager lets users move, resize, and show or hide optional cards after installation. The shipped values are defaults, not permanent positions.

Do **not** set `em_required: true` or `em_fixed: true` on community cards. These are reserved for essential Energy Manager controls and system notifications, and require explicit maintainer approval.

Avoid `em_locked: true` as a default. Users should decide which optional cards to lock.

## 3. Example: a simple Markdown card

This example uses a standard Energy Manager sensor and requires no additional custom card component:

```yaml
    - type: markdown
      content: |
        ## Grid Buy Price
        Current import price: **{{ states('sensor.grid_buy_price') }} $/kWh**
      view_layout:
        em_id: community-grid-buy-price
        em_name: Grid Buy Price Summary
        em_column: 2
        em_order: 99
        em_width: 12
        em_hidden: true
```

This example uses `sensor.grid_buy_price`, which is already referenced by the current dashboard. Your contribution should similarly use supported entities and handle `unknown` or `unavailable` values sensibly. Avoid embedding a personal entity ID that only exists in your installation.

## 4. Example: show a card only when it applies

Some cards are relevant only to a particular electricity provider, device, or feature. Follow the existing `conditional` card patterns in `energy_manager_pv.yaml`.

```yaml
    - type: conditional
      conditions:
        - entity: input_boolean.example_feature_enabled
          state: "on"
      card:
        type: markdown
        content: |
          ## Example Feature
          Feature-specific information appears here.
      view_layout:
        em_id: community-example-feature
        em_name: Example Feature
        em_column: 2
        em_order: 99
        em_width: 12
        em_hidden: true
```

The entity in this example is a **placeholder, not an Energy Manager entity**. Substitute a real, supported entity and condition. Do not add a fake helper simply to make the example work.

Keep `view_layout:` on the **outer conditional card**, not inside its nested `card:` block.

## 5. Card identifiers and future updates

Energy Manager stores layouts in named profiles, including card order, width, visibility by device, and locking preferences. Those saved settings are associated with `em_id`.

Therefore:

- Choose a descriptive ID and keep it stable across releases.
- Check that the ID is not already used in the Overview view.
- Do not rename an existing card as part of an unrelated contribution.
- If a future change genuinely needs to rename an ID, declare the old ID so the layout manager can migrate saved preferences:

```yaml
view_layout:
  em_id: community-new-card-id
  em_previous_ids:
    - community-old-card-id
  em_name: Updated Card Name
  em_column: 2
  em_order: 99
  em_width: 12
  em_hidden: true
```

New cards can be incorporated into existing saved profiles. Users' existing layout preferences should not be reset just because another card has been added.

## 6. Test your contribution

Before opening a pull request, check as many of the following as practical:

- [ ] The YAML parses and Home Assistant accepts the dashboard configuration.
- [ ] The card renders correctly using supported Energy Manager entities.
- [ ] The card displays sensible information when entities are `unknown` or `unavailable`.
- [ ] The card looks reasonable in both light and dark themes.
- [ ] The card remains usable in desktop, tablet, and mobile layouts.
- [ ] The card can be shown, hidden, moved, and resized through Energy Manager's customisation controls.
- [ ] Its `em_id` is unique and its `view_layout` configuration is present.
- [ ] Any provider-, device-, or feature-specific condition behaves correctly.
- [ ] No existing controls, cards, or dashboard views have been unintentionally changed.

If you cannot test something, state that in your pull request. Do not claim a card is compatible with devices, integrations, or providers you haven't tested.

## 7. Submit a pull request

1. Fork the [Energy Manager repository](https://github.com/ha-energymanager/ha-energymanager).
2. Create a branch based on the latest **`development`** branch.
3. Add your proposed card to `config/dashboards/energy_manager_pv.yaml`.
4. Commit the change and open a pull request targeting **`development`**, not `test`, `early`, or `main`.
5. Include the information below in your pull request description.

### Suggested pull request description

```markdown
## Proposed dashboard card
**Card name:**
**Card ID (`em_id`):**

## What does it do?
Describe the information or controls the card provides.

## Why should it be included?
Explain how it benefits Energy Manager users and why an existing card doesn't already cover the need.

## Requirements
List any required entities, integrations, devices, electricity providers, or third-party cards. State "None" if there are no additional requirements.

## Default placement
Column, width, and whether the card is hidden by default.

## Testing
Explain what you tested and on which Home Assistant setup. Mention any untested scenarios.

## Screenshots
Provide a screenshot showing the card in use, preferably in both light and dark themes if applicable.

## Other changes required
State whether any new helpers, integrations, backend behaviour, or installer/manifest changes would be necessary.
```

Remove or obscure personal information, API keys, tokens, addresses, account identifiers, and other secrets from screenshots or examples.

## Review process

The maintainer will review each submission and decide whether it provides sufficient benefit to Energy Manager users. A contribution may be accepted, revised, deferred, or declined. Factors include usefulness, clarity, compatibility, performance, maintenance burden, safety, and additional dependencies.

Please **do not modify the installer or deployment manifest just to register an ordinary new card**. Cards already included in `energy_manager_pv.yaml` are shipped as part of that dashboard file. If your proposal requires a new custom component or another separate asset, call it out in the pull request so its installation can be reviewed explicitly.

For broader contribution rules, see [`CONTRIBUTING.md`](CONTRIBUTING.md).
