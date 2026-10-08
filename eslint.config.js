import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// LLM and scanner output is untrusted; raw HTML sinks are never allowed (ADR 0003).
const RAW_HTML_BANS = [
  {
    selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
    message: 'Raw HTML is banned. Render untrusted text as text or via SafeMarkdown (ADR 0003).',
  },
  {
    selector: 'AssignmentExpression[left.property.name=/^(innerHTML|outerHTML)$/]',
    message: 'innerHTML/outerHTML assignment is banned (ADR 0003).',
  },
  {
    selector:
      "CallExpression[callee.property.name='insertAdjacentHTML'], CallExpression[callee.object.name='document'][callee.property.name=/^(write|writeln)$/]",
    message: 'HTML-string DOM APIs are banned (ADR 0003).',
  },
];

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'public/data', 'playwright-report', 'test-results'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: { ecmaVersion: 2023, globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-restricted-syntax': ['error', ...RAW_HTML_BANS],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/*.{js,mjs}'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
    rules: { 'no-restricted-syntax': ['error', ...RAW_HTML_BANS] },
  },
);
