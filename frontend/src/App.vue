<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import LoginView from './components/LoginView.vue'
import AdminDataPage from './components/AdminDataPage.vue'
import NavIcon from './components/NavIcon.vue'
import { adminGet, clearToken, getToken, validateAdminSession } from './api'
import type { AdminSettings } from './types'

type MenuItem = { id: string; key: string; icon: string; section: string }

const menuItems: MenuItem[] = [
  { id: 'dashboard', key: 'dashboard', icon: 'dashboard', section: 'overview' },
  { id: 'users', key: 'userManagement', icon: 'users', section: 'users' },
  { id: 'tickets', key: 'ticketManagement', icon: 'ticket', section: 'users' },
  { id: 'orders', key: 'orderManagement', icon: 'receipt', section: 'subscriptions' },
  { id: 'plans', key: 'planManagement', icon: 'package', section: 'subscriptions' },
  { id: 'subscriptions', key: 'subscriptionManagement', icon: 'refresh', section: 'subscriptions' },
  { id: 'coupons', key: 'couponManagement', icon: 'ticketPercent', section: 'subscriptions' },
  { id: 'gift-cards', key: 'giftCardManagement', icon: 'gift', section: 'subscriptions' },
  { id: 'nodes', key: 'nodeManagement', icon: 'network', section: 'infrastructure' },
  { id: 'machines', key: 'machineManagement', icon: 'server', section: 'infrastructure' },
  { id: 'groups', key: 'permissionGroupManagement', icon: 'users', section: 'infrastructure' },
  { id: 'routes', key: 'routeManagement', icon: 'network', section: 'infrastructure' },
  { id: 'settings', key: 'systemConfig', icon: 'settings', section: 'system' },
  { id: 'plugins', key: 'pluginManagement', icon: 'puzzle', section: 'system' },
  { id: 'themes', key: 'themeConfig', icon: 'contrast', section: 'system' },
  { id: 'notices', key: 'noticeManagement', icon: 'bell', section: 'system' },
  { id: 'payments', key: 'paymentConfig', icon: 'card', section: 'system' },
  { id: 'knowledge', key: 'knowledgeManagement', icon: 'book', section: 'system' },
  { id: 'plugin-apps', key: 'pluginApps', icon: 'blocks', section: 'system' },
  { id: 'system-status', key: 'systemStatus', icon: 'activity', section: 'system' },
  { id: 'audit-logs', key: 'auditLogs', icon: 'file', section: 'system' },
  { id: 'failed-jobs', key: 'failedJobs', icon: 'alert', section: 'system' },
  { id: 'mail-templates', key: 'mailTemplates', icon: 'mail', section: 'system' },
  { id: 'traffic', key: 'trafficResetLogs', icon: 'chart', section: 'users' },
]

const locale = ref<'zh-CN' | 'en-US'>('zh-CN')
const activeId = ref('dashboard')
const search = ref('')
const sidebarOpen = ref(true)
const expandedSections = ref(new Set(['system', 'infrastructure', 'subscriptions', 'users']))
const darkMode = ref(false)
const settings: AdminSettings = window.settings ?? {}
const authState = ref<'checking' | 'anonymous' | 'authenticated'>('checking')
const dashboardStats = ref<Record<string, unknown>>({})
const chartData = ref<Array<{ date: string; value: number }>>([])
const trafficRanks = ref<{ node: Array<Record<string, unknown>>; user: Array<Record<string, unknown>> }>({ node: [], user: [] })
const queueStats = ref<Record<string, unknown>>({})
const queueWorkload = ref<Array<Record<string, unknown>>>([])
const dashboardError = ref('')
const chartDays = ref(14)
const visibleChartData = computed(() => chartData.value.slice(-chartDays.value))
const title = computed(() => settings.title || 'BitPanel')
const strings = computed(() => window.XBOARD_TRANSLATIONS?.[locale.value] ?? {})
const newMenuLabels: Record<string, Record<'zh-CN' | 'en-US', string>> = {
  'system-status': { 'zh-CN': '系统状态', 'en-US': 'System Status' },
  'audit-logs': { 'zh-CN': '操作日志', 'en-US': 'Audit Logs' },
  'failed-jobs': { 'zh-CN': '失败任务', 'en-US': 'Failed Jobs' },
  'mail-templates': { 'zh-CN': '邮件模板', 'en-US': 'Mail Templates' },
}
const menuText = (item: MenuItem) => translate(`nav.${item.key}`, newMenuLabels[item.id]?.[locale.value] ?? item.key)
const activeItem = computed(() => menuItems.find((item) => item.id === activeId.value) ?? menuItems[0]!)
const activeTitle = computed(() => menuText(activeItem.value))
const visibleItems = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  return menuItems.filter((item) => !query || menuText(item).toLocaleLowerCase().includes(query))
})
const sections = [
  { id: 'overview', key: 'dashboard', label: '工作台' },
  { id: 'system', key: 'systemManagement', label: '系统管理' },
  { id: 'infrastructure', key: 'nodeManagement', label: '节点管理' },
  { id: 'subscriptions', key: 'subscriptionManagement', label: '订阅管理' },
  { id: 'users', key: 'userManagement', label: '用户管理' },
]
const pageDescriptions: Record<string, string> = {
  settings: '管理系统核心配置，包括站点、安全、订阅、邀请佣金、节点、邮件和通知等设置',
  plugins: '浏览、安装和管理扩展插件，以及配置插件运行参数',
  themes: '上传和配置用户端主题，设置主题样式与显示选项',
  notices: '在这里可以配置公告，包括添加、删除、编辑等操作',
  payments: '在这里可以配置支付方式，包括支付宝、微信等',
  knowledge: '管理面向用户展示的帮助文档和知识库内容',
  machines: '用于查看服务器健康、负载与承载节点，并从运维视角快捷发起节点操作',
  nodes: '管理所有节点，包括添加、删除、编辑等操作',
  plans: '在这里可以配置订阅计划，包括添加、删除、编辑等操作',
  users: '在这里可以管理用户，包括增加、删除、编辑、查询等操作',
  orders: '查看订单记录和支付、佣金状态',
  tickets: '查看用户工单并进行回复和状态处理',
  'system-status': '查看定时任务、Horizon 队列服务状态',
  'audit-logs': '查看管理员操作记录与请求内容',
  'failed-jobs': '排查并查看 Horizon 失败任务',
  'mail-templates': '维护邮件主题和模板内容，测试发送或恢复默认模板',
}

function translate(path: string, fallback: string): string {
  const value = path.split('.').reduce<unknown>((node, key) => {
    if (node && typeof node === 'object') return (node as Record<string, unknown>)[key]
    return undefined
  }, strings.value)
  return typeof value === 'string' ? value : fallback
}

const sectionTitle = (id: string) => {
  const section = sections.find((item) => item.id === id)
  return section ? translate(`nav.${section.key}`, section.label) : ''
}
const toggleSection = (id: string) => {
  const next = new Set(expandedSections.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedSections.value = next
}
const refreshPage = () => loadDashboard()
const barHeight = (value: number) => {
  const maximum = Math.max(1, ...chartData.value.map((point) => Number(point.value) || 0))
  return `${Math.max(3, (Number(value) / maximum) * 100)}%`
}
function formatBytes(bytes: unknown): string {
  const value = Number(bytes)
  if (!Number.isFinite(value) || value <= 0) return '0 B'
  const units = ['B', 'KB', 'GB', 'TB']
  const rank = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  return `${(value / 1024 ** rank).toFixed(rank ? 2 : 0)} ${units[rank]}`
}
const rankWidth = (rank: Record<string, unknown>, list: Array<Record<string, unknown>>) => {
  const max = Math.max(1, ...list.map((item) => Number(item.value) || 0))
  return `${Math.max(2, Number(rank.value) / max * 100)}%`
}
const logout = () => { clearToken(); dashboardStats.value = {}; activeId.value = 'dashboard'; authState.value = 'anonymous' }
const handleUnauthorized = () => { dashboardStats.value = {}; authState.value = 'anonymous' }

async function loadDashboard() {
  dashboardError.value = ''
  try {
    const now = new Date()
    const chartStart = new Date(now)
    chartStart.setDate(now.getDate() - chartDays.value + 1)
    const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const startDate = localDate(chartStart)
    const endDate = localDate(now)
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000
    const endOfDay = now.getTime() / 1000
    const [response, orders] = await Promise.all([
      adminGet<{ data?: Record<string, unknown> }>(settings, 'stat/getStats'),
      adminGet<{ data?: { list?: Array<{ date: string; value: number }> } }>(settings, 'stat/getOrder', { start_date: startDate, end_date: endDate, type: 'paid_total' }),
    ])
    const [nodes, users, queue, workload] = await Promise.all([
      adminGet<{ data?: Array<Record<string, unknown>> }>(settings, 'stat/getTrafficRank', { type: 'node', start_time: startOfDay, end_time: endOfDay }).catch(() => null),
      adminGet<{ data?: Array<Record<string, unknown>> }>(settings, 'stat/getTrafficRank', { type: 'user', start_time: startOfDay, end_time: endOfDay }).catch(() => null),
      adminGet<Record<string, unknown>>(settings, 'system/getQueueStats').catch(() => null),
      adminGet<Array<Record<string, unknown>>>(settings, 'system/getQueueWorkload').catch(() => null),
    ])
    dashboardStats.value = response?.data ?? {}
    chartData.value = orders?.data?.list ?? []
    trafficRanks.value = { node: nodes?.data ?? [], user: users?.data ?? [] }
    queueStats.value = queue ?? {}
    queueWorkload.value = workload ?? []
  } catch (error) {
    dashboardError.value = error instanceof Error ? error.message : '仪表盘数据加载失败'
  }
}

watch(chartDays, () => {
  if (authState.value === 'authenticated') void loadDashboard()
})

async function onAuthenticated() {
  authState.value = 'checking'
  try {
    await validateAdminSession(settings)
    authState.value = 'authenticated'
    await loadDashboard()
  } catch {
    clearToken()
    authState.value = 'anonymous'
  }
}

function formatMetric(key: string, currency = false): string {
  const value = Number(dashboardStats.value[key])
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat(locale.value === 'zh-CN' ? 'zh-CN' : 'en-US', currency
    ? { style: 'currency', currency: 'CNY', maximumFractionDigits: 2 }
    : { maximumFractionDigits: 0 }).format(value)
}

onMounted(async () => {
  window.addEventListener('bitpanel:unauthorized', handleUnauthorized)
  if (!getToken()) {
    authState.value = 'anonymous'
    return
  }
  try {
    await validateAdminSession(settings)
    authState.value = 'authenticated'
    await loadDashboard()
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error && [401, 403].includes(Number(error.status))) {
      clearToken()
      authState.value = 'anonymous'
      return
    }
    authState.value = 'authenticated'
    dashboardError.value = error instanceof Error ? error.message : '后台连接失败'
  }
})

onUnmounted(() => window.removeEventListener('bitpanel:unauthorized', handleUnauthorized))
</script>

<template>
  <main v-if="authState === 'checking'" class="auth-check"><div class="brand-mark">B</div><span>正在验证管理员身份…</span></main>
  <LoginView v-else-if="authState === 'anonymous'" :settings="settings" @authenticated="onAuthenticated" />
  <div v-else class="app-shell" :class="{ 'is-dark': darkMode, 'sidebar-collapsed': !sidebarOpen }">
    <aside class="sidebar">
      <div class="brand-row">
        <div class="brand-mark logo-slash">／</div>
        <div v-if="sidebarOpen" class="brand-copy">
          <strong>{{ title }}</strong>
        </div>
        <button class="icon-button collapse-button" :aria-label="sidebarOpen ? '收起侧栏' : '展开侧栏'" @click="sidebarOpen = !sidebarOpen">{{ sidebarOpen ? '‹' : '›' }}</button>
      </div>

      <nav class="navigation">
        <section v-for="section in sections" :key="section.id" class="nav-section">
          <button v-if="section.id !== 'overview'" class="section-toggle" @click="toggleSection(section.id)">
            <NavIcon class="nav-icon section-icon" :name="section.id === 'system' ? 'settings' : section.id === 'infrastructure' ? 'server' : section.id === 'subscriptions' ? 'package' : 'users'" />
            <span class="section-label">{{ sectionTitle(section.id) }}</span>
            <span class="section-caret" :class="{ open: expandedSections.has(section.id) }">⌃</span>
          </button>
          <button
            v-for="item in visibleItems.filter((entry) => entry.section === section.id)"
            v-show="section.id === 'overview' || expandedSections.has(section.id)"
            :key="item.id"
            class="nav-item"
            :class="{ active: activeId === item.id }"
            :title="sidebarOpen ? undefined : menuText(item)"
            @click="activeId = item.id"
          >
            <NavIcon class="nav-icon" :name="item.icon" />
            <span v-if="sidebarOpen" class="nav-label">{{ menuText(item) }}</span>
          </button>
        </section>
      </nav>

      <div class="sidebar-bottom">
        <div class="connection-dot"></div>
        <span v-if="sidebarOpen" class="version">{{ settings.version || 'BitPanel' }}</span>
      </div>
    </aside>

    <main class="main-area">
      <header class="topbar">
        <label class="global-search"><span>⌕</span><input v-model="search" :placeholder="translate('search.placeholder', '搜索菜单和功能…')" /><kbd>⌘K</kbd></label>
        <div class="top-actions">
          <button class="icon-button" aria-label="切换主题" @click="darkMode = !darkMode">{{ darkMode ? '☼' : '◐' }}</button>
          <button class="locale-button" @click="locale = locale === 'zh-CN' ? 'en-US' : 'zh-CN'"><span class="flag">{{ locale === 'zh-CN' ? '🇨🇳' : '🇺🇸' }}</span>{{ locale === 'zh-CN' ? 'CN' : 'EN' }}</button>
          <button class="avatar avatar-button" :aria-label="locale === 'zh-CN' ? '退出登录' : 'Log out'" :title="locale === 'zh-CN' ? '退出登录' : 'Log out'" @click="logout">{{ title.slice(0, 1).toUpperCase() }}</button>
        </div>
      </header>

      <div class="page-content">
        <template v-if="activeId === 'dashboard'">
          <div class="page-heading">
            <div>
              <p class="eyebrow">OVERVIEW</p>
              <h1>{{ translate('dashboard.title', '仪表盘') }}</h1>
              <p class="page-subtitle">{{ locale === 'zh-CN' ? '欢迎回来，这里是你的服务运行概况。' : 'Welcome back. Here is your service overview.' }}</p>
            </div>
            <button class="button button-secondary" @click="refreshPage"><span>↻</span>{{ translate('dashboard.common.refresh', '刷新') }}</button>
          </div>

          <div v-if="dashboardError" class="notice-banner api-error" role="alert">
            <div class="notice-icon">!</div>
            <div><strong>{{ locale === 'zh-CN' ? '统计数据暂不可用' : 'Dashboard data unavailable' }}</strong><p>{{ dashboardError }}</p></div>
          </div>

          <div class="metric-grid">
            <article v-for="metric in [
              { label: translate('dashboard.stats.totalUsers', '总用户'), icon: '♙', accent: 'blue', key: 'totalUsers' },
              { label: translate('dashboard.stats.todayIncome', '今日收入'), icon: '↗', accent: 'violet', key: 'todayIncome', currency: true },
              { label: translate('dashboard.stats.onlineNodes', '在线节点'), icon: '⌘', accent: 'amber', key: 'onlineNodes' },
              { label: translate('dashboard.stats.onlineUsers', '在线用户'), icon: '⌁', accent: 'green', key: 'onlineUsers' },
            ]" :key="metric.label" class="metric-card">
              <div class="metric-top"><span>{{ metric.label }}</span><span class="metric-icon" :class="metric.accent">{{ metric.icon }}</span></div>
              <strong class="metric-value">{{ formatMetric(metric.key, metric.key === 'todayIncome') }}</strong>
              <span class="metric-footnote">{{ locale === 'zh-CN' ? '实时统计' : 'Live statistics' }}</span>
            </article>
          </div>

          <div class="dashboard-grid dashboard-chart-grid">
            <section class="panel chart-panel">
              <div class="panel-heading"><div><h2>{{ translate('dashboard.overview.title', '收入概览') }}</h2><p>{{ locale === 'zh-CN' ? '收入与订单趋势' : 'Revenue and order trends' }}</p></div><select v-model.number="chartDays" class="select-button" :aria-label="locale === 'zh-CN' ? '趋势统计范围' : 'Trend range'"><option :value="7">{{ locale === 'zh-CN' ? '近 7 天' : '7 days' }}</option><option :value="14">{{ locale === 'zh-CN' ? '近 14 天' : '14 days' }}</option><option :value="30">{{ locale === 'zh-CN' ? '近 30 天' : '30 days' }}</option></select></div>
              <div class="chart-empty"><div class="chart-grid-lines"><i></i><i></i><i></i><i></i></div><div v-if="visibleChartData.length" class="chart-bars"><div v-for="point in visibleChartData" :key="point.date" class="chart-bar-column" :title="`${point.date}: ¥${point.value}`"><span class="chart-bar" :style="{ height: barHeight(point.value) }"></span><small>{{ point.date.slice(5) }}</small></div></div><div v-else class="chart-message"><span class="chart-symbol">⌁</span><strong>{{ locale === 'zh-CN' ? '暂无趋势数据' : 'No trend data yet' }}</strong><span>{{ locale === 'zh-CN' ? '当前时间范围内暂无已支付订单统计' : 'No paid order statistics in this period' }}</span></div></div>
            </section>
          </div>

          <div class="ranking-grid">
            <section v-for="ranking in [{ id: 'node', title: '节点流量排行', icon: '♧' }, { id: 'user', title: '用户流量排行', icon: '♙' }]" :key="ranking.id" class="panel ranking-panel">
              <div class="panel-heading"><div class="ranking-title"><span>{{ ranking.icon }}</span><h2>{{ ranking.title }}</h2></div><button class="select-button">今天⌄</button></div>
              <div class="ranking-list">
                <div v-for="rank in trafficRanks[ranking.id as 'node' | 'user']" :key="String(rank.id)" class="ranking-row">
                  <div class="ranking-row-heading"><strong>{{ rank.name }}</strong><span :class="Number(rank.change) >= 0 ? 'change-up' : 'change-down'">{{ Number(rank.change) >= 0 ? '↑' : '↓' }} {{ Math.abs(Number(rank.change) || 0) }}%</span></div>
                  <div class="ranking-bar-line"><span class="ranking-bar" :style="{ width: rankWidth(rank, trafficRanks[ranking.id as 'node' | 'user']) }"></span><small>{{ formatBytes(rank.value) }}</small></div>
                </div>
                <div v-if="!trafficRanks[ranking.id as 'node' | 'user'].length" class="ranking-empty">暂无排行数据</div>
              </div>
            </section>
          </div>

          <div class="queue-grid">
            <section class="panel queue-panel">
              <div class="panel-heading"><div><div class="ranking-title"><span>◴</span><h2>队列状态</h2></div><p>当前队列运行状态</p></div><button class="select-button" aria-label="刷新队列" @click="loadDashboard">↻</button></div>
              <div class="queue-running"><span class="queue-dot" :class="{ stopped: !queueStats.status }">●</span><strong>运行状态</strong><b>{{ queueStats.status ? '正常' : '异常' }}</b><small>当前等待时间：{{ Array.isArray(queueStats.wait) ? (queueStats.wait[0] as { seconds?: number } | undefined)?.seconds ?? 0 : 0 }} 秒</small></div>
              <div class="queue-metrics"><div><span>近期任务数</span><strong>{{ queueStats.recentJobs ?? '—' }}</strong></div><div><span>每分钟处理量</span><strong>{{ queueStats.jobsPerMinute ?? '—' }}</strong></div></div>
            </section>
            <section class="panel queue-panel">
              <div class="panel-heading"><div><div class="ranking-title"><span>▦</span><h2>作业详情</h2></div><p>队列处理详细信息</p></div></div>
              <div class="queue-metrics"><div><span>7日报错数量</span><strong class="danger-value">{{ queueStats.failedJobs ?? '—' }}</strong><small>保留 {{ queueStats.periods && typeof queueStats.periods === 'object' ? (queueStats.periods as Record<string, unknown>).failedJobs ?? '—' : '—' }} 小时</small></div><div><span>最长运行队列</span><strong>{{ queueStats.queueWithMaxRuntime ?? 'N/A' }}</strong></div><div><span>活跃进程</span><strong>{{ queueStats.processes ?? queueWorkload.length }}</strong></div><div><span>最长等待队列</span><strong>{{ queueStats.queueWithMaxThroughput ?? 'N/A' }}</strong></div></div>
            </section>
          </div>
        </template>

        <template v-else>
          <div class="page-heading">
            <div><h1>{{ activeTitle }}</h1><p class="page-subtitle">{{ pageDescriptions[activeId] ?? (locale === 'zh-CN' ? '管理和维护平台相关数据与配置。' : 'Manage platform data and configuration.') }}</p></div>
          </div>
          <AdminDataPage :id="activeId" :settings="settings" />
        </template>
        <footer class="page-footer">BitPanel <span>·</span> {{ settings.version || 'Admin Console' }} <span>·</span> Vue 3 + TypeScript</footer>
      </div>
    </main>
  </div>
</template>
