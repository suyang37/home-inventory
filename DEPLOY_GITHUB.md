# GitHub Pages 部署指南

## 第一步：在 GitHub 上创建仓库

1. 打开 https://github.com 并登录你的账号
2. 点击右上角 **+** → **New repository**
3. 仓库名称填写：`home-inventory-miniapp`（或其他你喜欢的名字）
4. 选择 **Public**（公开仓库，GitHub Pages 免费需要公开）
5. 不要勾选任何初始化选项（README、.gitignore、license）
6. 点击 **Create repository**

## 第二步：上传文件

创建好仓库后，你会看到一个上传文件的页面：

1. 点击 **uploading an existing file** 链接
2. 将 `pwa` 文件夹下的 **所有文件和文件夹** 拖拽到上传区域：
   - `index.html`
   - `manifest.json`
   - `sw.js`
   - `css/` 文件夹
   - `icons/` 文件夹
   - `js/` 文件夹
3. 在页面底部填写提交信息：`Initial commit - 家庭物品管理 PWA`
4. 点击 **Commit changes**

## 第三步：启用 GitHub Pages

1. 进入你刚创建的仓库页面
2. 点击顶部导航栏的 **Settings**
3. 在左侧菜单找到 **Pages**（在 "Code and automation" 部分）
4. 在 "Branch" 部分：
   - 选择分支：`main`（或 `master`）
   - 文件夹选择：`/ (root)`
   - 点击 **Save**
5. 等待 1-2 分钟，页面顶部会出现提示：
   > "Your site is live at `https://你的用户名.github.io/home-inventory-miniapp/`"

## 第四步：访问你的应用

- 用手机或电脑浏览器打开上面的链接
- 如果是手机，可以用 Safari/Chrome 的"添加到主屏幕"功能安装为 PWA
- 如果之前打开过旧版本，请先清除浏览器缓存或使用无痕模式打开

## 常见问题

### Q: 打开后页面空白怎么办？
A: 按 F12 打开开发者工具 → Console 看是否有报错。通常是缓存问题，按 Ctrl+F5 强制刷新。

### Q: 之前的数据还在吗？
A: 数据存储在浏览器的 localStorage 中，部署到新地址后数据不会自动迁移。如果需要保留旧数据：
1. 在旧版本中打开"我的"页面 → 导出数据备份
2. 在新版本中打开"我的"页面 → 导入数据备份

### Q: 如何更新代码？
A: 修改本地文件后，再次进入 GitHub 仓库页面，上传覆盖旧文件即可。GitHub Pages 会自动更新（通常 1-2 分钟生效）。
