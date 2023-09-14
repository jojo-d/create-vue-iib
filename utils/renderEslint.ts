import * as fs from 'node:fs'
import * as path from 'node:path'

import type { Linter } from 'eslint'

import createESLintConfig from '@vue/create-eslint-config'

import sortDependencies from './sortDependencies'
import deepMerge from './deepMerge'

import eslintTemplatePackage from '../template/eslint/package.json' assert { type: 'json' }
const eslintDeps = eslintTemplatePackage.devDependencies

export default function renderEslint(
  rootDir,
  { needsTypeScript, needsCypress, needsCypressCT, needsPrettier }
) {
  const additionalConfig: Linter.Config = {
    root: true,
    env: {
      es6: true,
      browser: true,
      node: true
    },
    plugins: ['prettier', 'vue'],
    extends: [
      'eslint:recommended',
      'plugin:prettier/recommended',
      'plugin:vue/vue3-essential',
      '@vue/prettier'
    ],
    globals: {
      page: true,
      APP_ENV: true,
      PUBLIC_PATH: true
    },
    rules: {
      'prettier/prettier': [
        'error',
        {
          singleQuote: true,
          jsxSingleQuote: false
        }
      ],
      // Possible Problems：可能引起执行错误的检测
      'array-callback-return': 'error', // 在数组方法的回调中强制添加return

      // Suggestions
      complexity: [
        'error',
        {
          max: 15 // 逻辑圈层复杂度，最多15层
        }
      ],
      'default-case': 'error', // 要求switch中必须有default case
      'default-case-last': 'error', // default case必须在最后
      eqeqeq: 'error', // === !==
      'max-depth': ['error', 5], // 嵌套深度，不能超过5层
      'max-lines': [
        // 但文件最大行数
        'error',
        { max: 500, skipBlankLines: true, skipComments: true }
      ],
      'new-cap': 'error', // 要求构造函数名称以大写字母开头
      'no-alert': 'error',
      'no-console': 'error',
      'no-undef-init': 'error' // 禁止初始化值为undefined
    }
  }
  const additionalDependencies = {
    "@vue/cli-plugin-eslint": "~4.5.15",
    "eslint": "~6.7.2",
    "eslint-plugin-prettier": "~3.3.1",
    "eslint-plugin-vue": "~7.20.0",
    "@vue/eslint-config-prettier": "~6.0.0",
    "prettier": "~2.5.1"
  }

  if (needsCypress) {
    additionalConfig.overrides = [
      {
        files: needsCypressCT
          ? [
              '**/__tests__/*.{cy,spec}.{js,ts,jsx,tsx}',
              'cypress/e2e/**/*.{cy,spec}.{js,ts,jsx,tsx}'
            ]
          : ['cypress/e2e/**/*.{cy,spec}.{js,ts,jsx,tsx}'],
        extends: ['plugin:cypress/recommended']
      }
    ]

    additionalDependencies['eslint-plugin-cypress'] = eslintDeps['eslint-plugin-cypress']
  }

  const { pkg, files } = createESLintConfig({
    vueVersion: '3.x',
    // we currently don't support other style guides
    styleGuide: 'default',
    hasTypeScript: needsTypeScript,
    needsPrettier,

    additionalConfig,
    additionalDependencies
  })

  const scripts: Record<string, string> = {
    // Note that we reuse .gitignore here to avoid duplicating the configuration
    lint: needsTypeScript
      ? 'eslint . --ext .vue,.js,.jsx,.cjs,.mjs,.ts,.tsx,.cts,.mts --fix --ignore-path .gitignore'
      : 'eslint . --ext .vue,.js,.jsx,.cjs,.mjs --fix --ignore-path .gitignore'
  }

  // Theoretically, we could add Prettier without requring ESLint.
  // But it doesn't seem to be a good practice, so we just leave it here.
  if (needsPrettier) {
    // Default to only format the `src/` directory to avoid too much noise, and
    // the need for a `.prettierignore` file.
    // Users can still append any paths they'd like to format to the command,
    // e.g. `npm run format cypress/`.
    scripts.format = 'prettier --write src/'
  }

  // update package.json
  const packageJsonPath = path.resolve(rootDir, 'package.json')
  const existingPkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  const updatedPkg = sortDependencies(deepMerge(deepMerge(existingPkg, pkg), { scripts }))
  fs.writeFileSync(packageJsonPath, JSON.stringify(updatedPkg, null, 2) + '\n', 'utf-8')

  // write to .eslintrc.cjs, .prettierrc.json, etc.
  for (const [fileName, content] of Object.entries(files)) {
    const fullPath = path.resolve(rootDir, fileName)
    fs.writeFileSync(fullPath, content as string, 'utf-8')
  }

  // update .vscode/extensions.json
  const extensionsJsonPath = path.resolve(rootDir, '.vscode/extensions.json')
  const existingExtensions = JSON.parse(fs.readFileSync(extensionsJsonPath, 'utf8'))
  existingExtensions.recommendations.push('dbaeumer.vscode-eslint')
  if (needsPrettier) {
    existingExtensions.recommendations.push('esbenp.prettier-vscode')
  }
  fs.writeFileSync(extensionsJsonPath, JSON.stringify(existingExtensions, null, 2) + '\n', 'utf-8')
}
