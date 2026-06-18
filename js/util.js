/**
 * 工具函数集合 (PWA版)
 */

/**
 * 格式化日期为 YYYY-MM-DD
 */
function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 格式化日期为 YYYY年MM月DD日
 */
function formatDateCN(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${year}年${month}月${day}日`;
}

/**
 * 格式化时间为 HH:mm
 */
function formatTime(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * 格式化日期时间为 YYYY-MM-DD HH:mm
 */
function formatDateTime(date) {
  if (!date) return '';
  return `${formatDate(date)} ${formatTime(date)}`;
}

/**
 * 计算两个日期之间的天数差
 */
function daysBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.ceil((d1 - d2) / (1000 * 60 * 60 * 24));
}

/**
 * 计算过期状态
 */
function getExpiryInfo(expiryDate) {
  if (!expiryDate) return { status: 'normal', daysLeft: null, text: '未知' };

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

  let status, text;
  if (diffDays < 0) {
    status = 'expired';
    text = `已过期 ${Math.abs(diffDays)} 天`;
  } else if (diffDays === 0) {
    status = 'expired';
    text = '今天过期';
  } else if (diffDays <= 7) {
    status = 'expiring';
    text = `还剩 ${diffDays} 天`;
  } else {
    status = 'normal';
    text = `还剩 ${diffDays} 天`;
  }

  return { status, daysLeft: diffDays, text };
}

/**
 * 根据保质期计算过期日期
 */
function calculateExpiryDate(productionDate, shelfLife, unit) {
  if (!productionDate || !shelfLife) return '';

  const date = new Date(productionDate);
  if (isNaN(date.getTime())) return '';

  switch (unit) {
    case 'days':
      date.setDate(date.getDate() + shelfLife);
      break;
    case 'months':
      date.setMonth(date.getMonth() + shelfLife);
      break;
    case 'years':
      date.setFullYear(date.getFullYear() + shelfLife);
      break;
    default:
      date.setDate(date.getDate() + shelfLife);
  }

  return formatDate(date);
}

/**
 * 生成唯一ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * 防抖函数
 */
function debounce(fn, delay = 300) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
      timer = null;
    }, delay);
  };
}

/**
 * 节流函数
 */
function throttle(fn, interval = 300) {
  let last = 0;
  return function (...args) {
    const now = Date.now();
    if (now - last >= interval) {
      last = now;
      fn.apply(this, args);
    }
  };
}

/**
 * 深拷贝
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * 安全获取对象属性
 */
function get(obj, path, defaultValue) {
  const keys = path.split('.');
  let result = obj;
  for (const key of keys) {
    if (result === null || result === undefined || typeof result !== 'object') {
      return defaultValue;
    }
    result = result[key];
  }
  return result !== undefined ? result : defaultValue;
}

/**
 * 显示确认对话框
 */
function showConfirm(title, content) {
  return new Promise((resolve) => {
    const confirmed = window.confirm(content || '确定执行此操作吗？');
    resolve(confirmed);
  });
}

/**
 * 显示成功提示
 */
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  // 触发动画
  setTimeout(() => toast.classList.add('show'), 10);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

/**
 * 显示加载中
 */
function showLoading(title) {
  const overlay = document.createElement('div');
  overlay.className = 'loading-overlay';
  overlay.id = 'loadingOverlay';
  overlay.innerHTML = `
    <div class="loading-spinner"></div>
    <div class="loading-text">${title || '加载中...'}</div>
  `;
  document.body.appendChild(overlay);
}

/**
 * 隐藏加载
 */
function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.remove();
}
