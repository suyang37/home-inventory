/**
 * 家庭物品管理 - 主应用逻辑
 * 版本: 5.0
 */

// ========================================
// 路由
// ========================================
const Router = {
  currentPage: 'index',
  history: [],

  init() {
    window.addEventListener('hashchange', () => this.handleRoute());
    this.handleRoute();
  },

  handleRoute() {
    const hash = window.location.hash.slice(1) || 'index';
    this.navigate(hash, false);
  },

  navigate(page, pushState = true) {
    // 提取基础页面名（去掉参数部分）
    const basePage = page.split('-')[0];
    
    // 如果页面不存在，跳转到首页
    const pageEl = document.getElementById(`page-${page}`);
    if (!pageEl && !page.includes('-')) {
      page = 'index';
    }

    if (pushState) {
      window.location.hash = page;
      return;
    }

    // 隐藏所有页面
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

    // 显示目标页面
    const targetEl = document.getElementById(`page-${page}`);
    if (targetEl) {
      targetEl.classList.add('active');
    } else {
      // 处理带参数的页面（如 product-detail-xxx）
      const paramPage = page.split('-').slice(0, -1).join('-');
      const paramEl = document.getElementById(`page-${paramPage}`);
      if (paramEl) {
        paramEl.classList.add('active');
      } else {
        document.getElementById('page-index').classList.add('active');
        page = 'index';
      }
    }

    this.currentPage = page;
    this.updateTab(page);

    // 调用页面处理函数
    const handler = PageHandlers[page];
    if (handler) {
      handler();
    } else {
      // 尝试匹配带参数的页面处理器
      const baseHandler = PageHandlers[page.split('-').slice(0, -1).join('-')];
      if (baseHandler) baseHandler();
    }
  },

  updateTab(basePage) {
    // 更新标签高亮
    const validTabs = ['index', 'products', 'locations', 'mine'];
    document.querySelectorAll('.tab-item').forEach(tab => {
      const tabPage = tab.dataset.page;
      if (tabPage === basePage || (basePage === 'product-add' && tabPage === 'index')) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
  },

  back() {
    if (this.history.length > 0) {
      this.history.pop();
      const prev = this.history.pop() || 'index';
      this.navigate(prev, true);
    } else {
      this.navigate('index', true);
    }
  }
};

// ========================================
// 页面处理器
// ========================================
const PageHandlers = {};

// ========================================
// 首页
// ========================================
PageHandlers.index = async function() {
  const products = (await db.collection(DB.PRODUCTS).get()).data;
  
  // 更新统计
  const total = products.length;
  const normal = products.filter(p => { const i = getExpiryInfo(p.expiryDate); return i.status === 'normal'; }).length;
  const expiring = products.filter(p => { const i = getExpiryInfo(p.expiryDate); return i.status === 'expiring'; }).length;
  const expired = products.filter(p => { const i = getExpiryInfo(p.expiryDate); return i.status === 'expired'; }).length;
  
  document.getElementById('statTotal').textContent = total;
  document.getElementById('statNormal').textContent = normal;
  document.getElementById('statExpiring').textContent = expiring;
  document.getElementById('statExpired').textContent = expired;

  // 即将过期/已过期列表
  const expiringProducts = products
    .filter(p => { const i = getExpiryInfo(p.expiryDate); return i.status === 'expiring' || i.status === 'expired'; })
    .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

  const container = document.getElementById('expiringItems');
  if (expiringProducts.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-text">所有物品都在有效期内</div></div>';
  } else {
    container.innerHTML = expiringProducts.map(p => {
      const info = getExpiryInfo(p.expiryDate);
      const cat = CATEGORIES.find(c => c.id === p.category) || CATEGORIES[CATEGORIES.length - 1];
      return `
        <div class="product-item" onclick="Router.navigate('product-detail-${p._id}')">
          <div class="product-icon">${cat.icon}</div>
          <div class="product-info">
            <div class="product-name">${p.name}</div>
            <div class="product-meta">${p.locationName || '未设置位置'} · ${formatDate(p.expiryDate)}</div>
          </div>
          <div class="product-right">
            <span class="tag ${EXPIRY_STATUS_CLASS[info.status]}">${info.text}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // 重置搜索状态
  document.getElementById('homeSearchInput').value = '';
  document.getElementById('homeSearchResults').innerHTML = '';
  document.getElementById('homeSearchHistory').style.display = 'none';
  document.getElementById('homeStats').style.display = 'grid';
  document.getElementById('expiringList').style.display = 'block';
};

// ========================================
// 首页搜索
// ========================================
const doHomeSearch = debounce(async function() {
  const keyword = document.getElementById('homeSearchInput').value.trim();
  const resultsContainer = document.getElementById('homeSearchResults');
  const historyContainer = document.getElementById('homeSearchHistory');
  const statsContainer = document.getElementById('homeStats');
  const expiringContainer = document.getElementById('expiringList');

  if (!keyword) {
    resultsContainer.innerHTML = '';
    historyContainer.style.display = 'none';
    statsContainer.style.display = 'grid';
    expiringContainer.style.display = 'block';
    return;
  }

  // 隐藏统计和过期列表，显示搜索结果
  statsContainer.style.display = 'none';
  expiringContainer.style.display = 'none';
  historyContainer.style.display = 'none';

  showLoading('搜索中...');
  
  const products = (await db.collection(DB.PRODUCTS).get()).data;
  const results = products.filter(p => {
    return p.name.includes(keyword) || 
           (p.locationName && p.locationName.includes(keyword)) ||
           (p.notes && p.notes.includes(keyword));
  });

  hideLoading();

  // 保存搜索历史
  saveSearchHistory(keyword);

  if (results.length === 0) {
    resultsContainer.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-text">未找到匹配的商品</div></div>';
  } else {
    resultsContainer.innerHTML = results.map(p => {
      const info = getExpiryInfo(p.expiryDate);
      const cat = CATEGORIES.find(c => c.id === p.category) || CATEGORIES[CATEGORIES.length - 1];
      return `
        <div class="product-item" onclick="Router.navigate('product-detail-${p._id}')">
          <div class="product-icon">${cat.icon}</div>
          <div class="product-info">
            <div class="product-name">${highlightKeyword(p.name, keyword)}</div>
            <div class="product-meta">${p.locationName || '未设置位置'} · ${formatDate(p.expiryDate)}</div>
          </div>
          <div class="product-right">
            <span class="tag ${EXPIRY_STATUS_CLASS[info.status]}">${info.text}</span>
          </div>
        </div>
      `;
    }).join('');
  }
}, 300);

function clearHomeSearch() {
  document.getElementById('homeSearchInput').value = '';
  document.getElementById('homeSearchResults').innerHTML = '';
  document.getElementById('homeSearchHistory').style.display = 'none';
  document.getElementById('homeStats').style.display = 'grid';
  document.getElementById('expiringList').style.display = 'block';
}

// 搜索历史（复用，但渲染到首页）
function saveSearchHistory(keyword) {
  let history = JSON.parse(localStorage.getItem('search_history') || '[]');
  history = history.filter(h => h !== keyword);
  history.unshift(keyword);
  if (history.length > 10) history = history.slice(0, 10);
  localStorage.setItem('search_history', JSON.stringify(history));
  renderHomeSearchHistory();
}

function renderHomeSearchHistory() {
  const history = JSON.parse(localStorage.getItem('search_history') || '[]');
  const container = document.getElementById('homeSearchHistoryTags');
  
  if (history.length === 0) {
    document.getElementById('homeSearchHistory').style.display = 'none';
    return;
  }

  document.getElementById('homeSearchHistory').style.display = 'block';
  container.innerHTML = history.map(h => `
    <span class="history-tag" onclick="document.getElementById('homeSearchInput').value='${h.replace(/'/g, "\\'")}';doHomeSearch()">
      ${h}
      <button class="remove-btn" onclick="event.stopPropagation();removeSearchHistory('${h.replace(/'/g, "\\'")}')">×</button>
    </span>
  `).join('');
}

function removeSearchHistory(keyword) {
  let history = JSON.parse(localStorage.getItem('search_history') || '[]');
  history = history.filter(h => h !== keyword);
  localStorage.setItem('search_history', JSON.stringify(history));
  renderHomeSearchHistory();
}

function clearSearchHistory() {
  localStorage.removeItem('search_history');
  renderHomeSearchHistory();
}

function highlightKeyword(text, keyword) {
  if (!text || !keyword) return text || '';
  const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<strong style="color:var(--primary)">$1</strong>');
}

// ========================================
// 物品列表
// ========================================
let batchMode = false;
let selectedIds = new Set();

PageHandlers.products = async function() {
  const products = (await db.collection(DB.PRODUCTS).get()).data;
  
  // 按过期日期排序
  products.sort((a, b) => {
    const aInfo = getExpiryInfo(a.expiryDate);
    const bInfo = getExpiryInfo(b.expiryDate);
    const order = { 'expired': 0, 'expiring': 1, 'normal': 2 };
    const aOrder = order[aInfo.status] || 3;
    const bOrder = order[bInfo.status] || 3;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return new Date(a.expiryDate) - new Date(b.expiryDate);
  });

  const container = document.getElementById('productItems');
  if (products.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📦</div><div class="empty-text">还没有物品，点击右上角 ＋ 添加</div></div>';
  } else {
    container.innerHTML = products.map(p => {
      const info = getExpiryInfo(p.expiryDate);
      const cat = CATEGORIES.find(c => c.id === p.category) || CATEGORIES[CATEGORIES.length - 1];
      const isSelected = selectedIds.has(p._id);
      const expiryText = p.noExpiry ? '无保质期' : formatDate(p.expiryDate);
      const statusText = p.noExpiry ? '—' : info.text;
      const statusClass = p.noExpiry ? 'tag-normal' : EXPIRY_STATUS_CLASS[info.status];
      
      if (batchMode) {
        return `
          <div class="product-item ${isSelected ? 'selected' : ''}" onclick="toggleSelectItem('${p._id}')">
            <div class="product-checkbox">
              <span class="checkbox-icon ${isSelected ? 'checked' : ''}">${isSelected ? '✅' : '⬜'}</span>
            </div>
            <div class="product-icon">${cat.icon}</div>
            <div class="product-info">
              <div class="product-name">${p.name}</div>
              <div class="product-meta">${p.locationName || '未设置位置'} · ${expiryText}</div>
            </div>
            <div class="product-right">
              <span class="tag ${statusClass}">${statusText}</span>
            </div>
          </div>
        `;
      }
      
      return `
        <div class="product-item" onclick="Router.navigate('product-detail-${p._id}')">
          <div class="product-icon">${cat.icon}</div>
          <div class="product-info">
            <div class="product-name">${p.name}</div>
            <div class="product-meta">${p.locationName || '未设置位置'} · ${expiryText}</div>
          </div>
          <div class="product-right">
            <span class="tag ${statusClass}">${statusText}</span>
          </div>
        </div>
      `;
    }).join('');
  }
};

// 批量管理
function toggleBatchMode() {
  batchMode = !batchMode;
  selectedIds.clear();
  document.getElementById('batchActionBar').style.display = batchMode ? 'flex' : 'none';
  document.getElementById('batchManageBtn').textContent = batchMode ? '✅' : '📋';
  updateBatchCount();
  PageHandlers.products();
}

function toggleSelectAll() {
  const allChecked = document.getElementById('selectAllCheckbox').checked;
  if (allChecked) {
    // 全选 - 获取所有物品ID
    db.collection(DB.PRODUCTS).get().then(result => {
      result.data.forEach(p => selectedIds.add(p._id));
      document.getElementById('selectAllCheckbox').checked = true;
      updateBatchCount();
      PageHandlers.products();
    });
  } else {
    selectedIds.clear();
    updateBatchCount();
    PageHandlers.products();
  }
}

function toggleSelectItem(id) {
  if (selectedIds.has(id)) {
    selectedIds.delete(id);
  } else {
    selectedIds.add(id);
  }
  updateBatchCount();
  PageHandlers.products();
}

function updateBatchCount() {
  const count = selectedIds.size;
  document.getElementById('batchCount').textContent = `已选 ${count} 项`;
  document.getElementById('batchDeleteBtn').disabled = count === 0;
}

async function batchDelete() {
  const count = selectedIds.size;
  if (count === 0) return;
  
  const confirmed = await showConfirm('批量删除', `确定要删除选中的 ${count} 个物品吗？`);
  if (!confirmed) return;
  
  showLoading('正在删除...');
  for (const id of selectedIds) {
    await db.collection(DB.PRODUCTS).doc(id).remove();
  }
  hideLoading();
  
  selectedIds.clear();
  showToast(`已删除 ${count} 个物品`);
  toggleBatchMode();
}

// ========================================
// AI 识别 - 替代 OCR
// ========================================

async function takePhoto() {
  try {
    // 检查是否支持摄像头
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showToast('当前设备不支持摄像头', 'error');
      return;
    }

    // 创建 video 元素用于拍照
    const video = document.createElement('video');
    video.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;object-fit:cover;background:#000;z-index:1000';
    
    const canvas = document.createElement('canvas');
    const captureBtn = document.createElement('button');
    captureBtn.textContent = '📸 拍照';
    captureBtn.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);padding:16px 48px;font-size:18px;border:none;border-radius:50px;background:#fff;color:#333;z-index:1001;box-shadow:0 4px 20px rgba(0,0,0,0.3);cursor:pointer';
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕ 取消';
    closeBtn.style.cssText = 'position:fixed;top:40px;right:20px;padding:8px 16px;font-size:14px;border:none;border-radius:20px;background:rgba(0,0,0,0.5);color:#fff;z-index:1001;cursor:pointer';

    document.body.appendChild(video);
    document.body.appendChild(captureBtn);
    document.body.appendChild(closeBtn);

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
    });
    video.srcObject = stream;
    await video.play();

    return new Promise((resolve) => {
      const cleanup = () => {
        stream.getTracks().forEach(t => t.stop());
        video.remove();
        captureBtn.remove();
        closeBtn.remove();
      };

      captureBtn.onclick = async () => {
        // 拍照
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        cleanup();

        // 压缩图片
        const compressedDataUrl = await compressImage(canvas.toDataURL('image/jpeg', 0.9), 800, 0.7);
        
        // 显示预览
        const preview = document.getElementById('addImagePreview');
        const previewImg = document.getElementById('addImagePreviewImg');
        previewImg.src = compressedDataUrl;
        preview.style.display = 'block';
        document.getElementById('addImageData').value = compressedDataUrl;

        showLoading('AI 识别中...');

        try {
          const result = await AIClient.recognize(compressedDataUrl);
          hideLoading();
          
          if (result && result.name) {
            document.getElementById('addName').value = result.name;
            // 选中匹配的分类
            const catItems = document.querySelectorAll('#addCategoryGrid .category-item');
            catItems.forEach(item => {
              if (item.dataset.id === result.category) {
                item.classList.add('selected');
              } else {
                item.classList.remove('selected');
              }
            });
            showToast(`识别为: ${result.name}`);
          } else {
            showToast('AI 未识别到物品，请手动输入', 'error');
          }
        } catch (err) {
          hideLoading();
          console.error('AI 识别失败:', err);
          showToast('识别失败，请手动输入', 'error');
        }

        resolve();
      };

      closeBtn.onclick = () => {
        cleanup();
        resolve();
      };
    });
  } catch (err) {
    console.error('拍照失败:', err);
    showToast('无法打开摄像头', 'error');
  }
}

// ========================================
// 图片压缩
// ========================================
function compressImage(dataUrl, maxWidth = 800, quality = 0.7) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // 按最大宽度缩放
      if (width > maxWidth) {
        height = Math.round(height * maxWidth / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // 压缩为 JPEG
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
  });
}

function removeAddImage() {
  document.getElementById('addImagePreview').style.display = 'none';
  document.getElementById('addImagePreviewImg').src = '';
  document.getElementById('addImageData').value = '';
}

// ========================================
// 提交物品
// ========================================
async function submitProduct() {
  const name = document.getElementById('addName').value.trim();
  if (!name) {
    showToast('请输入物品名称', 'error');
    return;
  }

  const selectedCat = document.querySelector('#addCategoryGrid .category-item.selected');
  const category = selectedCat ? selectedCat.dataset.id : 'other';
  
  const locationId = document.getElementById('addLocation').value;
  const quantity = parseInt(document.getElementById('addQuantity').value) || 1;
  const noExpiry = document.getElementById('addNoExpiry').checked;
  const productionDate = document.getElementById('addProductionDate').value;
  const shelfLife = document.getElementById('addShelfLife').value;
  const shelfLifeUnit = document.getElementById('addShelfLifeUnit').value;
  const notes = document.getElementById('addNotes').value.trim();
  const imageData = document.getElementById('addImageData').value;

  // 计算过期日期
  let expiryDate = '';
  if (!noExpiry && productionDate && shelfLife) {
    expiryDate = calculateExpiryDate(productionDate, parseInt(shelfLife), shelfLifeUnit);
  }

  // 获取位置名称
  let locationName = '';
  if (locationId) {
    const locResult = await db.collection(DB.LOCATIONS).doc(locationId).get();
    locationName = locResult.data ? locResult.data.name : '';
  }

  // 压缩图片（如果存在）
  let finalImage = imageData;
  if (imageData) {
    finalImage = await compressImage(imageData, 600, 0.6);
  }

  const productData = {
    name,
    category,
    locationId,
    locationName,
    quantity,
    noExpiry: noExpiry || false,
    productionDate: noExpiry ? '' : productionDate,
    shelfLife: noExpiry ? '' : (shelfLife ? parseInt(shelfLife) : ''),
    shelfLifeUnit: noExpiry ? '' : shelfLifeUnit,
    expiryDate,
    notes,
    image: finalImage,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  showLoading('正在保存...');
  await db.collection(DB.PRODUCTS).add({ data: productData });
  hideLoading();

  showToast('添加成功');
  Router.navigate('products');
}

// ========================================
// 物品详情
// ========================================
PageHandlers['product-detail'] = async function() {
  const id = Router.currentPage.replace('product-detail-', '');
  if (!id) return;
  
  const result = await db.collection(DB.PRODUCTS).doc(id).get();
  const p = result.data;
  if (!p) {
    showToast('物品不存在', 'error');
    Router.navigate('products');
    return;
  }

  const info = getExpiryInfo(p.expiryDate);
  const cat = CATEGORIES.find(c => c.id === p.category) || CATEGORIES[CATEGORIES.length - 1];

  document.getElementById('detailHeader').textContent = p.name;
  
  // 状态横幅 - 无保质期物品不显示
  const statusBanner = p.noExpiry ? '' : `
    <div class="detail-status-banner ${EXPIRY_STATUS_CLASS[info.status]}">
      <span class="detail-status-icon">${info.status === 'expired' ? '❌' : info.status === 'expiring' ? '⚠️' : '✅'}</span>
      <span>${info.text}</span>
      <span class="detail-status-date">${formatDateCN(p.expiryDate)}</span>
    </div>
  `;

  document.getElementById('detailContent').innerHTML = `
    <!-- 图片区域 -->
    ${p.image ? `
      <div class="detail-image-section">
        <img src="${p.image}" class="detail-image" alt="${p.name}" onclick="previewImage(this.src)" />
      </div>
    ` : ''}
    
    ${statusBanner}

    <!-- 信息卡片 -->
    <div class="detail-info-card">
      <div class="detail-info-row">
        <span class="detail-info-label">📌 名称</span>
        <span class="detail-info-value">${p.name}</span>
      </div>
      <div class="detail-info-row">
        <span class="detail-info-label">🏷️ 分类</span>
        <span class="detail-info-value">${cat.icon} ${cat.name}</span>
      </div>
      <div class="detail-info-row">
        <span class="detail-info-label">📍 位置</span>
        <span class="detail-info-value">${p.locationName || '<span style="color:var(--text-light)">未设置</span>'}</span>
      </div>
      <div class="detail-info-row">
        <span class="detail-info-label">🔢 数量</span>
        <span class="detail-info-value">${p.quantity} 件</span>
      </div>
      ${p.noExpiry ? `
      <div class="detail-info-row">
        <span class="detail-info-label">⏳ 保质期</span>
        <span class="detail-info-value" style="color:var(--text-light)">无保质期</span>
      </div>
      ` : `
      <div class="detail-info-row">
        <span class="detail-info-label">📅 生产日期</span>
        <span class="detail-info-value">${p.productionDate ? formatDateCN(p.productionDate) : '<span style="color:var(--text-light)">未知</span>'}</span>
      </div>
      <div class="detail-info-row">
        <span class="detail-info-label">⏳ 保质期</span>
        <span class="detail-info-value">${p.shelfLife ? `${p.shelfLife}${SHELF_LIFE_UNITS.find(u => u.id === p.shelfLifeUnit)?.name || '天'}` : '<span style="color:var(--text-light)">未知</span>'}</span>
      </div>
      <div class="detail-info-row">
        <span class="detail-info-label">📆 过期日期</span>
        <span class="detail-info-value" style="font-weight:600;color:${EXPIRY_STATUS_COLOR[info.status]}">${formatDateCN(p.expiryDate)}</span>
      </div>
      `}
      ${p.notes ? `
      <div class="detail-info-row detail-notes-row">
        <span class="detail-info-label">📝 备注</span>
        <span class="detail-info-value">${p.notes}</span>
      </div>` : ''}
      <div class="detail-info-row" style="border-bottom:none">
        <span class="detail-info-label">🕐 创建时间</span>
        <span class="detail-info-value" style="font-size:12px;color:var(--text-light)">${formatDateTime(p.createdAt)}</span>
      </div>
    </div>
  `;

  // 操作按钮
  document.getElementById('detailActions').innerHTML = `
    <button class="btn btn-secondary" onclick="Router.navigate('product-edit-${p._id}')">✏️ 编辑</button>
    <button class="btn btn-danger" onclick="deleteProduct('${p._id}')">🗑️ 删除</button>
  `;
};

// 图片预览
function previewImage(src) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:999;display:flex;align-items:center;justify-content:center;cursor:pointer';
  overlay.onclick = () => overlay.remove();
  
  const img = document.createElement('img');
  img.src = src;
  img.style.cssText = 'max-width:95%;max-height:95%;object-fit:contain;border-radius:8px';
  
  overlay.appendChild(img);
  document.body.appendChild(overlay);
}

// ========================================
// 删除商品
// ========================================
async function deleteProduct(id) {
  const confirmed = await showConfirm('确认删除', '确定要删除这个物品吗？');
  if (!confirmed) return;
  
  showLoading('正在删除...');
  await db.collection(DB.PRODUCTS).doc(id).remove();
  hideLoading();
  
  showToast('删除成功');
  Router.navigate('products');
}

// ========================================
// 编辑物品
// ========================================
PageHandlers['product-edit'] = async function() {
  const id = Router.currentPage.replace('product-edit-', '');
  if (!id) return;
  
  const result = await db.collection(DB.PRODUCTS).doc(id).get();
  const p = result.data;
  if (!p) {
    showToast('物品不存在', 'error');
    Router.navigate('products');
    return;
  }

  document.getElementById('editName').value = p.name || '';
  document.getElementById('editQuantity').value = p.quantity || 1;
  document.getElementById('editProductionDate').value = p.productionDate || '';
  document.getElementById('editShelfLife').value = p.shelfLife || '';
  document.getElementById('editShelfLifeUnit').value = p.shelfLifeUnit || 'days';
  document.getElementById('editNotes').value = p.notes || '';

  // 处理无保质期
  const editNoExpiry = document.getElementById('editNoExpiry');
  if (p.noExpiry) {
    editNoExpiry.checked = true;
    toggleNoExpiry('edit');
  } else {
    editNoExpiry.checked = false;
    toggleNoExpiry('edit');
  }

  renderCategoryGrid('editCategoryGrid', p.category);
  await renderLocationSelect('editLocation', p.locationId);

  // 保存编辑 ID
  document.getElementById('editForm').dataset.id = id;
};

async function submitEdit() {
  const id = document.getElementById('editForm').dataset.id;
  if (!id) return;

  const name = document.getElementById('editName').value.trim();
  if (!name) {
    showToast('请输入物品名称', 'error');
    return;
  }

  const selectedCat = document.querySelector('#editCategoryGrid .category-item.selected');
  const category = selectedCat ? selectedCat.dataset.id : 'other';
  
  const locationId = document.getElementById('editLocation').value;
  const quantity = parseInt(document.getElementById('editQuantity').value) || 1;
  const noExpiry = document.getElementById('editNoExpiry').checked;
  const productionDate = document.getElementById('editProductionDate').value;
  const shelfLife = document.getElementById('editShelfLife').value;
  const shelfLifeUnit = document.getElementById('editShelfLifeUnit').value;
  const notes = document.getElementById('editNotes').value.trim();

  let expiryDate = '';
  if (!noExpiry && productionDate && shelfLife) {
    expiryDate = calculateExpiryDate(productionDate, parseInt(shelfLife), shelfLifeUnit);
  }

  let locationName = '';
  if (locationId) {
    const locResult = await db.collection(DB.LOCATIONS).doc(locationId).get();
    locationName = locResult.data ? locResult.data.name : '';
  }

  showLoading('正在保存...');
  await db.collection(DB.PRODUCTS).doc(id).update({
    data: {
      name, category, locationId, locationName, quantity,
      noExpiry: noExpiry || false,
      productionDate: noExpiry ? '' : productionDate,
      shelfLife: noExpiry ? '' : (shelfLife ? parseInt(shelfLife) : ''),
      shelfLifeUnit: noExpiry ? '' : shelfLifeUnit,
      expiryDate, notes,
      updatedAt: new Date().toISOString()
    }
  });
  hideLoading();

  showToast('修改成功');
  Router.navigate(`product-detail-${id}`);
}

// ========================================
// 位置列表
// ========================================
PageHandlers.locations = async function() {
  await renderLocationTree();
};

async function renderLocationTree() {
  const locations = (await db.collection(DB.LOCATIONS).get()).data;
  const products = (await db.collection(DB.PRODUCTS).get()).data;
  
  const container = document.getElementById('locationTree');
  
  if (locations.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📍</div><div class="empty-text">还没有位置，点击右上角 ＋ 添加</div></div>';
    return;
  }

  // 构建树
  const rootLocations = locations.filter(l => !l.parentId);
  container.innerHTML = rootLocations.map(loc => renderTreeNode(loc, locations, products)).join('');
}

function renderTreeNode(node, allLocations, products) {
  const children = allLocations.filter(l => l.parentId === node._id);
  const productCount = products.filter(p => p.locationId === node._id).length;
  
  let html = `
    <li class="tree-item">
      <div class="tree-node" onclick="Router.navigate('location-detail-${node._id}')">
        <span class="tree-icon">📁</span>
        <span class="tree-name">${node.name}</span>
        <span class="tree-count">${productCount}件</span>
      </div>
  `;
  
  if (children.length > 0) {
    html += '<ul class="tree-children">';
    html += children.map(child => renderTreeNode(child, allLocations, products)).join('');
    html += '</ul>';
  }
  
  html += '</li>';
  return html;
}

function toggleTree(el) {
  const parent = el.closest('.tree-item');
  const children = parent.querySelector('.tree-children');
  if (children) {
    children.style.display = children.style.display === 'none' ? 'block' : 'none';
  }
}

// ========================================
// 位置详情
// ========================================
PageHandlers['location-detail'] = async function() {
  const id = Router.currentPage.replace('location-detail-', '');
  if (!id) return;
  
  const locResult = await db.collection(DB.LOCATIONS).doc(id).get();
  const loc = locResult.data;
  if (!loc) {
    showToast('位置不存在', 'error');
    Router.navigate('locations');
    return;
  }

  document.getElementById('locDetailTitle').textContent = loc.name;

  // 获取该位置下的商品
  const products = (await db.collection(DB.PRODUCTS).get()).data;
  const locProducts = products.filter(p => p.locationId === id);

  const productsHtml = locProducts.length > 0
    ? locProducts.map(p => {
        const info = getExpiryInfo(p.expiryDate);
        const cat = CATEGORIES.find(c => c.id === p.category) || CATEGORIES[CATEGORIES.length - 1];
        return `
          <div class="product-item" onclick="Router.navigate('product-detail-${p._id}')">
            <div class="product-icon">${cat.icon}</div>
            <div class="product-info">
              <div class="product-name">${p.name}</div>
              <div class="product-meta">${formatDate(p.expiryDate)}</div>
            </div>
            <div class="product-right">
              <span class="tag ${EXPIRY_STATUS_CLASS[info.status]}">${info.text}</span>
            </div>
          </div>
        `;
      }).join('')
    : '<div class="empty-state"><div class="empty-text" style="padding:16px">该位置暂无物品</div></div>';

  document.getElementById('locProducts').innerHTML = productsHtml;

  // 操作按钮
  document.getElementById('locActions').innerHTML = `
    <button class="btn btn-secondary" onclick="showAddLocation('${id}')">📁 添加子位置</button>
    <button class="btn btn-secondary" onclick="showEditLocation('${id}')">✏️ 编辑</button>
    <button class="btn btn-danger" onclick="deleteLocation('${id}')">🗑️ 删除</button>
  `;
};

// 添加位置
function showAddLocation(parentId) {
  document.getElementById('addLocationParentId').value = parentId || '';
  document.getElementById('addLocationName').value = '';
  document.getElementById('locationFormTitle').textContent = parentId ? '添加子位置' : '添加位置';
  document.getElementById('locationForm').style.display = 'block';
}

async function showEditLocation(id) {
  const name = prompt('请输入新名称：');
  if (name && name.trim()) {
    showLoading('正在保存...');
    await db.collection(DB.LOCATIONS).doc(id).update({ data: { name: name.trim() } });
    hideLoading();
    showToast('修改成功');
    Router.navigate(`location-detail-${id}`);
  }
}

async function submitLocation() {
  const name = document.getElementById('addLocationName').value.trim();
  const parentId = document.getElementById('addLocationParentId').value;

  if (!name) {
    showToast('请输入位置名称', 'error');
    return;
  }

  showLoading('正在保存...');
  await db.collection(DB.LOCATIONS).add({
    data: { name, parentId: parentId || '' }
  });
  hideLoading();

  document.getElementById('locationForm').style.display = 'none';
  showToast('添加成功');
  Router.navigate('locations');
}

async function deleteLocation(id) {
  const confirmed = await showConfirm('确认删除', '删除位置会同时删除所有子位置，确定吗？');
  if (!confirmed) return;

  showLoading('正在删除...');
  
  // 递归删除所有子位置
  const allLocations = (await db.collection(DB.LOCATIONS).get()).data;
  const idsToDelete = getAllChildIds(id, allLocations);
  idsToDelete.push(id);
  
  for (const locId of idsToDelete) {
    await db.collection(DB.LOCATIONS).doc(locId).remove();
  }
  
  hideLoading();
  showToast('删除成功');
  Router.navigate('locations');
}

function getAllChildIds(parentId, allLocations) {
  const ids = [];
  const children = allLocations.filter(l => l.parentId === parentId);
  for (const child of children) {
    ids.push(child._id);
    ids.push(...getAllChildIds(child._id, allLocations));
  }
  return ids;
}

// ========================================
// 辅助函数
// ========================================

// 渲染分类网格
function renderCategoryGrid(containerId, selectedId) {
  const container = document.getElementById(containerId);
  container.innerHTML = CATEGORIES.map(c => `
    <div class="category-item ${c.id === selectedId ? 'selected' : ''}"
         data-id="${c.id}"
         onclick="selectCategory(this, '${containerId}')">
      <span class="cat-icon">${c.icon}</span>
      <span class="cat-name">${c.name}</span>
    </div>
  `).join('');
}

function selectCategory(el, containerId) {
  document.querySelectorAll(`#${containerId} .category-item`).forEach(item => {
    item.classList.remove('selected');
  });
  el.classList.add('selected');
}

// 渲染位置下拉
async function renderLocationSelect(selectId, selectedId) {
  const select = document.getElementById(selectId);
  const locations = (await db.collection(DB.LOCATIONS).get()).data;
  
  if (locations.length === 0) {
    // 没有位置时显示提示和快速添加入口
    select.innerHTML = '<option value="">暂无位置，请先添加</option>';
    
    // 在位置选择下方添加快速添加按钮
    const formGroup = select.closest('.form-group');
    let quickAddBtn = formGroup.querySelector('.quick-add-location');
    if (!quickAddBtn) {
      quickAddBtn = document.createElement('div');
      quickAddBtn.className = 'quick-add-location';
      quickAddBtn.style.cssText = 'margin-top:8px';
      quickAddBtn.innerHTML = `
        <button type="button" class="btn btn-sm btn-secondary" onclick="quickAddLocation('${selectId}')" style="width:100%">
          ➕ 快速添加位置
        </button>
      `;
      formGroup.appendChild(quickAddBtn);
    }
    return;
  }
  
  // 移除快速添加按钮（如果有）
  const formGroup = select.closest('.form-group');
  const existingBtn = formGroup.querySelector('.quick-add-location');
  if (existingBtn) existingBtn.remove();
  
  let html = '<option value="">未选择位置</option>';
  html += buildLocationOptions(locations, null, 0, selectedId);
  select.innerHTML = html;
}

// 快速添加位置（从添加商品页面）
async function quickAddLocation(selectId) {
  const name = prompt('请输入位置名称（如：冰箱、厨房、客厅）：');
  if (!name || !name.trim()) return;
  
  showLoading('正在添加...');
  await db.collection(DB.LOCATIONS).add({
    data: { name: name.trim(), parentId: '' }
  });
  hideLoading();
  
  showToast('位置添加成功');
  // 重新渲染位置下拉
  renderLocationSelect(selectId);
}

function buildLocationOptions(locations, parentId, level, selectedId) {
  let html = '';
  const children = locations.filter(l => l.parentId === (parentId || ''));
  const prefix = '　'.repeat(level);
  
  for (const loc of children) {
    html += `<option value="${loc._id}" ${loc._id === selectedId ? 'selected' : ''}>${prefix}${loc.name}</option>`;
    html += buildLocationOptions(locations, loc._id, level + 1, selectedId);
  }
  
  return html;
}

// ========================================
// 我的 - 页面处理器
// ========================================
PageHandlers.mine = async function() {
  const user = Family.getCurrentUser();
  const family = Family.getCurrent();

  // 更新用户信息
  document.getElementById('mineNickname').textContent = user.nickname;
  document.getElementById('mineFamilyName').textContent = family ? `${family.name} · ${Family.getRoleText(user.role)}` : '未加入家庭';

  // 渲染家庭管理区域
  const section = document.getElementById('mineFamilySection');
  
  if (!family) {
    // 未加入家庭 - 显示创建/加入选项
    section.innerHTML = `
      <div class="mine-card">
        <div class="mine-card-desc">加入家庭后，所有家庭成员可以共享物品数据</div>
        <div class="mine-card-actions">
          <button class="btn btn-primary" onclick="showCreateFamily()" style="flex:1">🏠 创建家庭</button>
          <button class="btn btn-secondary" onclick="showJoinFamily()" style="flex:1">🔑 加入家庭</button>
        </div>
      </div>
    `;
  } else {
    // 已加入家庭 - 显示家庭信息
    const members = family.members;
    const inviteCode = Family.getInviteCode();
    const isOwner = user.role === 'owner';

    section.innerHTML = `
      <div class="mine-card">
        <div class="mine-card-title">${family.name}</div>
        <div class="mine-card-desc">共 ${members.length} 位成员</div>
        
        <!-- 成员列表 -->
        <div class="family-members">
          ${members.map(m => {
            const isMe = m.id === user.id;
            const canManage = isOwner && m.role !== 'owner';
            return `
              <div class="family-member-item">
                <span class="member-avatar">${m.role === 'owner' ? '👑' : m.role === 'admin' ? '⭐' : '👤'}</span>
                <span class="member-name">${m.nickname}${isMe ? ' (我)' : ''}</span>
                <span class="member-role tag tag-${m.role}">${Family.getRoleText(m.role)}</span>
                ${canManage ? `
                  <select class="member-role-select" onchange="changeMemberRole('${m.id}', this.value)">
                    <option value="admin" ${m.role === 'admin' ? 'selected' : ''}>管理员</option>
                    <option value="member" ${m.role === 'member' ? 'selected' : ''}>成员</option>
                    <option value="viewer" ${m.role === 'viewer' ? 'selected' : ''}>仅查看</option>
                  </select>
                  <button class="member-remove-btn" onclick="removeFamilyMember('${m.id}')">✕</button>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>

        <!-- 邀请码 -->
        ${inviteCode ? `
          <div class="invite-code-section">
            <div class="invite-code-label">邀请码</div>
            <div class="invite-code-value" onclick="copyInviteCode()">
              <span>${inviteCode}</span>
              <span class="invite-code-copy">📋 复制</span>
            </div>
            <div class="invite-code-hint">分享此邀请码给家人，他们可以加入家庭</div>
            ${isOwner ? `<button class="btn btn-sm btn-secondary" onclick="refreshInviteCode()" style="margin-top:8px">🔄 刷新邀请码</button>` : ''}
          </div>
        ` : ''}

        <!-- 操作按钮 -->
        <div style="margin-top:12px;display:flex;gap:8px">
          ${isOwner ? `
            <button class="btn btn-danger btn-sm" onclick="deleteFamily()" style="flex:1">🗑️ 删除家庭</button>
          ` : `
            <button class="btn btn-secondary btn-sm" onclick="leaveFamily()" style="flex:1">🚪 退出家庭</button>
          `}
        </div>
      </div>
    `;
  }

  // 渲染云端同步状态
  renderSyncStatus();

  // 渲染 AI 识别配置状态
  renderAIStatus();
};

// ========================================
// 云端同步 UI
// ========================================

// 渲染同步状态
function renderSyncStatus() {
  const container = document.getElementById('mineSyncSection');
  const status = SyncManager.getStatus();

  if (!status.connected) {
    container.innerHTML = `
      <div class="sync-status-card">
        <div class="sync-status-row">
          <span class="sync-label">状态</span>
          <span class="sync-value"><span class="sync-status-dot disconnected"></span>未连接</span>
        </div>
        <div class="sync-actions">
          <button class="btn btn-primary" onclick="showSyncConfig()" style="flex:1">☁️ 配置同步</button>
        </div>
      </div>
    `;
    return;
  }

  const lastSync = status.lastSync ? formatDateTime(status.lastSync) : '尚未同步';
  const providerIcon = status.provider === 'jianguo' ? '🥜' : '☁️';

  container.innerHTML = `
    <div class="sync-status-card">
      <div class="sync-status-row">
        <span class="sync-label">状态</span>
        <span class="sync-value"><span class="sync-status-dot connected"></span>已连接</span>
      </div>
      <div class="sync-status-row">
        <span class="sync-label">服务</span>
        <span class="sync-value">${providerIcon} ${status.providerName || 'WebDAV'}</span>
      </div>
      <div class="sync-status-row">
        <span class="sync-label">上次同步</span>
        <span class="sync-value">${lastSync}</span>
      </div>
      <div class="sync-actions">
        <button class="btn btn-primary" onclick="doSync()" style="flex:1">🔄 立即同步</button>
        <button class="btn btn-secondary" onclick="showSyncConfig()" style="flex:1">⚙️ 设置</button>
      </div>
      <div style="margin-top:8px;text-align:center">
        <button class="btn btn-sm" onclick="disconnectSync()" style="color:var(--danger);background:none;border:none;font-size:12px;cursor:pointer">断开连接</button>
      </div>
    </div>
  `;
}

// 显示同步配置弹窗
function showSyncConfig() {
  const existing = document.querySelector('.sync-modal-overlay');
  if (existing) existing.remove();

  const presets = SyncConfig.getPresets();
  const currentConfig = SyncConfig.get();
  const selectedProvider = currentConfig ? (currentConfig.provider || 'custom') : 'jianguo';

  const overlay = document.createElement('div');
  overlay.className = 'sync-modal-overlay';
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  overlay.innerHTML = `
    <div class="sync-modal">
      <div class="sync-modal-title">☁️ 云端同步配置</div>
      
      <div class="sync-provider-list">
        ${presets.map(p => `
          <div class="sync-provider-item ${p.id === selectedProvider ? 'selected' : ''}"
               data-provider="${p.id}"
               onclick="selectSyncProvider('${p.id}')">
            <div class="sync-provider-icon">${p.icon}</div>
            <div class="sync-provider-name">${p.name}</div>
            <div class="sync-provider-desc">${p.desc}</div>
          </div>
        `).join('')}
      </div>

      <div class="sync-config-form" id="syncConfigForm">
        <div class="form-group" id="syncUrlGroup">
          <label class="form-label">服务器地址</label>
          <input type="url" class="form-input" id="syncUrl" placeholder="${selectedProvider === 'jianguo' ? 'https://dav.jianguoyun.com/dav/' : 'https://example.com/remote.php/dav/'}" />
          <div class="form-hint" id="syncUrlHint">
            ${selectedProvider === 'jianguo'
              ? '坚果云 WebDAV 地址：<a href="https://help.jianguoyun.com/?p=2064" target="_blank">如何获取？</a>'
              : '请输入您的 WebDAV 服务器地址'}
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">用户名</label>
          <input type="text" class="form-input" id="syncUsername" placeholder="请输入用户名 / 邮箱" />
        </div>
        <div class="form-group">
          <label class="form-label">密码</label>
          <input type="password" class="form-input" id="syncPassword" placeholder="请输入密码 / 应用密码" />
          <div class="form-hint" id="syncPasswordHint">
            ${selectedProvider === 'jianguo'
              ? '坚果云请使用<strong>应用密码</strong>，不是登录密码。<a href="https://help.jianguoyun.com/?p=2064" target="_blank">如何设置？</a>'
              : '请输入您的 WebDAV 密码'}
          </div>
        </div>
      </div>

      <div class="sync-modal-actions">
        <button class="btn btn-secondary" onclick="this.closest('.sync-modal-overlay').remove()">取消</button>
        <button class="btn btn-secondary" onclick="testSyncConnection()">🔌 测试连接</button>
        <button class="btn btn-primary" onclick="saveSyncConfig()">💾 保存</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // 填充已有配置
  if (currentConfig) {
    document.getElementById('syncUrl').value = currentConfig.url || '';
    document.getElementById('syncUsername').value = currentConfig.username || '';
    document.getElementById('syncPassword').value = currentConfig.password || '';
  } else {
    // 默认填充坚果云地址
    if (selectedProvider === 'jianguo') {
      document.getElementById('syncUrl').value = 'https://dav.jianguoyun.com/dav/';
    }
  }
}

// 选择同步服务商
function selectSyncProvider(providerId) {
  document.querySelectorAll('.sync-provider-item').forEach(item => {
    item.classList.toggle('selected', item.dataset.provider === providerId);
  });

  const presets = SyncConfig.getPresets();
  const preset = presets.find(p => p.id === providerId);

  const urlInput = document.getElementById('syncUrl');
  const urlHint = document.getElementById('syncUrlHint');
  const passwordHint = document.getElementById('syncPasswordHint');

  if (providerId === 'jianguo') {
    urlInput.placeholder = 'https://dav.jianguoyun.com/dav/';
    urlInput.value = 'https://dav.jianguoyun.com/dav/';
    urlHint.innerHTML = '坚果云 WebDAV 地址：<a href="https://help.jianguoyun.com/?p=2064" target="_blank">如何获取？</a>';
    passwordHint.innerHTML = '坚果云请使用<strong>应用密码</strong>，不是登录密码。<a href="https://help.jianguoyun.com/?p=2064" target="_blank">如何设置？</a>';
  } else {
    urlInput.placeholder = 'https://example.com/remote.php/dav/';
    urlInput.value = '';
    urlHint.textContent = '请输入您的 WebDAV 服务器地址';
    passwordHint.innerHTML = '请输入您的 WebDAV 密码';
  }
}

// 测试同步连接
async function testSyncConnection() {
  const config = getSyncFormConfig();
  if (!config) return;

  const testBtn = document.querySelector('.sync-modal-actions .btn-secondary:not(:first-child)');
  const originalText = testBtn.textContent;
  testBtn.textContent = '⏳ 测试中...';
  testBtn.disabled = true;

  const result = await SyncManager.configure(config);

  testBtn.textContent = originalText;
  testBtn.disabled = false;

  if (result.success) {
    showToast('✅ 连接成功！');
    // 重新渲染同步状态
    renderSyncStatus();
  } else {
    showToast('❌ ' + (result.message || '连接失败'), 'error');
  }
}

// 保存同步配置
async function saveSyncConfig() {
  const config = getSyncFormConfig();
  if (!config) return;

  showLoading('正在保存配置...');
  const result = await SyncManager.configure(config);
  hideLoading();

  if (result.success) {
    showToast('配置已保存');
    document.querySelector('.sync-modal-overlay')?.remove();
    renderSyncStatus();
  } else {
    showToast('❌ ' + (result.message || '配置失败'), 'error');
  }
}

// 获取表单配置
function getSyncFormConfig() {
  const selectedItem = document.querySelector('.sync-provider-item.selected');
  const providerId = selectedItem ? selectedItem.dataset.provider : 'custom';
  const presets = SyncConfig.getPresets();
  const preset = presets.find(p => p.id === providerId);

  const url = document.getElementById('syncUrl').value.trim();
  const username = document.getElementById('syncUsername').value.trim();
  const password = document.getElementById('syncPassword').value.trim();

  if (!url) {
    showToast('请输入服务器地址', 'error');
    return null;
  }
  if (!username) {
    showToast('请输入用户名', 'error');
    return null;
  }
  if (!password) {
    showToast('请输入密码', 'error');
    return null;
  }

  return {
    provider: providerId,
    providerName: preset ? preset.name : 'WebDAV',
    url,
    username,
    password
  };
}

// 执行同步
async function doSync() {
  const status = SyncManager.getStatus();
  if (!status.connected) {
    showToast('请先配置云端同步', 'error');
    return;
  }

  showLoading('正在同步...');
  const result = await SyncManager.sync();
  hideLoading();

  if (result.success) {
    showToast('✅ ' + (result.message || '同步成功'));
    renderSyncStatus();
  } else {
    showToast('❌ ' + (result.message || '同步失败'), 'error');
  }
}

// 断开同步连接
function disconnectSync() {
  showConfirm('断开连接', '确定要断开云端同步连接吗？配置信息将被清除。').then(confirmed => {
    if (!confirmed) return;
    SyncManager.disconnect();
    showToast('已断开连接');
    renderSyncStatus();
  });
}

// ========================================
// 无保质期切换
// ========================================
function toggleNoExpiry(prefix) {
  const noExpiry = document.getElementById(prefix + 'NoExpiry').checked;
  const shelfLifeRow = document.getElementById(prefix + 'ShelfLife').closest('.form-row');
  const productionDateGroup = document.getElementById(prefix + 'ProductionDate').closest('.form-group');
  
  if (noExpiry) {
    shelfLifeRow.style.display = 'none';
    productionDateGroup.style.display = 'none';
    document.getElementById(prefix + 'ProductionDate').value = '';
    document.getElementById(prefix + 'ShelfLife').value = '';
  } else {
    shelfLifeRow.style.display = 'flex';
    productionDateGroup.style.display = 'block';
  }
}

// ========================================
// AI 识别配置 UI
// ========================================

// 渲染 AI 配置状态
function renderAIStatus() {
  const container = document.getElementById('mineAISection');
  const config = AIConfig.get();

  if (!config) {
    container.innerHTML = `
      <div class="sync-status-card">
        <div class="sync-status-row">
          <span class="sync-label">状态</span>
          <span class="sync-value"><span class="sync-status-dot disconnected"></span>未配置</span>
        </div>
        <div class="sync-actions">
          <button class="btn btn-primary" onclick="showAIConfig()" style="flex:1">🤖 配置 AI</button>
        </div>
      </div>
    `;
    return;
  }

  const presets = AIConfig.getPresets();
  const preset = presets.find(p => p.id === config.provider);
  const providerName = preset ? preset.name : config.provider;

  container.innerHTML = `
    <div class="sync-status-card">
      <div class="sync-status-row">
        <span class="sync-label">状态</span>
        <span class="sync-value"><span class="sync-status-dot connected"></span>已配置</span>
      </div>
      <div class="sync-status-row">
        <span class="sync-label">服务</span>
        <span class="sync-value">${providerName}</span>
      </div>
      <div class="sync-actions">
        <button class="btn btn-primary" onclick="showAIConfig()" style="flex:1">⚙️ 修改配置</button>
      </div>
      <div style="margin-top:8px;text-align:center">
        <button class="btn btn-sm" onclick="disconnectAI()" style="color:var(--danger);background:none;border:none;font-size:12px;cursor:pointer">清除配置</button>
      </div>
    </div>
  `;
}

// 显示 AI 配置弹窗
function showAIConfig() {
  const existing = document.querySelector('.sync-modal-overlay');
  if (existing) existing.remove();

  const presets = AIConfig.getPresets();
  const currentConfig = AIConfig.get();
  const selectedProvider = currentConfig ? currentConfig.provider : presets[0].id;

  const overlay = document.createElement('div');
  overlay.className = 'sync-modal-overlay';
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  overlay.innerHTML = `
    <div class="sync-modal">
      <div class="sync-modal-title">🤖 AI 识别配置</div>
      <div class="sync-modal-desc" style="font-size:12px;color:var(--text-light);margin-bottom:12px">
        选择 AI 服务商并填入你的 API Key，拍照识别时将自动调用 AI 识别物品
      </div>
      
      <div class="sync-provider-list">
        ${presets.map(p => `
          <div class="sync-provider-item ${p.id === selectedProvider ? 'selected' : ''}"
               data-provider="${p.id}"
               onclick="selectAIProvider('${p.id}')">
            <div class="sync-provider-icon">${p.icon}</div>
            <div class="sync-provider-name">${p.name}</div>
            <div class="sync-provider-desc">${p.desc}</div>
          </div>
        `).join('')}
      </div>

      <div class="sync-config-form" id="aiConfigForm">
        <div class="form-group">
          <label class="form-label">API Key</label>
          <input type="password" class="form-input" id="aiApiKey" placeholder="请输入你的 API Key" />
          <div class="form-hint" id="aiApiKeyHint">
            你的 API Key 仅存储在本地浏览器中，不会上传到任何服务器
          </div>
        </div>
      </div>

      <div class="sync-modal-actions">
        <button class="btn btn-secondary" onclick="this.closest('.sync-modal-overlay').remove()">取消</button>
        <button class="btn btn-secondary" onclick="testAIConnection()">🔌 测试连接</button>
        <button class="btn btn-primary" onclick="saveAIConfig()">💾 保存</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // 填充已有配置
  if (currentConfig) {
    document.getElementById('aiApiKey').value = currentConfig.apiKey || '';
  }
}

// 选择 AI 服务商
function selectAIProvider(providerId) {
  document.querySelectorAll('.sync-provider-item').forEach(item => {
    item.classList.toggle('selected', item.dataset.provider === providerId);
  });
}

// 测试 AI 连接
async function testAIConnection() {
  const selectedItem = document.querySelector('.sync-provider-item.selected');
  if (!selectedItem) {
    showToast('请选择 AI 服务商', 'error');
    return;
  }
  const providerId = selectedItem.dataset.provider;
  const apiKey = document.getElementById('aiApiKey').value.trim();

  if (!apiKey) {
    showToast('请输入 API Key', 'error');
    return;
  }

  const testBtn = document.querySelector('.sync-modal-actions .btn-secondary:not(:first-child)');
  const originalText = testBtn.textContent;
  testBtn.textContent = '⏳ 测试中...';
  testBtn.disabled = true;

  // 临时保存配置进行测试
  AIConfig.save({ provider: providerId, apiKey });
  const result = await AIClient.test();

  testBtn.textContent = originalText;
  testBtn.disabled = false;

  if (result.success) {
    showToast('✅ 连接成功！');
  } else {
    showToast('❌ ' + (result.message || '连接失败'), 'error');
  }
}

// 保存 AI 配置
function saveAIConfig() {
  const selectedItem = document.querySelector('.sync-provider-item.selected');
  if (!selectedItem) {
    showToast('请选择 AI 服务商', 'error');
    return;
  }
  const providerId = selectedItem.dataset.provider;
  const apiKey = document.getElementById('aiApiKey').value.trim();

  if (!apiKey) {
    showToast('请输入 API Key', 'error');
    return;
  }

  AIConfig.save({ provider: providerId, apiKey });
  showToast('配置已保存');
  document.querySelector('.sync-modal-overlay')?.remove();
  renderAIStatus();
}

// 清除 AI 配置
function disconnectAI() {
  showConfirm('清除配置', '确定要清除 AI 识别配置吗？').then(confirmed => {
    if (!confirmed) return;
    AIConfig.clear();
    showToast('配置已清除');
    renderAIStatus();
  });
}

// ========================================
// 家庭管理 UI
// ========================================

// 显示创建家庭弹窗
function showCreateFamily() {
  const name = prompt('请输入家庭名称（如：幸福之家）：');
  if (!name || !name.trim()) return;
  
  const nickname = prompt('请输入您的昵称：', localStorage.getItem('current_user_nickname') || '');
  if (!nickname || !nickname.trim()) return;

  const result = Family.createFamily(name.trim(), nickname.trim());
  if (result.success) {
    showToast('家庭创建成功！');
    Router.navigate('mine');
  } else {
    showToast(result.message, 'error');
  }
}

// 显示加入家庭弹窗
function showJoinFamily() {
  const inviteCode = prompt('请输入家庭邀请码（演示：输入 FAMILY）：');
  if (!inviteCode || !inviteCode.trim()) return;
  
  const nickname = prompt('请输入您的昵称：', localStorage.getItem('current_user_nickname') || '');
  if (!nickname || !nickname.trim()) return;

  const result = Family.joinFamily(inviteCode.trim(), nickname.trim());
  if (result.success) {
    showToast('加入家庭成功！');
    Router.navigate('mine');
  } else {
    showToast(result.message, 'error');
  }
}

// 退出家庭
async function leaveFamily() {
  const confirmed = await showConfirm('退出家庭', '确定要退出当前家庭吗？');
  if (!confirmed) return;
  
  const result = Family.leaveFamily();
  if (result.success) {
    showToast('已退出家庭');
    Router.navigate('mine');
  } else {
    showToast(result.message, 'error');
  }
}

// 删除家庭
async function deleteFamily() {
  const confirmed = await showConfirm('删除家庭', '确定要删除整个家庭吗？所有成员数据将丢失！');
  if (!confirmed) return;
  
  const confirmed2 = await showConfirm('再次确认', '此操作不可恢复！');
  if (!confirmed2) return;
  
  const result = Family.deleteFamily();
  if (result.success) {
    showToast('家庭已删除');
    Router.navigate('mine');
  } else {
    showToast(result.message, 'error');
  }
}

// 修改成员角色
function changeMemberRole(memberId, newRole) {
  const result = Family.setMemberRole(memberId, newRole);
  if (result.success) {
    showToast('角色已更新');
    Router.navigate('mine');
  } else {
    showToast(result.message, 'error');
  }
}

// 移除成员
async function removeFamilyMember(memberId) {
  const confirmed = await showConfirm('移除成员', '确定要移除该成员吗？');
  if (!confirmed) return;
  
  const result = Family.removeMember(memberId);
  if (result.success) {
    showToast('成员已移除');
    Router.navigate('mine');
  } else {
    showToast(result.message, 'error');
  }
}

// 复制邀请码
function copyInviteCode() {
  const family = Family.getCurrent();
  if (family && family.inviteCode) {
    navigator.clipboard.writeText(family.inviteCode).then(() => {
      showToast('邀请码已复制');
    }).catch(() => {
      showToast('复制失败，请手动复制', 'error');
    });
  }
}

// 刷新邀请码
function refreshInviteCode() {
  const result = Family.refreshInviteCode();
  if (result.success) {
    showToast('邀请码已刷新');
    Router.navigate('mine');
  } else {
    showToast(result.message, 'error');
  }
}

// ========================================
// 导出 / 导入 / 清除数据
// ========================================

// 清除所有数据
async function clearAllData() {
  const confirmed = await showConfirm('警告', '确定要清除所有数据吗？此操作不可恢复！');
  if (!confirmed) return;
  
  const confirmed2 = await showConfirm('再次确认', '所有商品和位置数据将被永久删除！');
  if (!confirmed2) return;
  
  showLoading('正在清除...');
  
  // 通过 db 层逐个删除商品
  const products = (await db.collection(DB.PRODUCTS).get()).data;
  for (const p of products) {
    await db.collection(DB.PRODUCTS).doc(p._id).remove();
  }
  
  // 通过 db 层逐个删除位置
  const locations = (await db.collection(DB.LOCATIONS).get()).data;
  for (const loc of locations) {
    await db.collection(DB.LOCATIONS).doc(loc._id).remove();
  }
  
  hideLoading();
  showToast('已清除所有数据');
  Router.navigate('index');
}

// 导出数据
function exportData() {
  const products = JSON.parse(localStorage.getItem('db_products') || '[]');
  const locations = JSON.parse(localStorage.getItem('db_locations') || '[]');
  
  const data = {
    exportTime: new Date().toISOString(),
    version: '1.0',
    products,
    locations
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.download = `家庭物品管理_备份_${formatDate(new Date())}.json`;
  a.href = url;
  a.click();
  URL.revokeObjectURL(url);
  
  showToast('导出成功');
}

// 导入数据
function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        
        if (data.products) {
          localStorage.setItem('db_products', JSON.stringify(data.products));
        }
        if (data.locations) {
          localStorage.setItem('db_locations', JSON.stringify(data.locations));
        }
        
        showToast('导入成功');
        Router.navigate('index');
      } catch (err) {
        showToast('导入失败：文件格式错误', 'error');
      }
    };
    reader.readAsText(file);
  };
  
  input.click();
}

// ========================================
// 全局错误处理
// ========================================
window.addEventListener('error', function(e) {
  console.error('全局错误:', e.message, e.filename, e.lineno);
  hideLoading();
  showToast('页面发生错误，请刷新重试', 'error');
});

window.addEventListener('unhandledrejection', function(e) {
  console.error('未处理的Promise拒绝:', e.reason);
  hideLoading();
});

// ========================================
// 初始化
// ========================================
document.addEventListener('DOMContentLoaded', () => {
  Router.init();

  // 首页搜索框聚焦时显示搜索历史
  document.getElementById('homeSearchInput').addEventListener('focus', function() {
    const keyword = this.value.trim();
    if (!keyword) {
      renderHomeSearchHistory();
    }
  });
  
  // 注册 Service Worker - 使用 update 模式确保新 SW 能激活
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then((registration) => {
        console.log('Service Worker 注册成功');
        
        // 检查是否有新版本等待激活
        if (registration.waiting) {
          console.log('新版本 Service Worker 等待激活');
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        
        // 监听更新
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('新版本已下载，等待激活');
              showToast('新版本已就绪，刷新页面生效');
            }
          });
        });
        
        // 当新 SW 控制页面后刷新
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!refreshing) {
            refreshing = true;
            window.location.reload();
          }
        });
      })
      .catch(err => console.log('Service Worker 注册失败:', err));
  }
});
