# 洛颖的主题乐园：GitHub 与跨 GPT 维护指南

## 当前交付状态
这是现有网站源码的 GitHub 就绪包，不代表已经推送到 GitHub。尚需目标账号、仓库与授权。个人照片未提供，照片墙仍含占位图；分场景音乐尚未实施。

## 推荐方案
将 GitHub 仓库作为唯一源码版本，以 GitHub Pages 展示静态网站。其他 GPT 用于提出修改或生成补丁，不作为唯一源码存储。先建私有仓库核对内容与素材授权，再决定公开；Pages 可用性取决于账号套餐及仓库可见性。

网站包含姓名、邮箱、实习信息与外链；公开前审阅 park-content.js。公司内部链接在公网可能无法访问。保留原项目 LICENSE 与来源致谢；代码许可证不自动覆盖照片、字体、音乐的授权。

## 文件分工
- park-content.js：中英个人介绍、实习、项目、照片数据、Dolly 文案与部分界面文字。
- index.html：页面结构、样式、初始界面及启动容错。
- src/park-app.js：可编辑的 Three.js 场景、镜头、点击、面板与音效逻辑。
- park-app.bundle.js：构建输出，不直接手改。
- vendor/three：固定版本的 Three.js 与依赖。
- assets：图片等素材。

## 本地运行与构建
安装 Node.js 后：
```bash
npm install
npm run build
npm run preview
```
访问 http://localhost:8000/index.html?lang=zh&lite3d=1 。预览命令需要 Python 3。
英文用 lang=en；lite3d=1 是已有兼容 3D 模式。不要删除此参数支持。

## 首次上传 GitHub
1. 登录自己的 GitHub，新建仓库，例如 luoying-theme-park。公开前先检查个人资料、公司材料与照片授权。
2. 解压本包，上传其中所有文件和目录，保持 index.html 在仓库根目录，不能多套一层目录。
3. 在仓库 Settings → Pages，选择 Deploy from a branch，分支 main、目录 / (root)，保存。菜单可能随 GitHub 更新变化。
4. 等待部署完成，以 Pages 页面实际显示的地址为准。不要自行猜测已经成功。
5. 后续修改 src/park-app.js 后运行 npm run build，再提交源文件和新 bundle。只改内容层通常无需构建。

也可在自己电脑使用 git init、git add、git commit 后，按新仓库页面提供的命令推送。不要把 token、Cookie、公司登录文件交给 GPT 或提交到仓库。

## 在其他 GPT 中修改
推荐每次上传当前仓库 ZIP（GitHub Code → Download ZIP），附具体修改要求。支持 GitHub 授权的开发工具可在你的授权下创建分支/PR；普通聊天 GPT 不应声称能自动写回仓库。
要求交付：变更文件清单、补丁或完整改后文件、构建结果与测试说明。每次只合并一个明确需求，检查后再更新 main。

### 可直接复制的交接提示词
你正在维护我的个人网站“洛颖的主题乐园”。以我本次上传的源码为唯一基线，不要用旧聊天中的代码覆盖。它是静态 HTML + Three.js 0.160 + 外置内容层，源程序 src/park-app.js 用 esbuild 打包为 park-app.bundle.js。保留原有3D建筑、布局、镜头、导航、双语与 lite3d=1 兼容模式；未经我确认，不重写技术栈，不用CSS伪3D或文字页替代园区。文案优先改 park-content.js；结构样式改 index.html；3D交互改 src/park-app.js 并重新构建。生成文件不得只改 bundle 而不改源文件。未知个人事实不要编造，占位图不得说成本人照片。照片墙使用现有美术馆，不另建场景；分场景音乐尚未完成。请先解释需求涉及哪些文件，再最小化修改；交付补丁/完整文件、构建结果和测试步骤。无法运行WebGL时明确说明，不能用语法通过代替3D验收。本次要求是：【填写具体需求】。

## 每次验收
- 中文、英文内容一致，页面无语法或资源404错误。
- 默认与 lite3d=1 均测试，真实看到园区才算3D验收。
- 地图、景点、Dolly、照片放大关闭、手机布局可用。
- 检查世界足迹外链的公网可访问性。
- Git 提交保留；有问题回退上一个提交，不覆盖唯一备份。
