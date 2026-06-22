# GitHub Pages 部署指南

## 前提条件

- 一个 GitHub 账号（免费）
- 项目文件位于 `d:/Roo/home-inventory-miniapp/pwa/` 目录下

---

## 首次部署

### 第一步：在 GitHub 上创建仓库

1. 打开 [https://github.com](https://github.com) 并登录你的账号
2. 点击右上角 **+** → **New repository**
3. 仓库名称填写：`home-inventory`（或其他你喜欢的名字）
4. 选择 **Public**（公开仓库，GitHub Pages 免费需要公开）
5. 不要勾选任何初始化选项（README、.gitignore、license）
6. 点击 **Create repository**

### 第二步：上传文件

创建好仓库后，你会看到一个上传文件的页面：

1. 点击 **uploading an existing file** 链接
2. 将 `pwa` 文件夹下的 **所有文件和文件夹** 拖拽到上传区域：

   ```
   index.html
   manifest.json
   sw.js
   README.md
   css/
   ├── style.css
   icons/
   ├── icon-192.png
   └── icon-512.png
   js/
   ├── app.js
   ├── constants.js
   ├── db.js
   ├── family.js
   ├── sync.js
   └── util.js
   ```

3. 在页面底部填写提交信息：`Initial commit - 家庭物品管理 PWA`
4. 点击 **Commit changes**

### 第三步：启用 GitHub Pages

1. 进入你刚创建的仓库页面
2. 点击顶部导航栏的 **Settings**
3. 在左侧菜单找到 **Pages**（在 "Code and automation" 部分）
4. 在 "Branch" 部分：
   - 选择分支：`main`（或 `master`）
   - 文件夹选择：`/ (root)`
   - 点击 **Save**
5. 等待 1-2 分钟，页面顶部会出现提示：
   > "Your site is live at `https://你的用户名.github.io/home-inventory/`"

### 第四步：访问你的应用

- 用手机或电脑浏览器打开上面的链接
- 如果是手机，可以用 Safari/Chrome 的"添加到主屏幕"功能安装为 PWA
- 如果之前打开过旧版本，请先清除浏览器缓存或使用无痕模式打开

---

## 更新已有部署

如果你的应用已经在 GitHub Pages 上运行，需要更新到最新版本：

### 方法一：通过 GitHub 网页上传（推荐）

1. 打开你的 GitHub 仓库页面：`https://github.com/你的用户名/home-inventory`
2. 点击 **Add file** → **Upload files**
3. 将 `pwa` 文件夹下的 **所有文件和文件夹** 拖拽到上传区域，覆盖旧文件
4. 填写提交信息：`Update to v4.0 - 新增云端同步、家庭共享`
5. 点击 **Commit changes**
6. 等待 1-2 分钟，GitHub Pages 自动更新

### 方法二：通过 Git 命令行

```bash
# 克隆仓库（如果还没有本地仓库）
git clone https://github.com/你的用户名/home-inventory.git
cd home-inventory

# 复制 pwa 目录下的所有文件到仓库根目录
# （将 d:/Roo/home-inventory-miniapp/pwa/ 下的文件复制到当前目录）

# 添加所有更改
git add .

# 提交
git commit -m "Update to v4.0 - 新增云端同步、家庭共享"

# 推送到 GitHub
git push
```

---

## 常见问题

### Q: 打开后页面空白怎么办？
A: 按 F12 打开开发者工具 → Console 看是否有报错。通常是缓存问题：
- 按 **Ctrl+F5** 强制刷新
- 或在浏览器设置中清除该网站的缓存和数据
- 或使用无痕模式打开

### Q: 之前的数据还在吗？
A: 数据存储在浏览器的 **localStorage** 中，部署到新地址后数据不会自动迁移。如果需要保留旧数据：
1. 在旧版本中打开 **我的** → **导出数据** 下载备份文件
2. 在新版本中打开 **我的** → **导入数据** 恢复备份

### Q: 如何保留旧数据并迁移到新版本？
A: 如果新旧版本在同一个域名下（如都是 `suyang37.github.io/home-inventory`），数据会自动保留。如果域名变了，请使用导出/导入功能。

### Q: 更新后功能没有变化？
A: 可能是 Service Worker 缓存了旧版本。尝试：
1. 在浏览器开发者工具 → Application → Service Workers 中点击 **Unregister**
2. 然后按 Ctrl+F5 强制刷新
3. 或者清除浏览器所有缓存数据

### Q: 如何确认更新成功？
A: 打开浏览器开发者工具 → Console，查看输出的版本信息。或者在"我的"页面底部查看版本号。
