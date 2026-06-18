/**
 * 本地存储数据库层 (PWA版)
 * 使用 localStorage 实现数据持久化
 * 提供与微信小程序版相同的 API 接口
 */

const STORAGE_KEYS = {
  PRODUCTS: 'db_products',
  LOCATIONS: 'db_locations'
};

// 生成唯一ID (使用 db 内部版本，避免与 util.js 冲突)
function _dbGenerateId() {
  return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// 获取当前时间字符串
function nowISO() {
  return new Date().toISOString();
}

/**
 * 数据库操作对象
 */
const db = {
  collection(collectionName) {
    return new Collection(collectionName);
  }
};

class Collection {
  constructor(name) {
    this.name = name;
    this._conditions = {};
    this._orders = [];
    this._skip = 0;
    this._limit = 0; // 0 表示不限制，返回所有数据
  }

  _getKey() {
    return this.name === 'products' ? STORAGE_KEYS.PRODUCTS : STORAGE_KEYS.LOCATIONS;
  }

  _readAll() {
    try {
      const data = localStorage.getItem(this._getKey());
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  _writeAll(data) {
    localStorage.setItem(this._getKey(), JSON.stringify(data));
  }

  _nextId() {
    return _dbGenerateId();
  }

  _now() {
    return nowISO();
  }

  where(conditions) {
    this._conditions = conditions || {};
    return this;
  }

  orderBy(field, order) {
    this._orders.push({ field, order: order || 'desc' });
    return this;
  }

  skip(n) {
    this._skip = n || 0;
    return this;
  }

  limit(n) {
    this._limit = n || 20;
    return this;
  }

  async doc(id) {
    return new DocQuery(this, id);
  }

  async get() {
    let data = this._readAll();

    if (this._conditions && Object.keys(this._conditions).length > 0) {
      data = this._filter(data, this._conditions);
    }

    if (this._orders.length > 0) {
      data = this._sort(data, this._orders);
    }

    const total = data.length;
    
    // 仅在设置了 limit (>0) 时才截断
    if (this._limit > 0) {
      const start = this._skip;
      const end = start + this._limit;
      data = data.slice(start, end);
    }

    return { data, total, errMsg: 'collection.get:ok' };
  }

  async count() {
    let data = this._readAll();

    if (this._conditions && Object.keys(this._conditions).length > 0) {
      data = this._filter(data, this._conditions);
    }

    return { total: data.length, errMsg: 'collection.count:ok' };
  }

  async add({ data }) {
    const list = this._readAll();
    const record = {
      ...data,
      _id: this._nextId(),
      _openid: 'local_user',
      createdAt: data.createdAt || this._now(),
      updatedAt: data.updatedAt || this._now()
    };
    list.push(record);
    this._writeAll(list);
    return { _id: record._id, errMsg: 'collection.add:ok' };
  }

  async update({ data }) {
    const list = this._readAll();
    const index = list.findIndex(item => item._id === this._docId);
    if (index >= 0) {
      list[index] = {
        ...list[index],
        ...data,
        _id: list[index]._id,
        updatedAt: this._now()
      };
      this._writeAll(list);
      return { stats: { updated: 1 }, errMsg: 'collection.update:ok' };
    }
    return { stats: { updated: 0 }, errMsg: 'collection.update:ok' };
  }

  async remove() {
    const list = this._readAll();
    const index = list.findIndex(item => item._id === this._docId);
    if (index >= 0) {
      list.splice(index, 1);
      this._writeAll(list);
      return { stats: { removed: 1 }, errMsg: 'collection.remove:ok' };
    }
    return { stats: { removed: 0 }, errMsg: 'collection.remove:ok' };
  }

  _filter(data, conditions) {
    return data.filter(item => {
      for (const key of Object.keys(conditions)) {
        const condition = conditions[key];
        const value = item[key];

        if (condition && condition.constructor && condition.constructor.name === 'RegExp') {
          if (!condition.test(value || '')) return false;
          continue;
        }

        if (condition && condition.in && Array.isArray(condition.in)) {
          if (!condition.in.includes(value)) return false;
          continue;
        }

        if (value !== condition) return false;
      }
      return true;
    });
  }

  _sort(data, orders) {
    return data.sort((a, b) => {
      for (const order of orders) {
        const { field, order: dir } = order;
        const aVal = a[field];
        const bVal = b[field];
        
        // 处理 null/undefined 值：空值排在最后
        if (aVal == null && bVal == null) continue;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        
        let cmp = 0;
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          cmp = aVal.localeCompare(bVal);
        } else if (typeof aVal === 'number' && typeof bVal === 'number') {
          cmp = aVal - bVal;
        } else {
          // 日期字符串比较
          cmp = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        }
        if (cmp !== 0) return dir === 'desc' ? -cmp : cmp;
      }
      return 0;
    });
  }
}

class DocQuery {
  constructor(collection, id) {
    this.collection = collection;
    this.collection._docId = id;
  }

  async get() {
    const data = this.collection._readAll();
    const record = data.find(item => item._id === this.collection._docId);
    return { data: record || null, errMsg: 'collection.doc.get:ok' };
  }

  async update({ data }) {
    return this.collection.update({ data });
  }

  async remove() {
    return this.collection.remove();
  }
}

/**
 * 创建 RegExp 对象
 */
function createRegExp({ regexp, options }) {
  try {
    return new RegExp(regexp, options);
  } catch (e) {
    return new RegExp('');
  }
}

/**
 * 命令对象
 */
const _ = {
  in: (arr) => ({ in: arr }),
  gt: (val) => ({ gt: val }),
  gte: (val) => ({ gte: val }),
  lt: (val) => ({ lt: val }),
  lte: (val) => ({ lte: val }),
  neq: (val) => ({ neq: val })
};
