/**
 * Generic Product Item Interface
 * Designed to work across multiple product categories and types
 */

// Core product interface with essential fields
export interface ProductItem {
  // Unique identifiers
  id: string
  sku: string // Stock Keeping Unit

  // Basic product info
  name: string
  description: string
  shortDescription?: string

  // Categorization
  category: ProductCategory
  subcategory?: string
  tags: string[]

  // Pricing
  price: ProductPrice

  // Inventory
  inventory: InventoryInfo

  // Media
  media: ProductMedia[]

  // Attributes (flexible for any product type)
  attributes: ProductAttribute[]

  // Variants (size, color, etc.)
  variants?: ProductVariant[]

  // Shipping & dimensions
  dimensions?: ProductDimensions
  weight?: ProductWeight

  // Status & visibility
  status: ProductStatus
  visibility: ProductVisibility

  // Metadata
  metadata: ProductMetadata

  // Timestamps
  createdAt: Date
  updatedAt: Date
}

// Supporting type definitions

export interface ProductCategory {
  id: string
  name: string
  slug: string
  parentId?: string
  breadcrumbs: string[] // Path like ["Electronics", "Phones", "Smartphones"]
}

export interface ProductPrice {
  basePrice: number // Original price
  salePrice?: number // Discounted price
  currency: string // ISO 4217 (USD, EUR, PHP, etc.)
  taxRate?: number // Percentage
  isTaxInclusive: boolean
}

export interface InventoryInfo {
  quantity: number
  reservedQuantity: number // Items in carts/orders
  availableQuantity: number // quantity - reserved
  lowStockThreshold: number
  trackInventory: boolean
  allowBackorders: boolean
  skuLocation?: string // Warehouse/bin location
}

export interface ProductMedia {
  id: string
  type: 'image' | 'video' | 'document' | '3d-model'
  url: string
  altText?: string
  title?: string
  sortOrder: number
  isPrimary: boolean
  metadata?: Record<string, unknown> // dimensions, duration, etc.
}

// Flexible attribute system for any product type
export interface ProductAttribute {
  id: string
  name: string // e.g., "Color", "Screen Size", "Material"
  value: string | number | boolean | string[]
  unit?: string // e.g., "inches", "GB", "kg"
  displayType: 'text' | 'number' | 'boolean' | 'select' | 'multiselect' | 'color'
  isFilterable: boolean // Can be used in search filters
  isVisible: boolean // Show to customers
  group?: string // Group attributes (e.g., "Technical Specs")
}

// Product variants (e.g., different sizes/colors)
export interface ProductVariant {
  id: string
  sku: string
  name: string // e.g., "Large - Blue"
  attributes: Record<string, string> // { size: "Large", color: "Blue" }
  priceAdjustment?: number // +/- from base price
  media?: ProductMedia[]
  inventory: InventoryInfo
  isDefault: boolean
}

export interface ProductDimensions {
  length: number
  width: number
  height: number
  unit: 'cm' | 'in' | 'm' | 'ft'
}

export interface ProductWeight {
  value: number
  unit: 'g' | 'kg' | 'lb' | 'oz'
}

export enum ProductStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  DISCONTINUED = 'discontinued',
  OUT_OF_STOCK = 'out_of_stock',
  PENDING_REVIEW = 'pending_review'
}

export enum ProductVisibility {
  VISIBLE = 'visible', // Publicly listed
  HIDDEN = 'hidden', // Not listed but accessible by URL
  PRIVATE = 'private', // Requires special access
  CATALOG_ONLY = 'catalog_only' // In catalog but not search
}

export interface ProductMetadata {
  brand?: string
  manufacturer?: string
  modelNumber?: string
  upc?: string // Universal Product Code
  ean?: string // European Article Number
  isbn?: string // For books
  countryOfOrigin?: string
  warrantyInfo?: string
  certifications?: string[] // ISO, CE, FCC, etc.
  customFields: Record<string, unknown> // Any additional data
}
