import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

// Type-aware linting for the app source. This is the complement to oxlint
// (fast + syntactic): ESLint here runs only the rules that need type
// information — floating / misused promises, unsafe `any`, await-thenable,
// unnecessary conditions, and the like — which oxlint can't do. Scoped to
// `src/`, the only tree covered by a tsconfig project; the e2e specs and
// config files are linted by oxlint alone. Prettier owns formatting, so its
// config switches off any stylistic rules that would conflict.
export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  prettier,
)
