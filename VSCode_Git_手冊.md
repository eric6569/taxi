# VS Code + GitHub 操作手冊

適用環境：Windows 11 / VS Code / GitHub

---

## 1. 帳號登入與驗證

### 1.1 確認本機 Git 身份設定
```bash
git config --global user.name
git config --global user.email
```
這只是 commit 時顯示的名字/信箱，**不代表**有登入權限。

### 1.2 確認 GitHub CLI 登入狀態（推薦，最直接）
```bash
gh auth status
```
會顯示目前登入帳號、使用協定（HTTPS/SSH）、token 權限範圍。

### 1.3 測試 SSH 連線（若用 SSH 金鑰方式）
```bash
ssh -T git@github.com
```
成功會回：`Hi <帳號>! You've successfully authenticated...`

### 1.4 VS Code 內登入
Source Control 面板 → **Publish to GitHub** 第一次點擊時會跳瀏覽器要求授權登入，完成後 VS Code 會記住。

---

## 2. Remote（遠端 Repo）設定

### 2.1 本機 repo 位置
`git init` 會在**目前所在資料夾**建立 `.git` 隱藏資料夾，這就是本機 repo 本體，沒有其他預設路徑。

### 2.2 手動指定遠端網址
```bash
git remote add origin https://github.com/帳號/repo名稱.git
git branch -M main
git push -u origin main
```
`-u` 會把本機 `main` 跟遠端 `origin/main` 綁定，之後 `git push` 不用再打完整參數。

### 2.3 檢查目前綁定的遠端
```bash
git remote -v
```

### 2.4 GitHub 上還沒建 repo 時
**方法 A**：先在 GitHub 網站手動建立空 repo，複製網址後照 2.2 操作。

**方法 B**：用 GitHub CLI 一行完成（建立 + remote + push）
```bash
gh repo create repo名稱 --public --source=. --remote=origin --push
```

### 2.5 沒指定 remote 會怎樣？
不會有預設存放位置，`git push` 會直接報錯：
```
fatal: No configured push destination.
```

---

## 3. Commit 流程

### 3.1 VS Code Source Control 面板操作
1. 開啟 Source Control（`Ctrl+Shift+G`）
2. **首次使用**：按 **Initialize Repository**（只建立 `.git`，不影響現有檔案）
3. 檢查「Changes」清單，勾選要納入的檔案
4. 上方輸入框填寫 commit message
5. 按 `Ctrl+Enter` 或勾勾圖示完成 commit

### 3.2 Commit message 輸入建議（Copilot）
| 型態 | 特徵 | 採用方式 |
|---|---|---|
| Inline 預測文字 | 灰色半透明文字接在游標後 | 按 `Tab` |
| 下拉選單清單 | 跳出選項列表 | 方向鍵選 → `Enter`/`Tab` |
| 自動生成按鈕 | 輸入框右上角✨圖示 | 點擊自動根據改動內容生成 message |

### 3.3 建議先設定 `.gitignore`
避免上傳不該進版控的檔案：`node_modules/`、`.env`、編譯產物、金鑰等。Initialize Repository 時 VS Code 通常會提示是否建立。

---

## 4. Push 流程

### 4.1 基本 push
Source Control 面板按 **Sync Changes**（或 `...` 選單 → Push）

### 4.2 命令列
```bash
git push          # 已設定 upstream 的情況
git push -u origin main   # 第一次 push
```

---

## 5. 回到前一版本

| 做法 | 效果 | 風險 | 適合情境 |
|---|---|---|---|
| **Revert** | 新增一個 commit 反向抵銷改動，歷史保留 | 低，安全 | 已 push、多人協作 |
| **Reset** | 分支指標直接移回舊 commit，之後歷史消失 | 高，需強制推送 | 只有自己用、還沒 push |

### 5.1 VS Code 內建 Graph（無 Revert 選項）
命令選擇區（`Ctrl+Shift+P`）→ 輸入 `Git: Revert Commit` → 選擇要復原的 commit → 自動建立新 commit → 按 Sync Changes push。

### 5.2 命令列 Revert
```bash
git log --oneline                # 找到目標 commit hash
git revert <commit hash>
git push
```

### 5.3 危險操作：改寫歷史（謹慎使用）
```bash
git reset --hard <commit hash>
git push --force
```
`--force` 會覆蓋 GitHub 上的歷史，若有協作者會造成對方本機與遠端不一致，非必要不建議。

### 5.4 進階：Git Graph 擴充套件
Extensions 搜尋 `Git Graph`（作者 mhutchie）安裝後，右鍵 commit 有完整 Revert/Reset 選單，比內建 Graph 好用。

---

## 6. GitHub Pages（若有網頁需求）

1. 進入 `repo → Settings → Pages`
2. **Source** 設定：
   - Branch：`main`
   - Folder：`/ (root)` 或 `/docs`
3. 按 **Save**，等待 1～5 分鐘建置

**常見問題排查**：
| 問題 | 檢查點 |
|---|---|
| repo 是 Private | 免費帳號 Pages 只支援 Public repo |
| 找不到 `index.html` | 檔名須小寫，且放對資料夾 |
| 分支不符 | push 分支需與 Pages Source 設定一致 |
| 剛設定完打不開 | 建置有延遲，稍等即可 |

---

## 7. 常用指令速查

```bash
# 身份與登入
git config --global user.name
git config --global user.email
gh auth status
ssh -T git@github.com

# Remote
git remote -v
git remote add origin <URL>

# Commit / Push
git add .
git commit -m "訊息"
git push -u origin main

# 回到前一版
git log --oneline
git revert <hash>
git reset --hard <hash>   # 危險，會改寫歷史
```
