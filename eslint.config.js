// ESLint 扁平配置：只拦「一定是 bug」的规则，格式问题不在这一层管。
// 存量代码里有大量紧凑写法与中文注释，一上来开风格规则会刷上千条告警，结果就是没人看。
import js from '@eslint/js'
import vue from 'eslint-plugin-vue'

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'public/**', 'server/data/**', 'server/rag/*.json.gz']
  },
  js.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        // 浏览器
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        indexedDB: 'readonly',
        location: 'readonly',
        history: 'readonly',
        fetch: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        Headers: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
        TextDecoder: 'readonly',
        TextEncoder: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        performance: 'readonly',
        CustomEvent: 'readonly',
        Event: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        FileReader: 'readonly',
        FormData: 'readonly',
        Image: 'readonly',
        Audio: 'readonly',
        AudioContext: 'readonly',
        webkitAudioContext: 'readonly',
        MediaRecorder: 'readonly',
        Worker: 'readonly',
        MediaStream: 'readonly',
        Notification: 'readonly',
        SpeechSynthesisUtterance: 'readonly',
        SpeechRecognition: 'readonly',
        webkitSpeechRecognition: 'readonly',
        Element: 'readonly',
        HTMLElement: 'readonly',
        Node: 'readonly',
        DOMParser: 'readonly',
        XMLSerializer: 'readonly',
        OffscreenCanvas: 'readonly',
        IntersectionObserver: 'readonly',
        ResizeObserver: 'readonly',
        MutationObserver: 'readonly',
        getComputedStyle: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        prompt: 'readonly',
        structuredClone: 'readonly',
        globalThis: 'readonly',
        // Node（测试与脚本）
        process: 'readonly',
        Buffer: 'readonly',
        global: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly'
      }
    },
    rules: {
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-dupe-else-if': 'error',
      'no-dupe-class-members': 'error',
      'no-unreachable': 'error',
      'no-debugger': 'error',
      'no-obj-calls': 'error',
      'no-sparse-arrays': 'error',
      'no-unsafe-negation': 'error',
      'no-cond-assign': 'error',
      'no-self-assign': 'error',
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-async-promise-executor': 'error',
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
      // 以下三条属于「检查器噪声」而非缺陷，关掉并说明原因：
      // 中文正则里保留转义符更易读；空 catch 是刻意的"失败不打断主流程"；
      // formatMath 用 \x03 作公式占位符。
      'no-useless-escape': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-control-regex': 'off',
      'vue/no-unused-vars': 'warn',
      // 模板风格规则不属于本次质量门目标。
      'vue/multi-word-component-names': 'off',
      'vue/require-default-prop': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      'vue/attributes-order': 'off',
      'vue/html-indent': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/html-closing-bracket-spacing': 'off',
      'vue/mustache-interpolation-spacing': 'off',
      'vue/first-attribute-linebreak': 'off',
      'vue/no-v-html': 'off'
    }
  }
]
