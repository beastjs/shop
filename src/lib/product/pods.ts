import { type ProductItem, ProductStatus, ProductVisibility } from './types'

export const pods: ProductItem[] = [
  {
    id: 'prod-002',
    sku: 'TS-COT-001',
    name: 'cotton tee',
    description: 'Comfortable everyday cotton t-shirt',
    category: {
      id: 'cat-010',
      name: 'T-Shirts',
      slug: 't-shirts',
      breadcrumbs: ['Clothing', 'Men', 'T-Shirts']
    },
    tags: ['casual', 'cotton', 'basics'],
    price: {
      basePrice: 29.99,
      salePrice: 24.99,
      currency: 'USD',
      isTaxInclusive: false
    },
    inventory: {
      quantity: 500,
      reservedQuantity: 45,
      availableQuantity: 455,
      lowStockThreshold: 50,
      trackInventory: true,
      allowBackorders: true
    },
    media: [
      {
        id: 'med-010',
        type: 'image',
        url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80',
        altText: 'White cotton t-shirt',
        sortOrder: 0,
        isPrimary: true
      }
    ],
    attributes: [
      {
        id: 'attr-010',
        name: 'Material',
        value: '100% Cotton',
        displayType: 'text',
        isFilterable: true,
        isVisible: true,
        group: 'Fabric'
      },
      {
        id: 'attr-011',
        name: 'Fit',
        value: 'Regular',
        displayType: 'text',
        isFilterable: true,
        isVisible: true,
        group: 'Sizing'
      },
      {
        id: 'attr-012',
        name: 'Care Instructions',
        value: 'Machine wash cold',
        displayType: 'text',
        isFilterable: false,
        isVisible: true,
        group: 'Care'
      }
    ],
    variants: [
      {
        id: 'var-010',
        sku: 'TS-COT-001-M-WHT',
        name: 'Medium - White',
        attributes: { size: 'M', color: 'White' },
        inventory: {
          quantity: 100,
          reservedQuantity: 10,
          availableQuantity: 90,
          lowStockThreshold: 10,
          trackInventory: true,
          allowBackorders: true
        },
        isDefault: true
      },
      {
        id: 'var-011',
        sku: 'TS-COT-001-L-WHT',
        name: 'Large - White',
        attributes: { size: 'L', color: 'White' },
        inventory: {
          quantity: 100,
          reservedQuantity: 8,
          availableQuantity: 92,
          lowStockThreshold: 10,
          trackInventory: true,
          allowBackorders: true
        },
        isDefault: false
      }
    ],
    dimensions: { length: 70, width: 50, height: 2, unit: 'cm' },
    weight: { value: 200, unit: 'g' },
    status: ProductStatus.ACTIVE,
    visibility: ProductVisibility.VISIBLE,
    metadata: {
      brand: 'ComfortWear',
      countryOfOrigin: 'Vietnam',
      certifications: ['OEKO-TEX', 'GOTS'],
      customFields: { gender: 'unisex', season: 'all-year' }
    },
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-03-10')
  }
]
