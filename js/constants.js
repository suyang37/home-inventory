/**
 * 常量定义 (PWA版)
 */

const DB = {
  PRODUCTS: 'products',
  LOCATIONS: 'locations',
  STORAGE_ITEMS: 'storage_items',
  CATEGORIES: 'categories'
};

const CATEGORIES = [
  { id: 'food', name: '食品', icon: '🍚', type: 'food' },
  { id: 'beverage', name: '饮料', icon: '🥤', type: 'food' },
  { id: 'condiment', name: '调味品', icon: '🧂', type: 'food' },
  { id: 'short_shelf', name: '短保食品', icon: '🥖', type: 'food' },
  { id: 'daily', name: '日用品', icon: '🧴', type: 'nonfood' },
  { id: 'medicine', name: '药品', icon: '💊', type: 'nonfood' },
  { id: 'cosmetic', name: '化妆品', icon: '💄', type: 'nonfood' },
  { id: 'electronics', name: '电子产品', icon: '📱', type: 'nonfood' },
  { id: 'clothing', name: '衣物', icon: '👕', type: 'nonfood' },
  { id: 'book', name: '书籍', icon: '📚', type: 'nonfood' },
  { id: 'tool', name: '工具', icon: '🔧', type: 'nonfood' },
  { id: 'other', name: '其他', icon: '📦', type: 'nonfood' }
];

const SHELF_LIFE_UNITS = [
  { id: 'days', name: '天' },
  { id: 'months', name: '月' },
  { id: 'years', name: '年' }
];

const EXPIRY_STATUS = {
  NORMAL: 'normal',
  EXPIRING: 'expiring',
  EXPIRED: 'expired',
  DISPOSED: 'disposed'
};

const EXPIRY_STATUS_TEXT = {
  [EXPIRY_STATUS.NORMAL]: '正常',
  [EXPIRY_STATUS.EXPIRING]: '即将过期',
  [EXPIRY_STATUS.EXPIRED]: '已过期',
  [EXPIRY_STATUS.DISPOSED]: '已丢弃'
};

const EXPIRY_STATUS_COLOR = {
  [EXPIRY_STATUS.NORMAL]: '#07c160',
  [EXPIRY_STATUS.EXPIRING]: '#ff9800',
  [EXPIRY_STATUS.EXPIRED]: '#f44336',
  [EXPIRY_STATUS.DISPOSED]: '#999999'
};

const EXPIRY_STATUS_CLASS = {
  [EXPIRY_STATUS.NORMAL]: 'tag-normal',
  [EXPIRY_STATUS.EXPIRING]: 'tag-expiring',
  [EXPIRY_STATUS.EXPIRED]: 'tag-expired',
  [EXPIRY_STATUS.DISPOSED]: 'tag-disposed'
};

const PAGINATION = {
  PAGE_SIZE: 20,
  DEFAULT_PAGE: 1
};
