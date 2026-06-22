/**
 * 云端同步模块 - WebDAV 实现
 * 
 * 支持坚果云 WebDAV 和自定义 WebDAV 服务。
 * 用户使用自己已有的云盘账号，无需注册新服务。
 * 
 * 版本: 1.0
 */

const SYNC_STORAGE_KEY = 'sync_config';
const SYNC_DATA_PATH = '/家庭物品管理/data.json';
const SYNC_MANIFEST_PATH = '/家庭物品管理/manifest.json';

// ========================================
// 同步配置
// ========================================

const SyncConfig = {
  /**
   * 获取保存的同步配置
   */
  get() {
    try {
      const data = localStorage.getItem(SYNC_STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },

  /**
   * 保存同步配置
   */
  save(config) {
    localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify({
      ...config,
      password: config.password || '',
      updatedAt: new Date().toISOString()
    }));
  },

  /**
   * 清除同步配置
   */
  clear() {
    localStorage.removeItem(SYNC_STORAGE_KEY);
  },

  /**
   * 获取预设的云盘配置
   */
  getPresets() {
    return [
      {
        id: 'jianguo',
        name: '坚果云',
        desc: '国内最稳定的 WebDAV 服务，免费版即可使用',
        url: 'https://dav.jianguoyun.com/dav/',
        docUrl: 'https://help.jianguoyun.com/?p=2064',
        icon: '🥜'
      },
      {
        id: 'custom',
        name: '自定义 WebDAV',
        desc: '支持任何 WebDAV 协议的云盘（如 NextCloud、天翼云盘等）',
        url: '',
        docUrl: '',
        icon: '☁️'
      }
    ];
  }
};

// ========================================
// WebDAV 客户端
// ========================================

const WebDAVClient = {
  _baseUrl: '',
  _username: '',
  _password: '',
  _authHeader: '',

  /**
   * 初始化客户端
   */
  init(config) {
    let baseUrl = config.url;
    // 确保 URL 以 / 结尾
    if (!baseUrl.endsWith('/')) baseUrl += '/';
    
    this._baseUrl = baseUrl;
    this._username = config.username;
    this._password = config.password;
    this._authHeader = 'Basic ' + btoa(`${config.username}:${config.password}`);
  },

  /**
   * 发送 WebDAV 请求
   */
  async _request(method, path, body = null, contentType = null) {
    const url = this._baseUrl + path.replace(/^\//, '');
    
    const headers = {
      'Authorization': this._authHeader,
    };

    if (contentType) {
      headers['Content-Type'] = contentType;
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body
      });
      return response;
    } catch (e) {
      console.error('WebDAV 请求失败:', e);
      throw new Error('网络连接失败，请检查服务器地址和网络');
    }
  },

  /**
   * 测试连接
   */
  async testConnection() {
    try {
      // PROPFIND 方法可以列出目录内容，用于测试连接
      const response = await this._request('PROPFIND', '/', null, 'application/xml');
      
      if (response.status === 401 || response.status === 403) {
        throw new Error('认证失败，请检查账号和密码');
      }
      if (response.status === 404) {
        throw new Error('服务器地址不正确');
      }
      if (response.ok || response.status === 207) {
        return { success: true };
      }
      throw new Error(`连接失败 (HTTP ${response.status})`);
    } catch (e) {
      if (e.message.includes('认证失败') || e.message.includes('服务器地址') || e.message.includes('网络连接')) {
        return { success: false, message: e.message };
      }
      return { success: false, message: '无法连接到服务器，请检查地址和网络' };
    }
  },

  /**
   * 确保目录存在
   */
  async _ensureDir(path) {
    const parts = path.split('/').filter(Boolean);
    let currentPath = '';
    
    for (const part of parts) {
      currentPath += '/' + part;
      // 尝试创建目录（MKCOL），如果已存在会返回 405，忽略即可
      try {
        await this._request('MKCOL', currentPath + '/');
      } catch (e) {
        // 目录可能已存在，忽略错误
      }
    }
  },

  /**
   * 上传文件
   */
  async upload(path, content) {
    // 确保目录存在
    const dirPath = path.substring(0, path.lastIndexOf('/'));
    await this._ensureDir(dirPath);
    
    const response = await this._request('PUT', path, content, 'application/json');
    
    if (response.ok || response.status === 201 || response.status === 204) {
      return { success: true };
    }
    throw new Error(`上传失败 (HTTP ${response.status})`);
  },

  /**
   * 下载文件
   */
  async download(path) {
    const response = await this._request('GET', path);
    
    if (response.status === 404) {
      return { success: false, notFound: true };
    }
    if (response.ok) {
      const text = await response.text();
      return { success: true, data: text };
    }
    throw new Error(`下载失败 (HTTP ${response.status})`);
  },

  /**
   * 删除文件
   */
  async remove(path) {
    const response = await this._request('DELETE', path);
    return { success: response.ok || response.status === 204 || response.status === 404 };
  }
};

// ========================================
// 同步管理器
// ========================================

const SyncManager = {
  _config: null,
  _client: null,

  /**
   * 获取同步状态
   */
  getStatus() {
    const config = SyncConfig.get();
    if (!config) {
      return { connected: false, lastSync: null, provider: null };
    }
    return {
      connected: true,
      lastSync: config.lastSync || null,
      provider: config.provider || 'custom',
      providerName: config.providerName || 'WebDAV',
      url: config.url || ''
    };
  },

  /**
   * 配置并测试连接
   */
  async configure(config) {
    this._config = config;
    this._client = WebDAVClient;
    this._client.init(config);

    // 测试连接
    const result = await this._client.testConnection();
    if (!result.success) {
      return result;
    }

    // 保存配置
    SyncConfig.save({
      ...config,
      lastSync: null,
      updatedAt: new Date().toISOString()
    });

    return { success: true };
  },

  /**
   * 断开同步连接
   */
  disconnect() {
    SyncConfig.clear();
    this._config = null;
    this._client = null;
  },

  /**
   * 上传数据到云端
   */
  async upload() {
    const config = SyncConfig.get();
    if (!config) {
      return { success: false, message: '请先配置云端同步' };
    }

    this._client = WebDAVClient;
    this._client.init(config);

    try {
      // 收集数据
      const products = JSON.parse(localStorage.getItem('db_products') || '[]');
      const locations = JSON.parse(localStorage.getItem('db_locations') || '[]');
      const familyData = JSON.parse(localStorage.getItem('family_data') || 'null');

      const data = {
        version: '1.0',
        updatedAt: new Date().toISOString(),
        deviceId: localStorage.getItem('current_user_id') || 'unknown',
        products,
        locations,
        family: familyData
      };

      // 上传数据文件
      const jsonContent = JSON.stringify(data, null, 2);
      const uploadResult = await this._client.upload(SYNC_DATA_PATH, jsonContent);
      
      if (!uploadResult.success) {
        throw new Error('上传数据文件失败');
      }

      // 上传清单文件（用于版本检测）
      const manifest = {
        version: Date.now(),
        lastSync: new Date().toISOString(),
        deviceId: localStorage.getItem('current_user_id') || 'unknown',
        dataSize: jsonContent.length
      };
      await this._client.upload(SYNC_MANIFEST_PATH, JSON.stringify(manifest, null, 2));

      // 更新同步时间
      config.lastSync = new Date().toISOString();
      SyncConfig.save(config);

      return { success: true, message: '同步成功' };
    } catch (e) {
      console.error('上传失败:', e);
      return { success: false, message: e.message || '同步失败，请检查网络连接' };
    }
  },

  /**
   * 从云端下载数据
   */
  async download() {
    const config = SyncConfig.get();
    if (!config) {
      return { success: false, message: '请先配置云端同步' };
    }

    this._client = WebDAVClient;
    this._client.init(config);

    try {
      // 下载数据文件
      const result = await this._client.download(SYNC_DATA_PATH);
      
      if (result.notFound) {
        return { success: false, message: '云端暂无数据，请先在其他设备上传' };
      }
      if (!result.success) {
        throw new Error('下载数据失败');
      }

      const data = JSON.parse(result.data);
      
      if (!data.products || !data.locations) {
        return { success: false, message: '云端数据格式不正确' };
      }

      // 写入本地存储
      localStorage.setItem('db_products', JSON.stringify(data.products));
      localStorage.setItem('db_locations', JSON.stringify(data.locations));
      
      if (data.family) {
        localStorage.setItem('family_data', JSON.stringify(data.family));
      }

      // 更新同步时间
      config.lastSync = new Date().toISOString();
      SyncConfig.save(config);

      return { 
        success: true, 
        message: `已同步 ${data.products.length} 件商品、${data.locations.length} 个位置`,
        data 
      };
    } catch (e) {
      console.error('下载失败:', e);
      return { success: false, message: e.message || '下载失败，请检查网络连接' };
    }
  },

  /**
   * 双向同步（先下载合并，再上传）
   */
  async sync() {
    // 先尝试下载
    const downloadResult = await this.download();
    
    if (downloadResult.success) {
      // 下载成功，再上传本地最新数据（合并）
      const uploadResult = await this.upload();
      return uploadResult;
    }

    // 如果云端没有数据，直接上传
    if (downloadResult.message === '云端暂无数据，请先在其他设备上传') {
      return await this.upload();
    }

    return downloadResult;
  }
};

// ========================================
// 暴露到全局
// ========================================
window.SyncManager = SyncManager;
window.SyncConfig = SyncConfig;
