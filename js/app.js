/**
 * 家庭物品管理 - PWA 主应用
 * SPA 路由 + 所有页面逻辑
 */

// ========================================
// SPA 路由
// ========================================
const Router = {
  currentPage: 'index',
  stack: [],

  init() {
    window.addEventListener('hashchange', () => this.handleRoute());
    this.handleRoute();
  },

  handleRoute() {
    const hash = window.location.hash.slice(1) || 'index';
    this.navigate(hash, false);
  },

  navigate(page, pushState = true) {
    if (pushState) {
      window.location.hash = page;
      return;
    }

    // 隐藏所有页面
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    
    // 解析页面ID（支持动态ID如 product-detail-xxx）
    const basePage = page.split('-').slice(0, 2).join('-');
    const isDynamic = page !== basePage;
    
    // 查找页面元素 - 先精确匹配，再尝试基础页面
    let target = document.getElementById(`page-${page}`);
    if (!target && isDynamic) {
      target = document.getElementById(`page-${basePage}`);
    }
    
    if (target) {
      target.classList.add('active');
      this.currentPage = page;
      
      // 调用页面初始化函数
      const handlerName = isDynamic ? basePage : page;
      const initFn = PageHandlers[handlerName];
      if (initFn) initFn();
    }

    // 更新 Tab 高亮
    this.updateTab(basePage);
  },

  updateTab(basePage) {
    const tabPages = ['index', 'products', 'product-add', 'locations', 'search', 'mine'];
    document.querySelectorAll('.tab-item').forEach(tab => {
      const tabPage = tab.dataset.page;
      if (tabPage === basePage || tabPage === basePage.replace('product-', '')) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
  },

  goBack() {
    window.history.back();
  }
};

// ========================================
// 页面处理器
// ========================================
const PageHandlers = {};

// ========================================
// 首页 - 过期概览仪表盘
// ========================================
PageHandlers.index = async function() {
  const products = (await db.collection(DB.PRODUCTS).get()).data;
  
  // 排除已丢弃的物品
  const activeProducts = products.filter(p => p.status !== 'disposed');
  const total = activeProducts.length;
  const normal = activeProducts.filter(p => {
    const info = getExpiryInfo(p.expiryDate);
    return info.status === 'normal';
  }).length;
  const expiring = activeProducts.filter(p => {
    const info = getExpiryInfo(p.expiryDate);
    return info.status === 'expiring';
  }).length;
  const expired = activeProducts.filter(p => {
    const info = getExpiryInfo(p.expiryDate);
    return info.status === 'expired';
  }).length;

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statNormal').textContent = normal;
  document.getElementById('statExpiring').textContent = expiring;
  document.getElementById('statExpired').textContent = expired;

  // 即将过期列表
  const expiringList = document.getElementById('expiringList');
  const soonExpire = products
    .filter(p => {
      const info = getExpiryInfo(p.expiryDate);
      return info.status === 'expiring' && p.status !== 'disposed';
    })
    .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate))
    .slice(0, 10);

  if (soonExpire.length === 0) {
    expiringList.innerHTML = '<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-text">没有即将过期的物品</div></div>';
  } else {
    expiringList.innerHTML = soonExpire.map(p => {
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
};

// ========================================
// 商品列表
// ========================================
PageHandlers.products = async function() {
  const list = document.getElementById('productList');
  const products = (await db.collection(DB.PRODUCTS).orderBy('updatedAt', 'desc').get()).data;

  if (products.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">📦</div><div class="empty-text">还没有商品，点击下方 + 添加</div></div>';
    return;
  }

  list.innerHTML = products.map(p => {
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
};

// ========================================
// 商品录入
// ========================================
PageHandlers['product-add'] = function() {
  // 重置表单
  document.getElementById('addForm').reset();
  document.getElementById('addImagePreview').style.display = 'none';
  document.getElementById('addImageData').value = '';
  document.getElementById('addOcrResult').style.display = 'none';
  
  // 填充分类选项
  renderCategoryGrid('addCategoryGrid', null);
  
  // 填充位置选项
  renderLocationSelect('addLocation');
  
  // 填充保质期单位
  const unitSelect = document.getElementById('addShelfLifeUnit');
  unitSelect.innerHTML = SHELF_LIFE_UNITS.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
};

// 拍照/选择图片
async function takePhoto() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.capture = 'environment';
  
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      
      // 显示预览
      const preview = document.getElementById('addImagePreview');
      preview.querySelector('img').src = dataUrl;
      preview.style.display = 'block';
      document.getElementById('addImageData').value = dataUrl;
      
      // 模拟OCR识别
      showLoading('正在识别...');
      await new Promise(r => setTimeout(r, 1500));
      hideLoading();
      
      // 模拟识别结果
      const mockNames = ['纯牛奶', '酱油', '饼干', '洗发水', '牙膏', '方便面', '矿泉水', '纸巾'];
      const mockName = mockNames[Math.floor(Math.random() * mockNames.length)];
      
      document.getElementById('addName').value = mockName;
      
      // 显示OCR结果
      document.getElementById('addOcrResult').innerHTML = `
        <div style="padding:8px 12px;background:#e8f5e9;border-radius:8px;font-size:13px;color:#2e7d32;margin-bottom:12px">
          📷 已识别商品名称：${mockName}
        </div>
      `;
      document.getElementById('addOcrResult').style.display = 'block';
      
      showToast('识别完成，请确认信息');
    };
    reader.readAsDataURL(file);
  };
  
  input.click();
}

// 提交商品
async function submitProduct() {
  const name = document.getElementById('addName').value.trim();
  const category = document.querySelector('#addCategoryGrid .selected')?.dataset?.id || 'other';
  const locationId = document.getElementById('addLocation').value;
  const locationName = document.getElementById('addLocation').selectedOptions[0]?.text || '';
  const quantity = parseInt(document.getElementById('addQuantity').value) || 1;
  const productionDate = document.getElementById('addProductionDate').value;
  const shelfLife = parseInt(document.getElementById('addShelfLife').value);
  const shelfLifeUnit = document.getElementById('addShelfLifeUnit').value;
  const expiryDate = document.getElementById('addExpiryDate').value;
  const notes = document.getElementById('addNotes').value.trim();
  const imageData = document.getElementById('addImageData').value;

  if (!name) {
    showToast('请输入商品名称', 'error');
    return;
  }

  let finalExpiryDate = expiryDate;
  if (!finalExpiryDate && productionDate && shelfLife) {
    finalExpiryDate = calculateExpiryDate(productionDate, shelfLife, shelfLifeUnit);
  }

  if (!finalExpiryDate) {
    showToast('请填写过期日期或生产日期+保质期', 'error');
    return;
  }

  const productData = {
    name,
    category,
    locationId: locationId || '',
    locationName,
    quantity,
    productionDate: productionDate || '',
    shelfLife: shelfLife || 0,
    shelfLifeUnit: shelfLifeUnit || 'days',
    expiryDate: finalExpiryDate,
    notes,
    image: imageData || '',
    status: 'normal'
  };

  showLoading('正在保存...');
  await db.collection(DB.PRODUCTS).add({ data: productData });
  hideLoading();

  showToast('添加成功');
  setTimeout(() => Router.navigate('products'), 500);
}

// ========================================
// 商品详情
// ========================================
PageHandlers['product-detail'] = async function() {
  const id = Router.currentPage.replace('product-detail-', '');
  if (!id) return;
  
  const result = await db.collection(DB.PRODUCTS).doc(id).get();
  const p = result.data;
  if (!p) {
    showToast('商品不存在', 'error');
    Router.navigate('products');
    return;
  }

  const info = getExpiryInfo(p.expiryDate);
  const cat = CATEGORIES.find(c => c.id === p.category) || CATEGORIES[CATEGORIES.length - 1];

  document.getElementById('detailHeader').textContent = p.name;
  document.getElementById('detailContent').innerHTML = `
    ${p.image ? `<img src="${p.image}" class="detail-image" alt="${p.name}" />` : ''}
    <div class="detail-field">
      <span class="detail-label">名称</span>
      <span class="detail-value">${p.name}</span>
    </div>
    <div class="detail-field">
      <span class="detail-label">分类</span>
      <span class="detail-value">${cat.icon} ${cat.name}</span>
    </div>
    <div class="detail-field">
      <span class="detail-label">位置</span>
      <span class="detail-value">${p.locationName || '未设置'}</span>
    </div>
    <div class="detail-field">
      <span class="detail-label">数量</span>
      <span class="detail-value">${p.quantity}</span>
    </div>
    <div class="detail-field">
      <span class="detail-label">生产日期</span>
      <span class="detail-value">${p.productionDate ? formatDateCN(p.productionDate) : '未知'}</span>
    </div>
    <div class="detail-field">
      <span class="detail-label">保质期</span>
      <span class="detail-value">${p.shelfLife ? `${p.shelfLife}${SHELF_LIFE_UNITS.find(u => u.id === p.shelfLifeUnit)?.name || '天'}` : '未知'}</span>
    </div>
    <div class="detail-field">
      <span class="detail-label">过期日期</span>
      <span class="detail-value">${formatDateCN(p.expiryDate)}</span>
    </div>
    <div class="detail-field">
      <span class="detail-label">状态</span>
      <span class="detail-value"><span class="tag ${EXPIRY_STATUS_CLASS[info.status]}">${info.text}</span></span>
    </div>
    ${p.notes ? `
    <div class="detail-field">
      <span class="detail-label">备注</span>
      <span class="detail-value">${p.notes}</span>
    </div>` : ''}
    <div class="detail-field">
      <span class="detail-label">创建时间</span>
      <span class="detail-value">${formatDateTime(p.createdAt)}</span>
    </div>
  `;

  // 操作按钮
  document.getElementById('detailActions').innerHTML = `
    <button class="btn btn-secondary" onclick="Router.navigate('product-edit-${p._id}')">✏️ 编辑</button>
    <button class="btn btn-danger" onclick="deleteProduct('${p._id}')">🗑️ 删除</button>
  `;
};

// 删除商品
async function deleteProduct(id) {
  const confirmed = await showConfirm('确认删除', '确定要删除这个商品吗？');
  if (!confirmed) return;
  
  showLoading('正在删除...');
  await db.collection(DB.PRODUCTS).doc(id).remove();
  hideLoading();
  
  showToast('删除成功');
  Router.navigate('products');
}

// ========================================
// 商品编辑
// ========================================
PageHandlers['product-edit'] = async function() {
  const id = Router.currentPage.replace('product-edit-', '');
  if (!id) return;
  
  const result = await db.collection(DB.PRODUCTS).doc(id).get();
  const p = result.data;
  if (!p) {
    showToast('商品不存在', 'error');
    Router.navigate('products');
    return;
  }

  document.getElementById('editHeader').textContent = `编辑 - ${p.name}`;
  document.getElementById('editForm').dataset.id = id;
  document.getElementById('editName').value = p.name;
  document.getElementById('editQuantity').value = p.quantity;
  document.getElementById('editProductionDate').value = p.productionDate || '';
  document.getElementById('editShelfLife').value = p.shelfLife || '';
  document.getElementById('editShelfLifeUnit').value = p.shelfLifeUnit || 'days';
  document.getElementById('editExpiryDate').value = p.expiryDate || '';
  document.getElementById('editNotes').value = p.notes || '';
  
  renderCategoryGrid('editCategoryGrid', p.category);
  renderLocationSelect('editLocation', p.locationId);
  
  const unitSelect = document.getElementById('editShelfLifeUnit');
  unitSelect.innerHTML = SHELF_LIFE_UNITS.map(u => `<option value="${u.id}" ${u.id === p.shelfLifeUnit ? 'selected' : ''}>${u.name}</option>`).join('');
};

// 提交编辑
async function submitEdit() {
  const id = document.getElementById('editForm').dataset.id;
  const name = document.getElementById('editName').value.trim();
  const category = document.querySelector('#editCategoryGrid .selected')?.dataset?.id || 'other';
  const locationId = document.getElementById('editLocation').value;
  const locationName = document.getElementById('editLocation').selectedOptions[0]?.text || '';
  const quantity = parseInt(document.getElementById('editQuantity').value) || 1;
  const productionDate = document.getElementById('editProductionDate').value;
  const shelfLife = parseInt(document.getElementById('editShelfLife').value);
  const shelfLifeUnit = document.getElementById('editShelfLifeUnit').value;
  const expiryDate = document.getElementById('editExpiryDate').value;
  const notes = document.getElementById('editNotes').value.trim();

  if (!name) {
    showToast('请输入商品名称', 'error');
    return;
  }

  let finalExpiryDate = expiryDate;
  if (!finalExpiryDate && productionDate && shelfLife) {
    finalExpiryDate = calculateExpiryDate(productionDate, shelfLife, shelfLifeUnit);
  }

  if (!finalExpiryDate) {
    showToast('请填写过期日期', 'error');
    return;
  }

  showLoading('正在保存...');
  await db.collection(DB.PRODUCTS).doc(id).update({
    data: {
      name, category, locationId, locationName,
      quantity, productionDate, shelfLife, shelfLifeUnit,
      expiryDate: finalExpiryDate, notes
    }
  });
  hideLoading();

  showToast('保存成功');
  Router.navigate(`product-detail-${id}`);
}

// ========================================
// 位置管理
// ========================================
PageHandlers.locations = async function() {
  await renderLocationTree();
};

async function renderLocationTree() {
  const container = document.getElementById('locationTree');
  const locations = (await db.collection(DB.LOCATIONS).get()).data;
  const products = (await db.collection(DB.PRODUCTS).get()).data;

  if (locations.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">🏠</div><div class="empty-text">还没有位置，点击下方 + 添加</div></div>';
    return;
  }

  // 构建树
  const rootLocations = locations.filter(l => !l.parentId);
  
  container.innerHTML = rootLocations.map(l => renderTreeNode(l, locations, products)).join('');
}

function renderTreeNode(node, allLocations, products) {
  const children = allLocations.filter(l => l.parentId === node._id);
  const itemCount = products.filter(p => p.locationId === node._id).length;
  const hasChildren = children.length > 0;

  return `
    <li class="tree-item">
      <div class="tree-item-content" onclick="Router.navigate('location-detail-${node._id}')">
        ${hasChildren ? '<span class="tree-toggle" onclick="event.stopPropagation();toggleTree(this)">▶</span>' : '<span class="tree-toggle" style="visibility:hidden">▶</span>'}
        <span class="tree-icon">📂</span>
        <span class="tree-name">${node.name}</span>
        <span class="tree-count">${itemCount}件</span>
      </div>
      ${hasChildren ? `
        <ul class="tree-children">
          ${children.map(c => renderTreeNode(c, allLocations, products)).join('')}
        </ul>
      ` : ''}
    </li>
  `;
}

function toggleTree(el) {
  el.classList.toggle('expanded');
  const children = el.closest('.tree-item').querySelector('.tree-children');
  if (children) children.classList.toggle('expanded');
}

// ========================================
// 位置详情
// ========================================
PageHandlers['location-detail'] = async function() {
  const id = Router.currentPage.replace('location-detail-', '');
  if (!id) return;

  const locResult = await db.collection(DB.LOCATIONS).doc(id).get();
  const location = locResult.data;
  if (!location) {
    showToast('位置不存在', 'error');
    Router.navigate('locations');
    return;
  }

  document.getElementById('locDetailHeader').textContent = location.name;

  // 子位置
  const allLocations = (await db.collection(DB.LOCATIONS).get()).data;
  const children = allLocations.filter(l => l.parentId === id);
  
  const childrenHtml = children.length > 0
    ? children.map(c => `
      <div class="product-item" onclick="Router.navigate('location-detail-${c._id}')">
        <div class="product-icon">📂</div>
        <div class="product-info">
          <div class="product-name">${c.name}</div>
        </div>
        <div class="product-right">➡️</div>
      </div>
    `).join('')
    : '<div class="empty-state"><div class="empty-text" style="padding:16px">暂无子位置</div></div>';

  document.getElementById('locChildren').innerHTML = childrenHtml;

  // 位置中的商品
  const products = (await db.collection(DB.PRODUCTS).where({ locationId: id }).get()).data;
  
  const productsHtml = products.length > 0
    ? products.map(p => {
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
// 搜索
// ========================================
PageHandlers.search = function() {
  document.getElementById('searchInput').value = '';
  document.getElementById('searchResults').innerHTML = '';
  renderSearchHistory();
};

// 搜索商品
const doSearch = debounce(async function() {
  const keyword = document.getElementById('searchInput').value.trim();
  if (!keyword) {
    document.getElementById('searchResults').innerHTML = '';
    return;
  }

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
    document.getElementById('searchResults').innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-text">未找到匹配的商品</div></div>';
  } else {
    document.getElementById('searchResults').innerHTML = results.map(p => {
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

  document.getElementById('searchHistory').style.display = 'none';
}, 300);

function highlightKeyword(text, keyword) {
  if (!text || !keyword) return text || '';
  const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<strong style="color:var(--primary)">$1</strong>');
}

function saveSearchHistory(keyword) {
  let history = JSON.parse(localStorage.getItem('search_history') || '[]');
  history = history.filter(h => h !== keyword);
  history.unshift(keyword);
  if (history.length > 10) history = history.slice(0, 10);
  localStorage.setItem('search_history', JSON.stringify(history));
  renderSearchHistory();
}

function renderSearchHistory() {
  const history = JSON.parse(localStorage.getItem('search_history') || '[]');
  const container = document.getElementById('searchHistoryTags');
  
  if (history.length === 0) {
    document.getElementById('searchHistory').style.display = 'none';
    return;
  }

  document.getElementById('searchHistory').style.display = 'block';
  container.innerHTML = history.map(h => `
    <span class="history-tag" onclick="document.getElementById('searchInput').value='${h.replace(/'/g, "\\'")}';doSearch()">
      ${h}
      <button class="remove-btn" onclick="event.stopPropagation();removeSearchHistory('${h.replace(/'/g, "\\'")}')">×</button>
    </span>
  `).join('');
}

function removeSearchHistory(keyword) {
  let history = JSON.parse(localStorage.getItem('search_history') || '[]');
  history = history.filter(h => h !== keyword);
  localStorage.setItem('search_history', JSON.stringify(history));
  renderSearchHistory();
}

function clearSearchHistory() {
  localStorage.removeItem('search_history');
  renderSearchHistory();
}

// ========================================
// 个人中心
// ========================================
PageHandlers.mine = async function() {
  const products = (await db.collection(DB.PRODUCTS).get()).data;
  const locations = (await db.collection(DB.LOCATIONS).get()).data;
  
  document.getElementById('mineStats').innerHTML = `
    <div style="display:flex;justify-content:space-around;padding:16px 0">
      <div style="text-align:center">
        <div style="font-size:24px;font-weight:700;color:var(--primary)">${products.length}</div>
        <div style="font-size:12px;color:var(--text-light)">商品</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:24px;font-weight:700;color:var(--warning)">${locations.length}</div>
        <div style="font-size:12px;color:var(--text-light)">位置</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:24px;font-weight:700;color:var(--danger)">${products.filter(p => { const i = getExpiryInfo(p.expiryDate); return i.status === 'expired'; }).length}</div>
        <div style="font-size:12px;color:var(--text-light)">已过期</div>
      </div>
    </div>
  `;
};

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
  a.href = url;
  a.download = `家庭物品管理_备份_${formatDate(new Date())}.json`;
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
  
  let html = '<option value="">未选择位置</option>';
  html += buildLocationOptions(locations, null, 0, selectedId);
  select.innerHTML = html;
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
