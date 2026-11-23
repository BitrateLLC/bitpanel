<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { adminDownload, adminGet, adminPost, type ApiError } from '../api'
import type { AdminSettings, Row } from '../types'

type ModuleConfig = { endpoint: string; fields: string[]; query?: Record<string, string | number> }
type EditorField = { key: string; label: string; type: string; options?: string[]; optionLabels?: Record<string, string>; section?: 'protocol' | 'advanced' }

const props = defineProps<{ id: string; settings: AdminSettings }>()
const configs: Record<string, ModuleConfig> = {
  users: { endpoint: 'user/fetch', fields: ['id', 'email', 'plan.name', 'group.name', 'transfer_enable', 'total_used', 'expired_at', 'balance', 'banned', 'is_admin', 'is_staff', 'invite_user.email', 'created_at'] },
  orders: { endpoint: 'order/fetch', fields: ['trade_no', 'user.email', 'plan.name', 'period', 'total_amount', 'status', 'commission_status', 'created_at'] },
  plans: { endpoint: 'plan/fetch', fields: ['id', 'name', 'group.name', 'transfer_enable', 'speed_limit', 'device_limit', 'users_count', 'active_users_count', 'show', 'sell', 'renew', 'sort'] },
  subscriptions: { endpoint: 'plan/fetch', fields: ['id', 'name', 'transfer_enable', 'speed_limit', 'device_limit', 'show', 'sell', 'renew'] },
  nodes: { endpoint: 'server/manage/getNodes', fields: ['id', 'name', 'type', 'host', 'port', 'rate', 'show', 'enabled'] },
  machines: { endpoint: 'server/machine/fetch', fields: ['id', 'name', 'is_active', 'servers_count', 'last_seen_at', 'load_status', 'created_at'] },
  groups: { endpoint: 'server/group/fetch', fields: ['id', 'name', 'users_count', 'server_count'] },
  routes: { endpoint: 'server/route/fetch', fields: ['id', 'remarks', 'action', 'action_value', 'match'] },
  'system-status': { endpoint: 'system/getSystemStatus', fields: ['schedule', 'horizon', 'schedule_last_runtime'] },
  'audit-logs': { endpoint: 'system/getAuditLog', fields: ['id', 'admin.email', 'action', 'uri', 'request_data', 'created_at'], query: { page_size: 20 } },
  'failed-jobs': { endpoint: 'system/getHorizonFailedJobs', fields: ['id', 'connection', 'queue', 'failed_at', 'exception'] },
  'mail-templates': { endpoint: 'mail/template/list', fields: ['name', 'label', 'customized', 'subject', 'updated_at'] },
  tickets: { endpoint: 'ticket/fetch', fields: ['id', 'subject', 'user.email', 'status', 'reply_status', 'updated_at'] },
  notices: { endpoint: 'notice/fetch', fields: ['id', 'title', 'show', 'created_at'] },
  payments: { endpoint: 'payment/fetch', fields: ['id', 'name', 'enable', 'notify_domain'] },
  knowledge: { endpoint: 'knowledge/fetch', fields: ['id', 'title', 'category', 'language', 'show'] },
  coupons: { endpoint: 'coupon/fetch', fields: ['id', 'name', 'type', 'code', 'limit_use', 'created_at'] },
  'gift-cards': { endpoint: 'gift-card/templates', fields: ['id', 'name', 'type', 'status', 'sort', 'created_at'] },
  plugins: { endpoint: 'plugin/getPlugins', fields: ['name', 'description', 'version', 'enabled'] },
  'plugin-apps': { endpoint: 'plugin/getPlugins', fields: ['name', 'description', 'version', 'enabled'] },
  traffic: { endpoint: 'traffic-reset/logs', fields: ['id', 'user.email', 'reset_type', 'trigger_source', 'cleared_traffic', 'reset_time'] },
  settings: { endpoint: 'config/fetch', fields: ['key', 'value'], query: { key: 'site' } },
  themes: { endpoint: 'theme/getThemes', fields: ['name', 'version', 'description', 'active'] },
}

const rows = ref<Row[]>([])
const busy = ref(false)
const error = ref('')
const page = ref(1)
const total = ref(0)
const pageSize = 20
const settingGroups = [
  { key: 'site', label: '站点设置', description: '配置站点基本信息，包括站点名称、描述、货币单位等核心设置。' },
  { key: 'safe', label: '安全设置', description: '管理登录安全、注册限制、邮箱校验和验证码配置。' },
  { key: 'subscribe', label: '订阅设置', description: '配置订阅规则、流量重置方式和节点信息展示。' },
  { key: 'invite', label: '邀请/佣金设置', description: '管理邀请注册、佣金比例与提现策略。' },
  { key: 'server', label: '节点配置', description: '配置节点通讯密钥、同步间隔与设备限制。' },
  { key: 'email', label: '邮件设置', description: '配置 SMTP 邮件服务与提醒邮件。' },
  { key: 'telegram', label: 'Telegram 设置', description: '配置 Telegram Bot 与讨论组链接。' },
  { key: 'app', label: 'APP 设置', description: '配置 Windows、macOS 和 Android 客户端信息。' },
  { key: 'subscribe_template', label: '订阅模板', description: '维护 Clash、Sing-box 等客户端的订阅模板。' },
]
const selectedSettingGroup = computed(() => settingGroups.find((group) => group.key === settingsGroup.value) ?? settingGroups[0]!)
const search = ref('')
const settingDrafts = ref<Record<string, string>>({})
const settingOriginal = ref<Record<string, unknown>>({})
const savingKey = ref('')
const actionBusy = ref<string | number>('')
const editorOpen = ref(false)
const editorBusy = ref(false)
const editorError = ref('')
const editorTarget = ref<Row | null>(null)
const editDraft = ref<Record<string, string>>({})
const settingsGroup = ref('site')
const savedKey = ref('')
const config = computed(() => configs[props.id])
const fields = computed(() => config.value?.fields ?? [])
const editableModule = computed(() => ['users', 'plans', 'subscriptions', 'nodes', 'machines', 'groups', 'routes'].includes(props.id))
const assignOrder = computed(() => props.id === 'orders' && editorOpen.value && !editorTarget.value)
const editorTitle = computed(() => props.id === 'mail-templates' ? `编辑邮件模板：${String(editorTarget.value?.label ?? editorTarget.value?.name ?? '')}` : assignOrder.value ? '手动分配订单' : `${editorTarget.value ? '编辑' : '新建'}${({ users: '用户', nodes: '节点', machines: '机器', groups: '权限组', routes: '路由', plans: '套餐', subscriptions: '套餐' } as Record<string, string>)[props.id] ?? '数据'}`)
const supportsEch = computed(() => ['vless', 'vmess', 'trojan', 'hysteria', 'tuic', 'anytls', 'naive', 'http'].includes(editDraft.value.type || String(editorTarget.value?.type ?? 'vless')))
const orderDetail = ref<Row | null>(null)
const actionDetails = ref<{ title: string; value: unknown } | null>(null)
const selectedUserIds = ref<Set<number>>(new Set())
const groupOptions = ref<Row[]>([])
const routeOptions = ref<Row[]>([])
const machineOptions = ref<Row[]>([])
const nodeOptions = ref<Row[]>([])
const machineHistory = ref<Row[]>([])
const orderSummaryFields = ['id', 'trade_no', 'type', 'status', 'period', 'total_amount', 'commission_status', 'commission_balance', 'user.email', 'plan.name', 'created_at', 'updated_at', 'paid_at']
const editorFields = computed<EditorField[]>(() => {
  if (props.id === 'users' && !editorTarget.value) return [
    { key: 'email_prefix', label: '邮箱前缀（不填则随机生成）', type: 'text' }, { key: 'email_suffix', label: '邮箱域名（例如 example.com）', type: 'text' },
    { key: 'generate_count', label: '生成数量（默认 1）', type: 'number' }, { key: 'password', label: '初始密码（可留空随机生成）', type: 'password' },
    { key: 'plan_id', label: '套餐 ID', type: 'number' }, { key: 'expired_at', label: '到期时间（Unix 秒）', type: 'number' },
  ]
  if (props.id === 'users') return [
    { key: 'email', label: '邮箱', type: 'text' }, { key: 'password', label: '新密码（留空不修改）', type: 'password' },
    { key: 'plan_id', label: '套餐 ID', type: 'number' }, { key: 'transfer_enable', label: '流量额度（GB）', type: 'number' },
    { key: 'expired_at', label: '到期时间（Unix 秒，0 表示不限）', type: 'number' }, { key: 'balance', label: '余额', type: 'number' },
    { key: 'speed_limit', label: '限速（Mbps）', type: 'number' }, { key: 'device_limit', label: '设备限制', type: 'number' },
    { key: 'commission_rate', label: '返佣比例（%）', type: 'number' }, { key: 'commission_type', label: '返佣类型', type: 'number' },
    { key: 'commission_balance', label: '佣金余额', type: 'number' }, { key: 'discount', label: '折扣（%）', type: 'number' },
    { key: 'invite_user_email', label: '邀请人邮箱（留空清除）', type: 'text' },
    { key: 'u', label: '已用上行流量（字节）', type: 'number' }, { key: 'd', label: '已用下行流量（字节）', type: 'number' },
    { key: 'banned', label: '封禁状态', type: 'boolean' }, { key: 'is_admin', label: '管理员', type: 'boolean' }, { key: 'is_staff', label: '员工', type: 'boolean' },
    { key: 'remarks', label: '备注', type: 'textarea' },
  ]
  if (props.id === 'plans' || props.id === 'subscriptions') return [
    { key: 'name', label: '套餐名称', type: 'text' }, { key: 'transfer_enable', label: '流量额度（GB）', type: 'number' },
    { key: 'price_monthly', label: '月付价格', type: 'number' }, { key: 'price_quarterly', label: '季付价格', type: 'number' },
    { key: 'price_half_yearly', label: '半年付价格', type: 'number' }, { key: 'price_yearly', label: '年付价格', type: 'number' },
    { key: 'price_two_yearly', label: '两年付价格', type: 'number' }, { key: 'price_three_yearly', label: '三年付价格', type: 'number' },
    { key: 'price_onetime', label: '一次性价格', type: 'number' }, { key: 'price_reset_traffic', label: '重置流量价格', type: 'number' },
    { key: 'group_id', label: '权限组', type: 'select', options: ['', ...groupOptions.value.map((group) => String(group.id))], optionLabels: Object.fromEntries(groupOptions.value.map((group) => [String(group.id), String(group.name)])) },
    { key: 'speed_limit', label: '限速（Mbps）', type: 'number' }, { key: 'device_limit', label: '设备限制', type: 'number' },
    { key: 'capacity_limit', label: '容量限制', type: 'number' }, { key: 'reset_traffic_method', label: '流量重置方式', type: 'number' },
    { key: 'tags', label: '标签（逗号分隔）', type: 'csv' }, { key: 'content', label: '套餐说明', type: 'textarea' },
    ...(editorTarget.value ? [{ key: 'force_update', label: '将流量/设备/限速/权限组同步给该套餐现有用户', type: 'boolean' }] : []),
  ]
  if (props.id === 'nodes') {
    const protocol = editDraft.value.type || String(editorTarget.value?.type ?? 'vless')
    const nodeFields: EditorField[] = [
      { key: 'name', label: '节点名称', type: 'text' },
      { key: 'type', label: '协议类型', type: 'select', options: ['vless', 'vmess', 'trojan', 'shadowsocks', 'hysteria', 'tuic', 'anytls', 'socks', 'naive', 'http', 'mieru', 'snell'] },
      { key: 'host', label: '连接地址', type: 'text' }, { key: 'port', label: '连接端口', type: 'number' },
      { key: 'server_port', label: '后端服务端口', type: 'number' }, { key: 'rate', label: '流量倍率', type: 'number' },
      { key: 'group_ids', label: '权限组', type: 'multi', options: groupOptions.value.map((group) => String(group.id)), optionLabels: Object.fromEntries(groupOptions.value.map((group) => [String(group.id), String(group.name)])) },
      { key: 'route_ids', label: '路由', type: 'multi', options: routeOptions.value.map((route) => String(route.id)), optionLabels: Object.fromEntries(routeOptions.value.map((route) => [String(route.id), String(route.remarks)])) },
      { key: 'parent_id', label: '父节点', type: 'select', options: ['', ...nodeOptions.value.filter((node) => String(node.id) !== String(editorTarget.value?.id ?? '')).map((node) => String(node.id))], optionLabels: Object.fromEntries(nodeOptions.value.map((node) => [String(node.id), String(node.name)])) },
      { key: 'machine_id', label: '机器', type: 'select', options: ['', ...machineOptions.value.map((machine) => String(machine.id))], optionLabels: Object.fromEntries(machineOptions.value.map((machine) => [String(machine.id), String(machine.name)])) },
      { key: 'transfer_enable', label: '流量上限（字节，0 表示不限）', type: 'number' }, { key: 'show', label: '展示', type: 'boolean' },
      { key: 'enabled', label: '启用', type: 'boolean' },
      { key: 'tags', label: '节点标签（逗号分隔）', type: 'csv' }, { key: 'excludes', label: '排除规则（逗号分隔）', type: 'csv' },
      { key: 'ips', label: '绑定 IP（逗号分隔）', type: 'csv' }, { key: 'code', label: '节点代码', type: 'text' },
      { key: 'spectific_key', label: '专属密钥', type: 'text' }, { key: 'rate_time_enable', label: '启用时段倍率', type: 'boolean' },
      { key: 'rate_time_ranges', label: '时段倍率 JSON 数组', type: 'json' },
      { key: 'custom_outbounds', label: '自定义出站 JSON', type: 'json' }, { key: 'custom_routes', label: '自定义路由 JSON', type: 'json' },
      { key: 'cert_config', label: '证书配置 JSON', type: 'json' }, { key: 'sort', label: '排序值', type: 'number' },
      ...protocolFields(protocol).map((field) => ({ ...field, section: 'protocol' as const })),
      { key: 'protocol_settings.__raw', label: '高级协议参数 JSON（保留未显示的协议选项）', type: 'json', section: 'advanced' as const },
    ]
    return nodeFields
  }
  if (props.id === 'machines') return [
    { key: 'name', label: '机器名称', type: 'text' }, { key: 'notes', label: '备注', type: 'textarea' }, { key: 'is_active', label: '启用', type: 'boolean' },
  ]
  if (props.id === 'groups') return [{ key: 'name', label: '权限组名称', type: 'text' }]
  if (props.id === 'routes') return [
    { key: 'remarks', label: '备注', type: 'text' }, { key: 'action', label: '动作', type: 'select', options: ['block', 'direct', 'dns', 'proxy'] },
    { key: 'action_value', label: '动作参数', type: 'text' }, { key: 'match', label: '匹配规则 JSON 数组', type: 'json' },
  ]
  if (props.id === 'mail-templates') return [
    { key: 'subject', label: '邮件主题', type: 'text' }, { key: 'content', label: '邮件内容（支持 {{变量}} 占位符）', type: 'textarea' },
  ]
  if (props.id === 'orders' && !editorTarget.value) return [
    { key: 'email', label: '用户邮箱', type: 'text' }, { key: 'plan_id', label: '套餐 ID', type: 'number' },
    { key: 'total_amount', label: '支付金额', type: 'number' }, { key: 'period', label: '订阅周期', type: 'select', options: ['month_price', 'quarter_price', 'half_year_price', 'year_price', 'two_year_price', 'three_year_price', 'onetime_price', 'reset_price'] },
  ]
  return []
})
function protocolFields(type: string): EditorField[] {
  const tlsSettings: EditorField[] = [
    { key: 'protocol_settings.tls_settings.server_name', label: 'TLS 域名', type: 'text' },
    { key: 'protocol_settings.tls_settings.allow_insecure', label: 'TLS 允许不安全证书', type: 'boolean' },
    { key: 'protocol_settings.tls_settings.ech.enabled', label: '启用 ECH', type: 'boolean' },
    { key: 'protocol_settings.tls_settings.ech.config', label: 'ECH 配置', type: 'textarea' },
    { key: 'protocol_settings.tls_settings.ech.query_server_name', label: 'ECH 查询域名', type: 'text' },
    { key: 'protocol_settings.tls_settings.ech.key', label: 'ECH 密钥', type: 'password' },
  ]
  const reality: EditorField[] = [
    { key: 'protocol_settings.reality_settings.allow_insecure', label: 'Reality 允许不安全证书', type: 'boolean' },
    { key: 'protocol_settings.reality_settings.server_name', label: 'Reality Server Name', type: 'text' },
    { key: 'protocol_settings.reality_settings.server_port', label: 'Reality Server Port', type: 'number' },
    { key: 'protocol_settings.reality_settings.public_key', label: 'Reality 公钥', type: 'text' },
    { key: 'protocol_settings.reality_settings.private_key', label: 'Reality 私钥', type: 'password' },
    { key: 'protocol_settings.reality_settings.short_id', label: 'Reality Short ID', type: 'text' },
  ]
  const multiplex: EditorField[] = [
    { key: 'protocol_settings.multiplex.enabled', label: '启用多路复用', type: 'boolean' },
    { key: 'protocol_settings.multiplex.protocol', label: '复用协议', type: 'select', options: ['h2mux', 'smux', 'yamux'] },
    { key: 'protocol_settings.multiplex.max_connections', label: '最大连接数', type: 'number' },
    { key: 'protocol_settings.multiplex.min_streams', label: '最小流数', type: 'number' },
    { key: 'protocol_settings.multiplex.max_streams', label: '最大流数', type: 'number' },
    { key: 'protocol_settings.multiplex.padding', label: '复用填充', type: 'boolean' },
    { key: 'protocol_settings.multiplex.brutal.enabled', label: '启用 Brutal', type: 'boolean' },
    { key: 'protocol_settings.multiplex.brutal.up_mbps', label: 'Brutal 上行 Mbps', type: 'number' },
    { key: 'protocol_settings.multiplex.brutal.down_mbps', label: 'Brutal 下行 Mbps', type: 'number' },
  ]
  const utls: EditorField[] = [
    { key: 'protocol_settings.utls.enabled', label: '启用 uTLS', type: 'boolean' },
    { key: 'protocol_settings.utls.fingerprint', label: 'uTLS 指纹', type: 'select', options: ['chrome', 'firefox', 'safari', 'ios', '安卓'] },
  ]
  const transport: EditorField[] = [
    { key: 'protocol_settings.network', label: '传输网络', type: 'select', options: ['tcp', 'ws', 'grpc', 'http', 'httpupgrade', 'xhttp'] },
    { key: 'protocol_settings.network_settings', label: '传输网络参数 JSON', type: 'json' },
  ]
  const tlsMode: EditorField = { key: 'protocol_settings.tls', label: 'TLS 模式（0 关闭，1 启用）', type: 'number' }
  switch (type) {
    case 'shadowsocks': return [
      { key: 'protocol_settings.cipher', label: '加密算法', type: 'select', options: ['aes-128-gcm', 'aes-256-gcm', 'chacha20-ietf-poly1305', '2022-blake3-aes-128-gcm', '2022-blake3-aes-256-gcm', '2022-blake3-chacha20-poly1305'] },
      { key: 'protocol_settings.obfs', label: '混淆方式', type: 'select', options: ['none', 'http', 'tls'] },
      { key: 'protocol_settings.obfs_settings.path', label: '混淆路径', type: 'text' }, { key: 'protocol_settings.obfs_settings.host', label: '混淆 Host', type: 'text' },
      { key: 'protocol_settings.plugin', label: '插件', type: 'text' }, { key: 'protocol_settings.plugin_opts', label: '插件参数', type: 'text' },
    ]
    case 'vmess': return [tlsMode, ...transport, { key: 'protocol_settings.rules', label: '规则 JSON', type: 'json' }, ...tlsSettings, ...multiplex, ...utls]
    case 'trojan': return [tlsMode, ...transport, { key: 'protocol_settings.server_name', label: 'Server Name', type: 'text' }, { key: 'protocol_settings.allow_insecure', label: '允许不安全证书', type: 'boolean' }, ...tlsSettings, ...reality, ...multiplex, ...utls]
    case 'vless': return [tlsMode, ...transport, { key: 'protocol_settings.flow', label: 'Flow', type: 'select', options: ['', 'xtls-rprx-vision'] }, { key: 'protocol_settings.encryption.enabled', label: '启用 VLESS 加密', type: 'boolean' }, { key: 'protocol_settings.encryption.encryption', label: '加密参数', type: 'text' }, { key: 'protocol_settings.encryption.decryption', label: '解密参数', type: 'text' }, ...tlsSettings, ...reality, ...multiplex, ...utls]
    case 'hysteria': return [
      { key: 'protocol_settings.version', label: 'Hysteria 版本', type: 'select', options: ['1', '2'] }, { key: 'protocol_settings.alpn', label: 'ALPN', type: 'text' },
      { key: 'protocol_settings.obfs.open', label: '启用混淆', type: 'boolean' }, { key: 'protocol_settings.obfs.type', label: '混淆类型', type: 'text' }, { key: 'protocol_settings.obfs.password', label: '混淆密码', type: 'password' },
      { key: 'protocol_settings.bandwidth.up', label: '上行带宽 Mbps', type: 'number' }, { key: 'protocol_settings.bandwidth.down', label: '下行带宽 Mbps', type: 'number' }, { key: 'protocol_settings.hop_interval', label: '端口跳跃间隔', type: 'number' },
      { key: 'protocol_settings.tls.server_name', label: 'TLS 域名', type: 'text' }, { key: 'protocol_settings.tls.allow_insecure', label: '允许不安全证书', type: 'boolean' },
      { key: 'protocol_settings.tls.ech.enabled', label: '启用 ECH', type: 'boolean' }, { key: 'protocol_settings.tls.ech.config', label: 'ECH 配置', type: 'textarea' }, { key: 'protocol_settings.tls.ech.query_server_name', label: 'ECH 查询域名', type: 'text' }, { key: 'protocol_settings.tls.ech.key', label: 'ECH 密钥', type: 'password' },
    ]
    case 'tuic': return [
      { key: 'protocol_settings.version', label: 'TUIC 版本', type: 'number' }, { key: 'protocol_settings.congestion_control', label: '拥塞控制', type: 'select', options: ['cubic', 'new_reno', 'bbr'] },
      { key: 'protocol_settings.alpn', label: 'ALPN（逗号分隔）', type: 'csv' }, { key: 'protocol_settings.udp_relay_mode', label: 'UDP Relay 模式', type: 'select', options: ['native', 'quic'] },
      { key: 'protocol_settings.tls.server_name', label: 'TLS 域名', type: 'text' }, { key: 'protocol_settings.tls.allow_insecure', label: '允许不安全证书', type: 'boolean' },
      { key: 'protocol_settings.tls.ech.enabled', label: '启用 ECH', type: 'boolean' }, { key: 'protocol_settings.tls.ech.config', label: 'ECH 配置', type: 'textarea' }, { key: 'protocol_settings.tls.ech.query_server_name', label: 'ECH 查询域名', type: 'text' }, { key: 'protocol_settings.tls.ech.key', label: 'ECH 密钥', type: 'password' },
    ]
    case 'mieru': return [{ key: 'protocol_settings.transport', label: '传输方式', type: 'select', options: ['TCP', 'UDP'] }, { key: 'protocol_settings.traffic_pattern', label: '流量模式', type: 'text' }, ...multiplex]
    case 'snell': return [
      { key: 'protocol_settings.version', label: 'Snell 版本', type: 'select', options: ['5', '6'], optionLabels: { '5': '推荐，兼容 Clash / Surge / sing-box', '6': '仅 mihomo Alpha 支持 userkey，Clash 正式版连不上' } },
      { key: 'protocol_settings.psk', label: 'PSK', type: 'password' },
      { key: 'protocol_settings.obfs_mode', label: '混淆模式（仅 v5 生效）', type: 'select', options: ['none', 'http'] }, { key: 'protocol_settings.mode', label: '流量模式（仅 v6 生效）', type: 'select', options: ['default', 'unshaped', 'unsafe-raw'] },
    ]
    case 'socks': return [tlsMode, ...tlsSettings]
    case 'naive':
    case 'http': return [tlsMode, ...tlsSettings]
    case 'anytls': return [
      { key: 'protocol_settings.alpn', label: 'ALPN', type: 'text' }, { key: 'protocol_settings.tls.server_name', label: 'TLS 域名', type: 'text' },
      { key: 'protocol_settings.tls.allow_insecure', label: '允许不安全证书', type: 'boolean' }, { key: 'protocol_settings.tls.ech.enabled', label: '启用 ECH', type: 'boolean' },
      { key: 'protocol_settings.tls.ech.config', label: 'ECH 配置', type: 'textarea' }, { key: 'protocol_settings.tls.ech.query_server_name', label: 'ECH 查询域名', type: 'text' },
      { key: 'protocol_settings.tls.ech.key', label: 'ECH 密钥', type: 'password' }, { key: 'protocol_settings.padding_scheme', label: 'Padding Scheme JSON', type: 'json' },
    ]
    default: return []
  }
}

const filteredRows = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  if (!query) return rows.value
  return rows.value.filter((row) => fields.value.some((field) => valueAt(row, field).toLocaleLowerCase().includes(query)))
})

function valueAt(row: Row, path: string): string {
  const value = path.split('.').reduce<unknown>((current, key) => {
    if (current && typeof current === 'object') return (current as Record<string, unknown>)[key]
    return undefined
  }, row)
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function labelFor(field: string): string {
  const labels: Record<string, string> = {
    app_name: '站点名称', app_description: '站点描述', app_url: '站点网址', force_https: '强制 HTTPS', logo: 'LOGO', subscribe_url: '订阅 URL', tos_url: '用户条款 URL', stop_register: '关闭注册', currency: '货币单位', currency_symbol: '货币符号', ticket_must_wait_reply: '工单必须等待回复', email_verify: '邮箱验证', safe_mode_enable: '安全模式', secure_path: '后台安全路径', email_whitelist_enable: '邮箱白名单', captcha_enable: '启用验证码', telegram_bot_token: 'Bot Token', telegram_webhook_url: 'Webhook URL', telegram_bot_enable: '启用 Telegram Bot', server_token: '节点通讯密钥', server_pull_interval: '节点拉取间隔', server_push_interval: '节点推送间隔',
    id: 'ID', email: '邮箱', 'user.email': '用户邮箱', 'plan.name': '套餐', plan_id: '套餐 ID',
    name: '名称', title: '标题', subject: '主题', trade_no: '订单号', total_amount: '金额',
    transfer_enable: '流量额度', speed_limit: '限速', device_limit: '设备数', expired_at: '到期时间',
    created_at: '创建时间', updated_at: '更新时间', status: '状态', reply_status: '回复状态',
    show: '展示', enabled: '启用', enable: '启用', sell: '可售', renew: '可续费', type: '类型',
    host: '地址', port: '端口', rate: '倍率', is_active: '状态', remarks: '备注', action: '动作',
    match: '匹配规则', category: '分类', language: '语言', code: '优惠码', limit_use: '使用次数',
    sort: '排序', version: '版本', description: '描述', reset_type: '重置类型', 'group.name': '权限组', 'invite_user.email': '邀请人', users_count: '用户数', active_users_count: '活跃用户', server_count: '节点数', servers_count: '节点数', last_seen_at: '最后心跳', load_status: '负载状态', commission_status: '佣金状态', 'admin.email': '管理员', uri: '请求路径', request_data: '请求参数', exception: '异常信息', connection: '连接', queue: '队列', failed_at: '失败时间', action_value: '动作参数', total_used: '已用流量',
    trigger_source: '触发来源', cleared_traffic: '清理流量', reset_time: '重置时间', key: '配置项', value: '配置值', label: '模板用途', customized: '模板状态',
  }
  return labels[field] ?? labels[field.split('.').at(-1) ?? field] ?? field
}

function searchAudit() {
  page.value = 1
  void load()
}

function normalizeRows(result: unknown): Row[] {
  if (Array.isArray(result)) return result as Row[]
  if (result && typeof result === 'object') {
    const data = (result as { data?: unknown }).data
    if (Array.isArray(data)) {
      total.value = Number((result as { total?: number }).total ?? data.length)
      return data as Row[]
    }
    if (data && typeof data === 'object') return [data as Row]
    if (Object.keys(result).length) return [result as Row]
  }
  return []
}

async function load() {
  if (!config.value) {
    error.value = '该模块暂时没有可用的管理接口'
    rows.value = []
    return
  }
  busy.value = true
  error.value = ''
  total.value = 0
  try {
    const result = await adminGet<unknown>(props.settings, config.value.endpoint, {
      ...(config.value.query ?? {}),
      ...(props.id === 'settings' ? { key: settingsGroup.value } : {}),
      ...(props.id === 'audit-logs' && search.value.trim() ? { keyword: search.value.trim() } : {}),
      ...(props.id === 'failed-jobs' ? { page_size: pageSize } : {}),
      current: page.value,
      pageSize,
    })
    if (props.id === 'settings' && result && typeof result === 'object') {
      const settings = (result as Record<string, unknown>)[settingsGroup.value]
      if (settings && typeof settings === 'object') {
        settingOriginal.value = settings as Record<string, unknown>
        settingDrafts.value = Object.fromEntries(Object.entries(settings).map(([key, value]) => [key, String(value ?? '')]))
        rows.value = Object.entries(settings).map(([key, value]) => ({ key, value }))
      } else {
        rows.value = normalizeRows(result)
      }
    } else {
      rows.value = normalizeRows(result)
    }
    if (!total.value) total.value = rows.value.length
  } catch (cause) {
    error.value = (cause as ApiError).message || '数据加载失败'
  } finally {
    busy.value = false
  }
}

async function saveSetting(key: string) {
  savingKey.value = key
  savedKey.value = ''
  error.value = ''
  try {
    const draft = settingDrafts.value[key] ?? ''
    const original = settingOriginal.value[key]
    const value = typeof original === 'boolean' ? draft === 'true' : typeof original === 'number' ? Number(draft) : draft
    await adminPost(props.settings, 'config/save', { [key]: value })
    settingOriginal.value[key] = value
    savedKey.value = key
  } catch (cause) {
    error.value = (cause as ApiError).message || '配置保存失败'
  } finally {
    savingKey.value = ''
  }
}

function isBooleanSetting(key: string): boolean {
  return typeof settingOriginal.value[key] === 'boolean'
}

function isToggleSetting(key: string): boolean {
  return isBooleanSetting(key) || /^(force_https|stop_register|email_verify|safe_mode_enable|email_whitelist_enable|captcha_enable|telegram_bot_enable|server_ws_enable)$/.test(key) || key.endsWith('_enable')
}


function isLongSetting(key: string): boolean {
  return key.includes('description') || key.includes('template') || key.includes('suffix')
}

function isSecretSetting(key: string): boolean {
  return /password|secret|token|_key/i.test(key)
}

function loadSummary(row: Row): { cpu: string; memory: string; disk: string } {
  const status = row.load_status && typeof row.load_status === 'object' ? row.load_status as Record<string, unknown> : {}
  const memory = status.mem && typeof status.mem === 'object' ? status.mem as Record<string, unknown> : {}
  const disk = status.disk && typeof status.disk === 'object' ? status.disk as Record<string, unknown> : {}
  const cpu = Number(status.cpu)
  const cpuPercent = Number.isFinite(cpu) ? (cpu <= 1 ? cpu * 100 : cpu) : 0
  return {
    cpu: `${cpuPercent.toFixed(1)}%`,
    memory: `${formatHistoryBytes(memory.used)} / ${formatHistoryBytes(memory.total)}`,
    disk: `${formatHistoryBytes(disk.used)} / ${formatHistoryBytes(disk.total)}`,
  }
}

function nodeTypeColor(value: unknown): string {
  const colors: Record<string, string> = {
    snell: '#f59e0b', shadowsocks: '#43a047', vmess: '#d63384', trojan: '#e9ad3b',
    hysteria: '#4f7fe8', vless: '#202124', tuic: '#00b956', socks: '#1689e8',
    naive: '#9924b4', http: '#ff5722', mieru: '#4caf50', anytls: '#8052c7',
  }
  return colors[String(value ?? '').toLowerCase()] ?? '#7b8798'
}

function formatCell(row: Row, field: string): string {
  const value = valueAt(row, field)
  if (field === 'load_status' && row.load_status && typeof row.load_status === 'object') {
    const status = row.load_status as Record<string, unknown>
    const memory = status.mem && typeof status.mem === 'object' ? status.mem as Record<string, unknown> : {}
    const disk = status.disk && typeof status.disk === 'object' ? status.disk as Record<string, unknown> : {}
    const cpu = Number(status.cpu)
    const cpuPercent = Number.isFinite(cpu) ? (cpu <= 1 ? cpu * 100 : cpu) : 0
    return `CPU ${cpuPercent.toFixed(1)}% · 内存 ${formatHistoryBytes(memory.used)} / ${formatHistoryBytes(memory.total)} · 磁盘 ${formatHistoryBytes(disk.used)} / ${formatHistoryBytes(disk.total)}`
  }
  if (['_at', 'reset_time', 'failed_at'].some((suffix) => field.endsWith(suffix)) && value !== '—') return formatHistoryTime(value)
  if (field === 'customized' && props.id === 'mail-templates') return ['1', 'true'].includes(value.toLowerCase()) ? '已自定义' : '默认模板'
  if (['show', 'enabled', 'enable', 'sell', 'renew', 'is_active', 'banned', 'is_admin', 'is_staff'].includes(field) && value !== '—') {
    return ['1', 'true'].includes(value.toLowerCase()) ? '是' : '否'
  }
  if (field === 'transfer_enable' && value !== '—') {
    const amount = Number(value)
    if (!Number.isFinite(amount)) return value
    return props.id === 'users' ? `${(amount / 1073741824).toFixed(2)} GB` : `${amount} GB`
  }
  if (field === 'total_amount' && value !== '—') return `¥ ${value}`
  if (['balance', 'commission_balance'].includes(field) && value !== '—' && props.id === 'users') return `¥ ${(Number(value) / 100).toFixed(2)}`
  if (field === 'total_used' && value !== '—') return `${(Number(value) / 1073741824).toFixed(2)} GB`
  return value
}

function formatHistoryTime(value: unknown): string {
  const timestamp = Number(value)
  if (!Number.isFinite(timestamp)) return String(value ?? '—')
  if (timestamp <= 0) return '—'
  return new Date(timestamp < 1e12 ? timestamp * 1000 : timestamp).toLocaleString()
}

function formatHistoryBytes(value: unknown): string {
  const bytes = Number(value)
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const rank = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** rank).toFixed(1)} ${units[rank]}`
}

function rowId(row: Row): string | number | undefined {
  return row.id as string | number | undefined
}

function getPathValue(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => current && typeof current === 'object' ? (current as Record<string, unknown>)[key] : undefined, source)
}

function setPathValue(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.')
  let current = target
  for (const part of parts.slice(0, -1)) {
    if (!current[part] || typeof current[part] !== 'object' || Array.isArray(current[part])) current[part] = {}
    current = current[part] as Record<string, unknown>
  }
  current[parts.at(-1)!] = value
}

async function loadEditorOptions() {
  if (!['nodes', 'plans', 'subscriptions'].includes(props.id)) return
  try {
    const [groups, routesResult, machines, nodes] = await Promise.all([
      adminGet<unknown>(props.settings, 'server/group/fetch'),
      props.id === 'nodes' ? adminGet<unknown>(props.settings, 'server/route/fetch') : Promise.resolve([]),
      props.id === 'nodes' ? adminGet<unknown>(props.settings, 'server/machine/fetch') : Promise.resolve([]),
      props.id === 'nodes' ? adminGet<unknown>(props.settings, 'server/manage/getNodes') : Promise.resolve([]),
    ])
    groupOptions.value = Array.isArray(groups) ? groups as Row[] : []
    routeOptions.value = Array.isArray(routesResult) ? routesResult as Row[] : routesResult && typeof routesResult === 'object' && Array.isArray((routesResult as { data?: unknown }).data) ? (routesResult as { data: Row[] }).data : []
    machineOptions.value = Array.isArray(machines) ? machines as Row[] : []
    nodeOptions.value = Array.isArray(nodes) ? nodes as Row[] : []
  } catch (cause) { editorError.value = (cause as ApiError).message || '加载分组或路由选项失败' }
}

function selectedMultiValues(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String)
  const value = String(raw ?? '').trim()
  if (!value) return []
  if (value.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.map(String)
    } catch {}
  }
  return value.split(',').map((part) => part.trim()).filter(Boolean)
}

function selectedOptionLabels(field: EditorField): string {
  const selected = selectedMultiValues(editDraft.value[field.key])
  if (!selected.length) return '请选择'
  return selected.map((value) => field.optionLabels?.[value] ?? value).join('、')
}

function toggleMultiOption(key: string, option: string, event: Event) {
  const selected = new Set(selectedMultiValues(editDraft.value[key]))
  if ((event.target as HTMLInputElement).checked) selected.add(option)
  else selected.delete(option)
  editDraft.value[key] = [...selected].join(',')
}

function openEditor(row?: Row) {
  editorTarget.value = row ?? null
  if (['nodes', 'plans', 'subscriptions'].includes(props.id)) void loadEditorOptions()
  editDraft.value = {}
  editorError.value = ''
  const draft: Record<string, string> = {}
  for (const field of editorFields.value) {
    const raw = field.key === 'protocol_settings.__raw' ? row?.protocol_settings : field.key === 'invite_user_email' ? getPathValue(row, 'invite_user.email') : field.key.startsWith('price_') ? getPathValue(row?.prices, field.key.slice(6)) : getPathValue(row, field.key)
    if (field.key === 'transfer_enable' && raw !== undefined && props.id === 'users') {
      draft[field.key] = String(Number(raw) / 1073741824)
    } else if ((field.key === 'balance' || field.key === 'commission_balance') && raw !== undefined && props.id === 'users') {
      draft[field.key] = String(Number(raw) / 100)
    } else if (field.type === 'json') {
      draft[field.key] = JSON.stringify(raw ?? {}, null, 2)
    } else if (field.type === 'csv' || field.type === 'multi') {
      draft[field.key] = selectedMultiValues(raw).join(',')
    } else if (field.type === 'boolean') {
      draft[field.key] = isEnabled(raw) ? '1' : '0'
    } else {
      draft[field.key] = raw === null || raw === undefined ? '' : String(raw)
    }
  }
  if (props.id === 'nodes' && !row) {
    draft.type = 'vless'
    draft.rate = '1'
    draft.port = '443'
    draft.server_port = '443'
    draft.show = '1'
    draft.enabled = '1'
    draft.group_ids = ''
    draft.route_ids = ''
    draft['protocol_settings.__raw'] = '{\n  "tls": 0,\n  "network": "tcp"\n}'
    draft['protocol_settings.tls'] = '0'
    draft['protocol_settings.network'] = 'tcp'
  }
  if ((props.id === 'plans' || props.id === 'subscriptions') && !row) {
    draft.transfer_enable = '100'
    draft.prices = '{}'
  }
  if (props.id === 'machines' && !row) draft.is_active = '1'
  if (props.id === 'routes' && !row) { draft.action = 'block'; draft.match = '[]' }
  editorTarget.value = row ?? null
  editDraft.value = draft
  editorOpen.value = true
}

function makeEditorPayload(): Row {
  const payload: Row = {}
  const planPrices: Record<string, number> = {}
  const protocolOverlay: Record<string, unknown> = {}
  let rawProtocolSettings: Record<string, unknown> = {}
  if (editorTarget.value?.id !== undefined) payload.id = editorTarget.value.id
  const rawProtocolField = editorFields.value.find((field) => field.key === 'protocol_settings.__raw')
  const rawProtocolText = rawProtocolField ? editDraft.value[rawProtocolField.key] ?? '' : ''
  if (rawProtocolText.trim()) {
    try {
      const parsed = JSON.parse(rawProtocolText)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error()
      rawProtocolSettings = parsed as Record<string, unknown>
    } catch { throw new Error('高级协议参数不是有效 JSON 对象') }
  }
  for (const field of editorFields.value) {
    const raw = editDraft.value[field.key] ?? ''
    if (field.key === 'password' && !raw) continue
    if (field.key === 'protocol_settings.__raw') continue
    if (field.key.startsWith('price_')) {
      if (raw !== '') {
        const price = Number(raw)
        if (!Number.isFinite(price) || price < 0) throw new Error(`${field.label}必须是非负数字`)
        if (price > 0) planPrices[field.key.slice(6)] = price
      }
      continue
    }
    if (field.key.startsWith('protocol_settings.')) {
      if (!raw && field.type !== 'boolean') continue
      let value: unknown = raw
      if (field.type === 'json') {
        try { value = raw.trim() ? JSON.parse(raw) : {} } catch { throw new Error(`${field.label}不是有效 JSON`) }
      } else if (field.type === 'csv') {
        value = raw.trim() ? raw.split(',').map((part) => part.trim()).filter(Boolean) : []
      } else if (field.type === 'boolean') value = raw === '1'
      else if (field.type === 'number') {
        const numeric = Number(raw)
        if (!Number.isFinite(numeric)) throw new Error(`${field.label}必须是数字`)
        value = numeric
      }
      setPathValue(protocolOverlay, field.key.slice('protocol_settings.'.length), value)
      continue
    }
    if (field.type === 'json') {
      try { payload[field.key] = raw.trim() ? JSON.parse(raw) : {} } catch { throw new Error(`${field.label}不是有效 JSON`) }
    } else if (field.type === 'csv' || field.type === 'multi') {
      const values = selectedMultiValues(raw)
      payload[field.key] = values.map((part) => field.key !== 'group_ids' && /^\d+$/.test(part) ? Number(part) : part)
    } else if (field.type === 'boolean') {
      payload[field.key] = raw === '1'
    } else if (field.type === 'select') {
      if (!raw && ['group_id', 'machine_id', 'parent_id'].includes(field.key)) payload[field.key] = null
      else if (raw !== '') payload[field.key] = raw
    } else if (field.type === 'number') {
      if (raw === '') continue
      const numeric = Number(raw)
      if (!Number.isFinite(numeric)) throw new Error(`${field.label}必须是数字`)
      payload[field.key] = numeric
    } else if (raw !== '') payload[field.key] = raw
  }
  if ((props.id === 'plans' || props.id === 'subscriptions') && Object.keys(planPrices).length) payload.prices = planPrices
  if (props.id === 'nodes') {
    const mergeSettings = (target: Record<string, unknown>, source: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(source)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          const nested = target[key] && typeof target[key] === 'object' && !Array.isArray(target[key]) ? target[key] as Record<string, unknown> : {}
          target[key] = nested
          mergeSettings(nested, value as Record<string, unknown>)
        } else target[key] = value
      }
    }
    mergeSettings(rawProtocolSettings, protocolOverlay)
    payload.protocol_settings = rawProtocolSettings
  }
  if ((props.id === 'plans' || props.id === 'subscriptions') && payload.force_update === true) {
    payload.group_id = payload.group_id ?? editorTarget.value?.group_id ?? null
    payload.speed_limit = payload.speed_limit ?? editorTarget.value?.speed_limit ?? null
    payload.device_limit = payload.device_limit ?? editorTarget.value?.device_limit ?? null
    payload.transfer_enable = payload.transfer_enable ?? editorTarget.value?.transfer_enable
  }
  if (props.id === 'users' && payload.transfer_enable !== undefined) payload.transfer_enable = Number(payload.transfer_enable) * 1073741824
  if (props.id === 'users' && payload.balance !== undefined) payload.balance = Number(payload.balance) * 100
  if (props.id === 'users' && payload.commission_balance !== undefined) payload.commission_balance = Number(payload.commission_balance) * 100
  if ((props.id === 'plans' || props.id === 'subscriptions') && payload.transfer_enable !== undefined) payload.transfer_enable = Number(payload.transfer_enable)
  return payload
}

async function editMailTemplate(row: Row) {
  editorBusy.value = true
  editorError.value = ''
  try {
    const template = await adminGet<Row>(props.settings, 'mail/template/get', { name: String(row.name) })
    editorTarget.value = { ...row, ...template }
    editDraft.value = { subject: String(template.subject ?? ''), content: String(template.content ?? '') }
    editorOpen.value = true
  } catch (cause) { error.value = (cause as ApiError).message || '邮件模板加载失败' }
  finally { editorBusy.value = false }
}

async function resetMailTemplate(row: Row) {
  const name = String(row.name ?? '')
  if (!name || !window.confirm(`恢复「${String(row.label ?? name)}」邮件模板默认内容？`)) return
  try { await adminPost(props.settings, 'mail/template/reset', { name }); await load() }
  catch (cause) { error.value = (cause as ApiError).message || '恢复默认模板失败' }
}

async function sendTemplateTest(row: Row) {
  try {
    await adminPost(props.settings, 'mail/template/test', { name: String(row.name) })
    window.alert('测试邮件已发送至当前管理员邮箱')
  } catch (cause) { error.value = (cause as ApiError).message || '测试邮件发送失败' }
}

async function runSettingsAction(action: 'test-email' | 'telegram-webhook') {
  error.value = ''
  try {
    if (action === 'test-email') {
      const result = await adminPost<unknown>(props.settings, 'config/testSendMail', {})
      actionDetails.value = { title: '测试邮件发送结果', value: result }
    } else {
      const result = await adminPost<unknown>(props.settings, 'config/setTelegramWebhook', { telegram_bot_token: settingDrafts.value.telegram_bot_token ?? '' })
      actionDetails.value = { title: 'Telegram Webhook 配置结果', value: result }
    }
  } catch (cause) { error.value = (cause as ApiError).message || '系统操作失败' }
}

async function saveEditor() {
  editorBusy.value = true
  editorError.value = ''
  try {
    const payload = makeEditorPayload()
    if (props.id === 'mail-templates') {
      await adminPost(props.settings, 'mail/template/save', { name: editorTarget.value?.name, ...payload })
    } else if (props.id === 'users') {
      await adminPost(props.settings, editorTarget.value ? 'user/update' : 'user/generate', payload)
    } else if (props.id === 'nodes') {
      await adminPost(props.settings, 'server/manage/save', payload)
    } else if (props.id === 'machines') {
      const result = await adminPost<{ token?: string; install_command?: string }>(props.settings, 'server/machine/save', payload)
      if (!editorTarget.value && result?.install_command) actionDetails.value = { title: '机器已创建，请保存以下初始化信息', value: { token: result.token, install_command: result.install_command } }
    } else if (props.id === 'groups') {
      await adminPost(props.settings, 'server/group/save', payload)
    } else if (props.id === 'routes') {
      await adminPost(props.settings, 'server/route/save', payload)
    } else if (props.id === 'orders') {
      await adminPost(props.settings, 'order/assign', payload)
    } else {
      await adminPost(props.settings, 'plan/save', payload)
    }
    editorOpen.value = false
    await load()
  } catch (cause) {
    editorError.value = (cause as ApiError).message || (cause instanceof Error ? cause.message : '保存失败')
  } finally {
    editorBusy.value = false
  }
}

async function moveRow(row: Row, direction: -1 | 1) {
  const index = rows.value.findIndex((item) => rowId(item) === rowId(row))
  const target = index + direction
  if (index < 0 || target < 0 || target >= rows.value.length) return
  const ordered = [...rows.value]
  ;[ordered[index], ordered[target]] = [ordered[target]!, ordered[index]!]
  actionBusy.value = rowId(row) ?? ''
  try {
    if (props.id === 'nodes') {
      await adminPost(props.settings, 'server/manage/sort', ordered.map((item, order) => ({ id: rowId(item), order })))
    } else {
      await adminPost(props.settings, 'plan/sort', { ids: ordered.map((item) => rowId(item)) })
    }
    rows.value = ordered
  } catch (cause) { error.value = (cause as ApiError).message || '排序保存失败' }
  finally { actionBusy.value = '' }
}

async function deleteRow(row: Row) {
  const id = rowId(row)
  if (id === undefined || !window.confirm(`确定删除「${String(row.name ?? row.email ?? id)}」？此操作不可撤销。`)) return
  actionBusy.value = id
  error.value = ''
  try {
    const endpoint = ({ nodes: 'server/manage/drop', users: 'user/destroy', machines: 'server/machine/drop', groups: 'server/group/drop', routes: 'server/route/drop' } as Record<string, string>)[props.id] ?? 'plan/drop'
    await adminPost(props.settings, endpoint, { id })
    await load()
  } catch (cause) {
    error.value = (cause as ApiError).message || '删除失败'
  } finally {
    actionBusy.value = ''
  }
}

function isEnabled(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true'
}

async function updateFlag(row: Row, field: 'show' | 'sell' | 'renew' | 'enabled') {
  const id = rowId(row)
  if (id === undefined) return
  const nextValue = isEnabled(row[field]) ? 0 : 1
  const key = `${id}:${field}`
  actionBusy.value = key
  error.value = ''
  try {
    const endpoint = props.id === 'nodes' ? 'server/manage/update' : 'plan/update'
    await adminPost(props.settings, endpoint, { id, [field]: nextValue })
    row[field] = nextValue
  } catch (cause) {
    error.value = (cause as ApiError).message || '状态更新失败'
  } finally {
    actionBusy.value = ''
  }
}

function selectVisibleUsers(event: Event) {
  const next = new Set(selectedUserIds.value)
  for (const row of filteredRows.value) {
    const id = Number(row.id)
    if (!Number.isFinite(id)) continue
    if ((event.target as HTMLInputElement).checked) next.add(id)
    else next.delete(id)
  }
  selectedUserIds.value = next
}

function toggleUserSelection(row: Row, event: Event) {
  const id = Number(row.id)
  if (!Number.isFinite(id)) return
  const next = new Set(selectedUserIds.value)
  if ((event.target as HTMLInputElement).checked) next.add(id)
  else next.delete(id)
  selectedUserIds.value = next
}

async function banSelectedUsers() {
  const userIds = [...selectedUserIds.value]
  if (!userIds.length || !window.confirm(`确定封禁选中的 ${userIds.length} 个用户？其会话将被注销。`)) return
  actionBusy.value = 'bulk-ban'
  error.value = ''
  try {
    await adminPost(props.settings, 'user/ban', { scope: 'selected', user_ids: userIds })
    selectedUserIds.value = new Set()
    await load()
  } catch (cause) { error.value = (cause as ApiError).message || '批量封禁失败' }
  finally { actionBusy.value = '' }
}

async function sendMailSelected() {
  const userIds = [...selectedUserIds.value]
  if (!userIds.length) return
  const subject = window.prompt(`邮件主题（发送给 ${userIds.length} 位所选用户）`)
  if (!subject?.trim()) return
  const content = window.prompt('邮件内容')
  if (!content?.trim()) return
  if (!window.confirm(`确认向 ${userIds.length} 位用户发送邮件「${subject.trim()}」？`)) return
  actionBusy.value = 'bulk-mail'
  error.value = ''
  try {
    await adminPost(props.settings, 'user/sendMail', { scope: 'selected', user_ids: userIds, subject: subject.trim(), content: content.trim() })
    window.alert('邮件已加入发送队列')
  } catch (cause) { error.value = (cause as ApiError).message || '批量邮件发送失败' }
  finally { actionBusy.value = '' }
}

async function exportUsers() {
  const selected = [...selectedUserIds.value]
  const scope = selected.length ? 'selected' : 'all'
  try {
    await adminDownload(props.settings, 'user/dumpCSV', { scope, user_ids: selected }, 'bitpanel-users.csv')
  } catch (cause) { error.value = (cause as ApiError).message || '用户导出失败' }
}

async function resetUserSecret(row: Row) {
  const id = rowId(row)
  if (id === undefined || !window.confirm(`确定重置用户 ${String(row.email ?? id)} 的订阅密钥？`)) return
  actionBusy.value = id
  error.value = ''
  try {
    await adminPost(props.settings, 'user/resetSecret', { id })
    window.alert('订阅密钥已重置')
  } catch (cause) {
    error.value = (cause as ApiError).message || '重置订阅密钥失败'
  } finally {
    actionBusy.value = ''
  }
}

async function inspectOrder(row: Row) {
  try {
    orderDetail.value = await adminPost<Row>(props.settings, 'order/detail', { id: row.id })
  } catch (cause) {
    error.value = (cause as ApiError).message || '订单详情加载失败'
  }
}

async function generateEchKeys() {
  const publicName = editDraft.value['protocol_settings.tls_settings.ech.query_server_name'] || editDraft.value['protocol_settings.tls.ech.query_server_name'] || 'ech.example.com'
  try {
    const result = await adminGet<{ key: string; config: string }>(props.settings, 'server/manage/generateEchKey', { public_name: publicName })
    if (editDraft.value['protocol_settings.tls.ech.key'] !== undefined) {
      editDraft.value['protocol_settings.tls.ech.key'] = result.key
      editDraft.value['protocol_settings.tls.ech.config'] = result.config
    } else {
      editDraft.value['protocol_settings.tls_settings.ech.key'] = result.key
      editDraft.value['protocol_settings.tls_settings.ech.config'] = result.config
    }
  } catch (cause) { editorError.value = (cause as ApiError).message || 'ECH 密钥生成失败' }
}

async function setOrderPaid(row: Row) {
  const tradeNo = String(row.trade_no ?? '')
  if (!tradeNo || !window.confirm(`确认将订单 ${tradeNo} 标记为已支付？`)) return
  actionBusy.value = tradeNo
  error.value = ''
  try { await adminPost(props.settings, 'order/paid', { trade_no: tradeNo }); await load() }
  catch (cause) { error.value = (cause as ApiError).message || '订单处理失败' }
  finally { actionBusy.value = '' }
}

async function cancelOrder(row: Row) {
  const tradeNo = String(row.trade_no ?? '')
  if (!tradeNo || !window.confirm(`确认取消待支付订单 ${tradeNo}？`)) return
  actionBusy.value = tradeNo
  error.value = ''
  try { await adminPost(props.settings, 'order/cancel', { trade_no: tradeNo }); await load() }
  catch (cause) { error.value = (cause as ApiError).message || '订单取消失败' }
  finally { actionBusy.value = '' }
}

async function updateCommission(row: Row, event: Event) {
  const tradeNo = String(row.trade_no ?? '')
  const value = Number((event.target as HTMLSelectElement).value)
  if (!tradeNo) return
  try {
    await adminPost(props.settings, 'order/update', { trade_no: tradeNo, commission_status: value })
    row.commission_status = value
  } catch (cause) { error.value = (cause as ApiError).message || '佣金状态更新失败' }
}

async function machineAction(row: Row, action: 'token' | 'reset' | 'install' | 'history' | 'nodes') {
  if (!row.id) return
  machineHistory.value = []
  actionBusy.value = row.id as string | number
  try {
    if (action === 'token') {
      const result = await adminGet<{ token: string }>(props.settings, 'server/machine/getToken', { id: Number(row.id) })
      actionDetails.value = { title: '机器认证 Token', value: result.token }
    } else if (action === 'reset') {
      if (!window.confirm(`确定重置机器「${String(row.name)}」的 Token？旧 Token 将立即失效。`)) return
      const result = await adminPost<{ token: string }>(props.settings, 'server/machine/resetToken', { id: Number(row.id) })
      actionDetails.value = { title: '新机器 Token（请立即保存）', value: result.token }
    } else if (action === 'install') {
      const result = await adminGet<{ command: string }>(props.settings, 'server/machine/installCommand', { id: Number(row.id) })
      actionDetails.value = { title: '机器安装命令', value: result.command }
    } else if (action === 'history') {
      const result = await adminGet<unknown>(props.settings, 'server/machine/history', { machine_id: Number(row.id), range_hours: 24 })
      machineHistory.value = Array.isArray(result) ? result as Row[] : []
      actionDetails.value = { title: '最近 24 小时负载历史', value: result }
    } else {
      const result = await adminGet<unknown>(props.settings, 'server/machine/nodes', { machine_id: Number(row.id) })
      actionDetails.value = { title: `机器「${String(row.name)}」关联节点`, value: result }
    }
  } catch (cause) { error.value = (cause as ApiError).message || '机器操作失败' }
  finally { actionBusy.value = '' }
}

async function replyTicket(row: Row) {
  const id = rowId(row)
  if (id === undefined) return
  const message = window.prompt(`回复工单「${String(row.subject ?? id)}」`)
  if (!message?.trim()) return
  actionBusy.value = id
  error.value = ''
  try {
    await adminPost(props.settings, 'ticket/reply', { id, message: message.trim() })
    await load()
  } catch (cause) {
    error.value = (cause as ApiError).message || '工单回复失败'
  } finally {
    actionBusy.value = ''
  }
}

async function closeTicket(row: Row) {
  const id = rowId(row)
  if (id === undefined || !window.confirm(`确定关闭工单「${String(row.subject ?? id)}」？`)) return
  actionBusy.value = id
  error.value = ''
  try {
    await adminPost(props.settings, 'ticket/close', { id })
    await load()
  } catch (cause) {
    error.value = (cause as ApiError).message || '关闭工单失败'
  } finally {
    actionBusy.value = ''
  }
}

watch(() => props.id, () => { page.value = 1; search.value = ''; void load() })
watch(settingsGroup, () => { savedKey.value = ''; void load() })
watch(page, () => void load())
onMounted(() => void load())
</script>

<template>
  <div v-if="id === 'settings'" class="settings-layout">
    <nav class="settings-nav">
      <button v-for="group in settingGroups" :key="group.key" :class="{ selected: settingsGroup === group.key }" @click="settingsGroup = group.key">{{ group.label }}</button>
    </nav>
    <section class="panel settings-form">
      <div class="settings-heading"><div><h2>{{ selectedSettingGroup.label }}</h2><p>{{ selectedSettingGroup.description }}</p></div><div class="settings-actions"><button v-if="settingsGroup === 'email'" class="button button-secondary" @click="runSettingsAction('test-email')">发送测试邮件</button><button v-if="settingsGroup === 'telegram'" class="button button-secondary" @click="runSettingsAction('telegram-webhook')">设置 Webhook</button><button class="button button-secondary" :disabled="busy" @click="load">↻ 刷新</button></div></div>
      <div v-if="busy" class="data-state"><span class="spinner"></span>正在加载设置…</div>
      <div v-else-if="error" class="data-state data-error"><strong>设置加载失败</strong><span>{{ error }}</span><button class="button button-secondary" @click="load">重试</button></div>
      <template v-else>
        <div v-for="row in rows" :key="String(row.key)" class="settings-field">
          <label :for="`setting-${String(row.key)}`">{{ labelFor(String(row.key)) }}</label>
          <p>{{ `用于配置${labelFor(String(row.key))}。` }}</p>
          <select v-if="isToggleSetting(String(row.key))" :id="`setting-${String(row.key)}`" :value="settingDrafts[String(row.key)]" @change="settingDrafts[String(row.key)] = ($event.target as HTMLSelectElement).value"><option :value="isBooleanSetting(String(row.key)) ? 'true' : '1'">开启</option><option :value="isBooleanSetting(String(row.key)) ? 'false' : '0'">关闭</option></select>
          <textarea v-else-if="isLongSetting(String(row.key))" :id="`setting-${String(row.key)}`" v-model="settingDrafts[String(row.key)]" rows="3"></textarea>
          <input v-else :id="`setting-${String(row.key)}`" v-model="settingDrafts[String(row.key)]" :type="isSecretSetting(String(row.key)) ? 'password' : 'text'" />
          <button class="save-setting" :disabled="savingKey === String(row.key)" @click="saveSetting(String(row.key))">{{ savingKey === String(row.key) ? '保存中…' : savedKey === String(row.key) ? '已保存' : '保存' }}</button>
        </div>
      </template>
    </section>
  </div>
  <section v-else class="panel data-panel">
    <div class="data-toolbar">
      <label class="data-search"><span>⌕</span><input v-model="search" :placeholder="`${fields[0] ? labelFor(fields[0]) : '数据'}搜索`" @keyup.enter="id === 'audit-logs' && searchAudit()" /></label>
      <div class="data-toolbar-actions"><span class="data-total">{{ total }} 条记录</span><button v-if="id === 'users'" class="button button-secondary" @click="exportUsers">导出{{ selectedUserIds.size ? `所选 ${selectedUserIds.size} 人` : '全部' }}</button><button v-if="id === 'users' && selectedUserIds.size" class="button button-secondary" :disabled="actionBusy === 'bulk-ban'" @click="banSelectedUsers">封禁所选 {{ selectedUserIds.size }} 人</button><button v-if="id === 'users' && selectedUserIds.size" class="button button-secondary" :disabled="actionBusy === 'bulk-mail'" @click="sendMailSelected">邮件所选 {{ selectedUserIds.size }} 人</button><button v-if="editableModule || id === 'orders'" class="button button-primary" @click="openEditor()">{{ id === 'orders' ? '＋ 分配订单' : '＋ 新建' }}</button><button class="button button-secondary data-refresh" :disabled="busy" @click="load">↻ 刷新</button></div>
    </div>
    <div v-if="error" class="inline-action-error" role="alert">{{ error }}</div>
    <div v-if="busy" class="data-state"><span class="spinner"></span>正在加载数据…</div>
    <div v-else-if="!filteredRows.length" class="data-state">暂无数据</div>
    <div v-else class="table-scroll">
      <table class="data-table">
        <thead><tr><th v-if="id === 'users'"><input type="checkbox" aria-label="选择当前页用户" @change="selectVisibleUsers" /></th><th v-for="field in fields" :key="field">{{ labelFor(field) }}</th><th v-if="['users', 'plans', 'subscriptions', 'nodes', 'tickets', 'machines', 'groups', 'routes', 'orders', 'mail-templates'].includes(id)">操作</th></tr></thead>
        <tbody><tr v-for="(row, index) in filteredRows" :key="String(row.id ?? row.trade_no ?? index)">
          <td v-if="id === 'users'"><input type="checkbox" :checked="selectedUserIds.has(Number(row.id))" :aria-label="`选择用户 ${String(row.email ?? row.id)}`" @change="toggleUserSelection(row, $event)" /></td>
          <td v-for="field in fields" :key="field" :class="{ 'load-status-cell': field === 'load_status' }">
            <button v-if="(id === 'plans' || id === 'subscriptions') && ['show', 'sell', 'renew'].includes(field)" class="status-toggle" :class="{ active: isEnabled(row[field]) }" :disabled="actionBusy === `${String(rowId(row))}:${field}`" @click="updateFlag(row, field as 'show' | 'sell' | 'renew')">{{ isEnabled(row[field]) ? '是' : '否' }}</button>
            <button v-else-if="id === 'nodes' && ['show', 'enabled'].includes(field)" class="status-toggle" :class="{ active: isEnabled(row[field]) }" :disabled="actionBusy === `${String(rowId(row))}:${field}`" @click="updateFlag(row, field as 'show' | 'enabled')">{{ isEnabled(row[field]) ? '是' : '否' }}</button>
            <div v-else-if="field === 'load_status'" class="load-summary"><span>CPU <strong>{{ loadSummary(row).cpu }}</strong></span><span>内存 <strong>{{ loadSummary(row).memory }}</strong></span><span>磁盘 <strong>{{ loadSummary(row).disk }}</strong></span></div>
            <span v-else-if="id === 'nodes' && field === 'type'" class="node-type-badge" :style="{ '--node-type-color': nodeTypeColor(row.type) }"><i aria-hidden="true"></i>{{ formatCell(row, field) }}</span>
            <span v-else-if="id === 'nodes' && field === 'id'" class="node-id-color" :style="{ color: nodeTypeColor(row.type) }">{{ formatCell(row, field) }}</span>
            <span v-else :title="formatCell(row, field)">{{ formatCell(row, field) }}</span>
          </td>
          <td v-if="['users', 'plans', 'subscriptions', 'nodes', 'tickets', 'machines', 'groups', 'routes', 'orders', 'mail-templates'].includes(id)" class="row-actions">
            <template v-if="editableModule"><button :disabled="actionBusy === rowId(row)" @click="openEditor(row)">编辑</button><button class="danger-action" :disabled="actionBusy === rowId(row)" @click="deleteRow(row)">删除</button><button v-if="id === 'users'" :disabled="actionBusy === rowId(row)" @click="resetUserSecret(row)">重置密钥</button><template v-if="id === 'plans' || id === 'subscriptions' || id === 'nodes'"><button title="上移" :disabled="index === 0 || actionBusy !== ''" @click="moveRow(row, -1)">↑</button><button title="下移" :disabled="index === filteredRows.length - 1 || actionBusy !== ''" @click="moveRow(row, 1)">↓</button></template>
              <template v-if="id === 'machines'"><button @click="machineAction(row, 'token')">查看 Token</button><button @click="machineAction(row, 'reset')">重置 Token</button><button @click="machineAction(row, 'install')">安装命令</button><button @click="machineAction(row, 'history')">负载历史</button><button @click="machineAction(row, 'nodes')">关联节点</button></template>
            </template>
            <template v-else-if="id === 'mail-templates'"><button @click="editMailTemplate(row)">编辑</button><button @click="sendTemplateTest(row)">发送测试</button><button class="danger-action" @click="resetMailTemplate(row)">恢复默认</button></template>
            <template v-else-if="id === 'tickets'"><button :disabled="actionBusy === rowId(row)" @click="replyTicket(row)">回复</button><button :disabled="actionBusy === rowId(row)" @click="closeTicket(row)">关闭</button></template>
            <template v-else-if="id === 'orders'"><button @click="inspectOrder(row)">详情</button><button v-if="Number(row.status) === 0" @click="setOrderPaid(row)">标记已支付</button><button v-if="Number(row.status) === 0" class="danger-action" @click="cancelOrder(row)">取消</button><select class="commission-select" :value="String(row.commission_status ?? 0)" aria-label="佣金状态" @change="updateCommission(row, $event)"><option value="0">佣金未处理</option><option value="1">佣金已发放</option><option value="3">佣金已取消</option></select></template>
          </td>
        </tr></tbody>
      </table>
    </div>
    <div v-if="!busy && !error && total > pageSize" class="pagination-bar"><span>第 {{ page }} 页 / 共 {{ Math.ceil(total / pageSize) }} 页</span><div><button :disabled="page <= 1" @click="page--">上一页</button><button :disabled="page * pageSize >= total" @click="page++">下一页</button></div></div>
  </section>
  <div v-if="editorOpen" class="editor-overlay" @click.self="editorOpen = false">
    <form class="editor-dialog" @submit.prevent="saveEditor">
      <header class="editor-header"><div><h2>{{ editorTitle }}</h2><p>{{ assignOrder ? '按邮箱、套餐和订阅周期创建一笔人工订单。' : props.id === 'nodes' ? '选择协议后填写展开的协议参数；高级 JSON 可覆盖未提供专用输入项的设置。' : props.id === 'users' && !editorTarget ? '通过邮箱前缀和域名生成一个或多个用户。' : props.id === 'plans' && editorTarget ? '启用同步选项会立即更新该套餐关联用户的流量、限速、设备数和权限组。' : '提交前请确认所有业务字段。' }}</p></div><button type="button" class="editor-close" aria-label="关闭" @click="editorOpen = false">×</button></header>
      <div class="editor-fields">
        <template v-for="(field, fieldIndex) in editorFields" :key="field.key">
          <div v-if="field.section && editorFields[fieldIndex - 1]?.section !== field.section" class="editor-section-title">{{ field.section === 'protocol' ? `${editDraft.type || editorTarget?.type || '节点'} 协议参数` : '高级参数' }}</div>
          <div class="editor-field"><div v-if="field.key.endsWith('.ech.config')" class="editor-field-label"><span>{{ field.label }}</span><button v-if="id === 'nodes' && supportsEch && editDraft[field.key.replace(/\.config$/, '.enabled')] === '1'" type="button" class="button button-secondary ech-generate" @click="generateEchKeys">生成 ECH 密钥</button></div><span v-else>{{ field.label }}</span>
            <select v-if="field.type === 'boolean'" v-model="editDraft[field.key]"><option value="1">是</option><option value="0">否</option></select>
            <select v-else-if="field.type === 'select'" v-model="editDraft[field.key]" :required="['type', 'period'].includes(field.key)"><option v-for="option in field.options ?? []" :key="option" :value="option">{{ option ? `${option} — ${field.optionLabels?.[option] ?? option}` : (field.key === 'group_id' ? '无权限组' : field.key === 'parent_id' ? '无父节点' : field.key === 'machine_id' ? '未绑定机器' : '默认') }}</option></select>
            <details v-else-if="field.type === 'multi'" class="multi-select-field"><summary>{{ selectedOptionLabels(field) }}</summary><div class="multi-select-options"><label v-for="option in field.options ?? []" :key="option"><input type="checkbox" :checked="(editDraft[field.key] ?? '').split(',').includes(option)" @change="toggleMultiOption(field.key, option, $event)" />{{ field.optionLabels?.[option] ?? option }}</label><span v-if="!field.options?.length" class="multi-select-empty">没有可选项</span></div></details>
            <textarea v-else-if="field.type === 'textarea' || field.type === 'json'" v-model="editDraft[field.key]" :rows="field.type === 'json' ? 9 : 3" :required="field.key === 'content'" :spellcheck="field.type !== 'json'"></textarea>
            <input v-else v-model="editDraft[field.key]" :type="field.type" :required="['email_suffix', 'email', 'name', 'type', 'host', 'port', 'server_port', 'rate', 'transfer_enable', 'total_amount', 'subject'].includes(field.key)" />
          </div>
        </template>
      </div>
      <p v-if="editorError" class="editor-error" role="alert">{{ editorError }}</p>
      <footer class="editor-footer"><button type="button" class="button button-secondary" :disabled="editorBusy" @click="editorOpen = false">取消</button><button type="submit" class="button button-primary" :disabled="editorBusy">{{ editorBusy ? '保存中…' : '保存' }}</button></footer>
    </form>
  </div>
  <div v-if="orderDetail" class="editor-overlay" @click.self="orderDetail = null"><section class="editor-dialog detail-dialog"><header class="editor-header"><div><h2>订单详情</h2><p>{{ String(orderDetail.trade_no ?? '') }}</p></div><button class="editor-close" aria-label="关闭" @click="orderDetail = null">×</button></header><dl class="order-detail-grid"><template v-for="field in orderSummaryFields" :key="field"><dt>{{ labelFor(field) }}</dt><dd>{{ field === 'total_amount' ? `¥ ${valueAt(orderDetail, field)}` : valueAt(orderDetail, field) }}</dd></template></dl><details class="order-raw-details"><summary>查看完整原始数据</summary><pre>{{ JSON.stringify(orderDetail, null, 2) }}</pre></details></section></div>
  <div v-if="actionDetails" class="editor-overlay" @click.self="actionDetails = null"><section class="editor-dialog detail-dialog"><header class="editor-header"><div><h2>{{ actionDetails.title }}</h2></div><button class="editor-close" aria-label="关闭" @click="actionDetails = null">×</button></header><div v-if="actionDetails.title.includes('负载历史') && machineHistory.length" class="table-scroll history-table-wrap"><table class="data-table"><thead><tr><th>采集时间</th><th>CPU</th><th>内存</th><th>磁盘</th><th>入站</th><th>出站</th></tr></thead><tbody><tr v-for="(sample, index) in machineHistory" :key="String(sample.recorded_at ?? index)"><td>{{ formatHistoryTime(sample.recorded_at) }}</td><td>{{ Number(sample.cpu ?? 0).toFixed(1) }}%</td><td>{{ formatHistoryBytes(sample.mem_used) }} / {{ formatHistoryBytes(sample.mem_total) }}</td><td>{{ formatHistoryBytes(sample.disk_used) }} / {{ formatHistoryBytes(sample.disk_total) }}</td><td>{{ formatHistoryBytes(sample.net_in_speed) }}/s</td><td>{{ formatHistoryBytes(sample.net_out_speed) }}/s</td></tr></tbody></table></div><pre v-else>{{ typeof actionDetails.value === 'string' ? actionDetails.value : JSON.stringify(actionDetails.value, null, 2) }}</pre><footer class="editor-footer"><button class="button button-secondary" @click="actionDetails = null">关闭</button></footer></section></div>
</template>

<style scoped>
.data-panel{padding:0;overflow:hidden}.data-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 17px;border-bottom:1px solid var(--line)}.data-search{display:flex;align-items:center;gap:8px;max-width:360px;min-width:200px;height:34px;padding:0 10px;border:1px solid var(--line);border-radius:7px;color:#8b97a8}.data-search input{border:0;outline:0;background:transparent;min-width:0;width:100%;color:var(--text);font-size:11px}.data-search input::placeholder{color:#a4adba}.data-toolbar-actions{display:flex;align-items:center;gap:13px}.data-total{font-size:10px;color:#8d98a7}.data-refresh{padding:7px 10px}.table-scroll{overflow:auto}.data-table{width:100%;border-collapse:collapse;white-space:nowrap;text-align:left}.data-table th{height:38px;background:#fafbfd;color:#8490a0;font-size:9px;font-weight:600;padding:0 15px}.data-table td{height:48px;border-top:1px solid #f0f2f6;padding:0 15px;color:#4d5b70;font-size:10px;max-width:260px}.data-table td span{display:block;overflow:hidden;text-overflow:ellipsis}.data-table tr:hover td{background:#fafbff}.data-state{min-height:190px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:9px;color:#96a1b0;font-size:11px}.data-error{color:#bd5962}.data-error strong{font-size:12px}.data-error span{max-width:80%;text-align:center}.spinner{width:17px;height:17px;border:2px solid #dce3ef;border-top-color:#5974de;border-radius:50%;animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.pagination-bar{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-top:1px solid var(--line);color:#8995a5;font-size:10px}.pagination-bar div{display:flex;gap:6px}.pagination-bar button{border:1px solid var(--line);background:var(--surface);color:#677487;border-radius:6px;padding:6px 9px;font-size:10px}.pagination-bar button:disabled{opacity:.45;cursor:not-allowed}.is-dark .data-table th{background:#222c3b}.is-dark .data-table td{color:#b6c1d0;border-color:#303a49}.is-dark .data-table tr:hover td{background:#222c3b}

/* Keep data-heavy admin views legible at normal desktop zoom. */
.data-toolbar{padding:16px 20px}.data-search{height:38px;max-width:420px}.data-search input{font-size:13px}.data-total{font-size:12px}.data-refresh,.button-primary{font-size:12px;padding:8px 12px}.data-table th{height:44px;padding:0 14px;font-size:11px}.data-table td{height:56px;padding:0 14px;font-size:12px;max-width:320px}.data-table td span{line-height:1.4}.data-table td.row-actions{min-width:360px;max-width:none;white-space:normal}.data-table td.load-status-cell{min-width:280px;max-width:380px;white-space:normal}.load-summary{display:flex;flex-wrap:wrap;gap:5px}.load-summary span{padding:4px 7px;border:1px solid #e5eaf0;border-radius:5px;background:#fafbfd;color:#768398;font-size:11px;white-space:nowrap}.load-summary strong{color:#35445a;font-size:11px;font-weight:650}.is-dark .load-summary span{border-color:#39465a;background:#222c3b;color:#b6c2d1}.is-dark .load-summary strong{color:#e0e7f0}.row-actions{flex-wrap:wrap;gap:7px;min-width:340px;max-width:460px}.row-actions button{padding:6px 9px;font-size:11px}.commission-select{font-size:11px}.status-toggle{font-size:11px;padding:4px 10px}.pagination-bar{font-size:12px}.pagination-bar button{font-size:11px;padding:7px 10px}.inline-action-error{font-size:12px}.node-type-badge{display:inline-flex!important;align-items:center;gap:6px;width:max-content;padding:4px 8px;border-radius:999px;background:color-mix(in srgb,var(--node-type-color) 11%,transparent);color:var(--node-type-color);font-weight:650}.node-type-badge i{width:7px;height:7px;flex:none;border-radius:50%;background:var(--node-type-color)}.node-id-color{font-weight:700}
@media(max-width:1100px){.data-table td:has(.row-actions){min-width:320px}.row-actions{min-width:300px;max-width:380px}}
</style>
