## Key Design Decisions

| Feature                     | Purpose                                                                                                  |
| --------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Flexible Attributes**     | `ProductAttribute[]` handles any product type without schema changes                                     |
| **Variants System**         | Supports size/color/options while keeping inventory per-variant                                          |
| **Optional Fields**         | Many fields are optional (`?`) so you can skip irrelevant data (e.g., `dimensions` for digital products) |
| **Generic Metadata**        | `customFields` allows any additional data without modifying the interface                                |
| **Status/Visibility Enums** | Controls lifecycle and discoverability separately                                                        |

This interface works for

- physical goods
- digital products
- services
- subscriptions

while maintaining type safety. You can extend it with category-specific interfaces when needed.
