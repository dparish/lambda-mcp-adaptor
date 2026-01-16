# Agents file for lambda-mcp-adaptor

## Project structure
- `src/`: Source files for the MCP server SDK (ESM entrypoints and types).
- `tests/`: Mocha test suite (`*.test.mjs`).
- `example/`: Sample usage code.
- `dist/`: Build outputs (ESM, CJS, and type declarations).
- Root config: `package.json`, `eslint.config.mjs`, `.prettierrc`.

## Build
- `npm run build` (runs ESM, CJS, and types outputs).
- Individual steps: `npm run build:esm`, `npm run build:cjs`, `npm run build:types`.

## Test
- `npm test` (Mocha runs `tests/**/*.test.mjs`).

## lint and format
Lint and format are currently in package.json but do not function properly. That will 
be remedied in the future.
