<script setup lang="ts">
import { computed, ref } from 'vue'
import { ApiError, login, setToken } from '../api'
import type { AdminSettings } from '../types'

const props = defineProps<{ settings: AdminSettings }>()
const emit = defineEmits<{ authenticated: [] }>()
const email = ref('')
const password = ref('')
const busy = ref(false)
const error = ref('')
const siteTitle = computed(() => props.settings.title || 'BitPanel')

async function submit() {
  error.value = ''
  busy.value = true
  try {
    const result = await login(email.value.trim(), password.value)
    setToken(result.auth_data)
    emit('authenticated')
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : '登录失败，请稍后重试'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main class="login-screen">
    <div class="login-decoration decoration-one"></div>
    <div class="login-decoration decoration-two"></div>
    <section class="login-card">
      <div class="login-brand">
        <img v-if="settings.logo" :src="settings.logo" :alt="siteTitle" />
        <div v-else class="brand-mark login-mark">B</div>
        <div><strong>{{ siteTitle }}</strong><span>ADMIN CONSOLE</span></div>
      </div>
      <p class="eyebrow">SECURE ACCESS</p>
      <h1>管理员登录</h1>
      <p class="login-description">使用有管理员权限的账户登录控制台。</p>
      <form class="login-form" @submit.prevent="submit">
        <label>邮箱地址<input v-model.trim="email" type="email" autocomplete="username" required placeholder="admin@example.com" /></label>
        <label>密码<input v-model="password" type="password" autocomplete="current-password" required placeholder="输入账户密码" /></label>
        <div v-if="error" class="login-error" role="alert">{{ error }}</div>
        <button class="button button-primary" type="submit" :disabled="busy">{{ busy ? '正在验证…' : '登录管理后台' }}<span>→</span></button>
      </form>
      <p class="login-footnote">认证由 BitPanel API 完成，只有管理员账户可以访问。</p>
    </section>
  </main>
</template>

<style scoped>
.login-screen{min-height:100vh;display:grid;place-items:center;background:#f5f7fb;position:relative;overflow:hidden;padding:24px}.login-decoration{position:absolute;border-radius:50%;filter:blur(1px);pointer-events:none}.decoration-one{width:540px;height:540px;right:-170px;top:-230px;background:radial-gradient(circle,#dce5ff 0,transparent 70%)}.decoration-two{width:480px;height:480px;left:-220px;bottom:-230px;background:radial-gradient(circle,#e6eaff 0,transparent 70%)}.login-card{position:relative;width:min(100%,410px);background:#fff;border:1px solid #e8edf5;border-radius:17px;padding:36px 38px 27px;box-shadow:0 22px 70px #25365612}.login-brand{display:flex;align-items:center;gap:11px;margin-bottom:37px}.login-brand>div:last-child{display:flex;flex-direction:column;gap:3px}.login-brand strong{font-size:15px;color:#1e2938}.login-brand span{font-size:8px;letter-spacing:1.4px;color:#8a97a9}.login-brand img{width:37px;height:37px;object-fit:contain}.login-mark{width:38px;height:38px}.login-card .eyebrow{color:#6980d8}.login-card h1{font-size:24px;letter-spacing:-.5px;margin:0;color:#1c2737}.login-description{font-size:11px;color:#8793a4;margin:8px 0 25px}.login-form{display:flex;flex-direction:column;gap:15px}.login-form label{display:flex;flex-direction:column;gap:7px;font-size:10px;font-weight:600;color:#59677b}.login-form input{height:41px;border:1px solid #e1e7ef;border-radius:7px;padding:0 11px;outline:0;color:#273448;font-size:11px}.login-form input:focus{border-color:#8094ee;box-shadow:0 0 0 3px #627be51c}.login-form input::placeholder{color:#aab3c0}.button-primary{position:relative;width:100%;height:41px;justify-content:center;border:0;background:#5873df;color:white;box-shadow:0 6px 14px #5470df35}.button-primary:hover{background:#4966d4}.button-primary:disabled{opacity:.65;cursor:wait}.button-primary span{position:absolute;right:51px;font-size:16px}.login-error{color:#be525e;background:#fff3f3;border:1px solid #f4dddd;border-radius:7px;padding:9px 10px;font-size:10px}.login-footnote{text-align:center;color:#98a3b1;font-size:9px;margin:21px 0 0}:global(.auth-check){min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;background:#f5f7fb;color:#8491a3;font-size:11px}.auth-check .brand-mark{width:42px;height:42px}
</style>
