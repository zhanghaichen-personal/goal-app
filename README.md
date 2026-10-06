# Goal Matrix Web

这是 Goal Matrix 的第一版正式网站项目。

## 已实现

- Current Goal
- 长期 Goal / 有截止日期 Goal
- 四象限任务
- Deadline 自动进入紧急区
- 长期 Task 不自动变紧急
- Important / 手动紧急覆盖
- 已完成任务留在当前 Goal 下方
- 已完成 Goal 历史
- 浏览器本地自动保存
- Supabase 邮箱 Magic Link 登录
- 登录后云端同步
- Supabase RLS：每个用户只能访问自己的 Goal / Task

## 1. 建 Supabase

在 Supabase 创建项目，然后打开 SQL Editor，把 `supabase/schema.sql` 整段运行。

在 Project Settings / API 中复制：
- Project URL
- Publishable key

## 2. 设置环境变量

复制 `.env.example` 为 `.env.local`：

```env
NEXT_PUBLIC_SUPABASE_URL=你的 Project URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=你的 Publishable key
```

## 3. 本地运行（以后有电脑时）

```bash
npm install
npm run dev
```

## 4. 部署

推荐部署到 Vercel，并在 Vercel 项目设置里添加上面两个环境变量。

## 数据安全

数据库已开启 Row Level Security。`goals` 和 `tasks` 都要求登录，且 RLS 使用 `auth.uid() = user_id` 限制每个用户只能操作自己的数据。

## iPhone 使用方式

部署成功后：
1. Safari 打开网址
2. 登录邮箱
3. 分享按钮
4. “添加到主屏幕”

目前这是 website / web app 版本，不是原生 iOS Widget 版本。
