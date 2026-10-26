import
// Example usage for different product types:

// Electronics (Smartphone)
const smartphone: ProductItem = {
  id: 'prod-001',
  sku: 'PHONE-SM-001',
  name: 'Pro Smartphone X',
  description: 'Latest flagship smartphone with advanced camera system',
  category: {
    id: 'cat-001',
    name: 'Smartphones',
    slug: 'smartphones',
    breadcrumbs: ['Electronics', 'Phones', 'Smartphones']
  },
  tags: ['5g', 'flagship', 'camera-phone'],
  price: {
    basePrice: 999.99,
    currency: 'USD',
    isTaxInclusive: false
  },
  inventory: {
    quantity: 150,
    reservedQuantity: 12,
    availableQuantity: 138,
    lowStockThreshold: 20,
    trackInventory: true,
    allowBackorders: false
  },
  media: [
    {
      id: 'med-001',
      type: 'image',
      url: 'https://example.com/phone-front.jpg',
      altText: 'Phone front view',
      sortOrder: 0,
      isPrimary: true
    }
  ],
  attributes: [
    {
      id: 'attr-001',
      name: 'Screen Size',
      value: 6.7,
      unit: 'inches',
      displayType: 'number',
      isFilterable: true,
      isVisible: true,
      group: 'Display'
    },
    {
      id: 'attr-002',
      name: 'Storage',
      value: ['128GB', '256GB', '512GB'],
      displayType: 'multiselect',
      isFilterable: true,
      isVisible: true,
      group: 'Storage'
    },
    {
      id: 'attr-003',
      name: '5G Enabled',
      value: true,
      displayType: 'boolean',
      isFilterable: true,
      isVisible: true,
      group: 'Connectivity'
    }
  ],
  variants: [
    {
      id: 'var-001',
      sku: 'PHONE-SM-001-128-BLK',
      name: '128GB - Black',
      attributes: { storage: '128GB', color: 'Black' },
      inventory: {
        quantity: 50,
        reservedQuantity: 5,
        availableQuantity: 45,
        lowStockThreshold: 10,
        trackInventory: true,
        allowBackorders: false
      },
      isDefault: true
    }
  ],
  dimensions: { length: 16, width: 7.5, height: 0.8, unit: 'cm' },
  weight: { value: 200, unit: 'g' },
  status: ProductStatus.ACTIVE,
  visibility: ProductVisibility.VISIBLE,
  metadata: {
    brand: 'TechCorp',
    manufacturer: 'TechCorp Manufacturing',
    modelNumber: 'SM-X-2024',
    upc: '123456789012',
    countryOfOrigin: 'China',
    customFields: { releaseDate: '2024-01-15', osVersion: 'Android 14' }
  },
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-03-15')
}

// Clothing (T-Shirt)
const tshirt: ProductItem = {
  id: 'prod-002',
  sku: 'TS-COT-001',
  name: 'Classic Cotton T-Shirt',
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
      url: 'https://example.com/tshirt-white.jpg',
      altText: 'White t-shirt',
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

// Digital Product (Software License)
const softwareLicense: ProductItem = {
  id: 'prod-003',
  sku: 'SW-DES-001',
  name: 'Pro Design Suite - Annual License',
  description: 'Professional design software with cloud storage',
  category: {
    id: 'cat-020',
    name: 'Design Software',
    slug: 'design-software',
    breadcrumbs: ['Software', 'Design', 'Design Software']
  },
  tags: ['design', 'subscription', 'professional'],
  price: {
    basePrice: 299.99,
    currency: 'USD',
    isTaxInclusive: true
  },
  inventory: {
    quantity: 999999, // Unlimited for digital
    reservedQuantity: 0,
    availableQuantity: 999999,
    lowStockThreshold: 0,
    trackInventory: false,
    allowBackorders: true
  },
  media: [
    {
      id: 'med-020',
      type: 'image',
      url: 'https://example.com/software-box.jpg',
      altText: 'Software package',
      sortOrder: 0,
      isPrimary: true
    }
  ],
  attributes: [
    {
      id: 'attr-020',
      name: 'License Type',
      value: 'Annual Subscription',
      displayType: 'text',
      isFilterable: true,
      isVisible: true
    },
    {
      id: 'attr-021',
      name: 'Platforms',
      value: ['Windows', 'macOS', 'Linux'],
      displayType: 'multiselect',
      isFilterable: true,
      isVisible: true
    },
    {
      id: 'attr-022',
      name: 'Cloud Storage',
      value: 100,
      unit: 'GB',
      displayType: 'number',
      isFilterable: true,
      isVisible: true
    }
  ],
  // No variants or dimensions for digital products
  status: ProductStatus.ACTIVE,
  visibility: ProductVisibility.VISIBLE,
  metadata: {
    brand: 'DesignSoft',
    manufacturer: 'DesignSoft Inc.',
    customFields: {
      downloadUrl: 'https://downloads.example.com/design-suite',
      licenseKeyType: 'auto-generated',
      subscriptionPeriod: '365 days'
    }
  },
  createdAt: new Date('2024-01-15'),
  updatedAt: new Date('2024-03-20')
}

console.log('Smartphone:', smartphone.name)
console.log('T-Shirt:', tshirt.name)
console.log('Software:', softwareLicense.name)
