import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Component } from 'vue';
import * as Vue from 'vue';
import { compileScript, parse } from 'vue/compiler-sfc';
import * as ts from 'typescript';

/**
 * Compile a production SFC for component tests without requiring a second
 * Vite configuration. Imports are deliberately limited to Vue so a test
 * fails when the component acquires a dependency the harness cannot model.
 */
export const loadSfc = (
  relativePath: string,
  importerUrl: string
): Component => {
  const importerDirectory = dirname(fileURLToPath(importerUrl));
  const filename = resolve(importerDirectory, relativePath);
  const source = readFileSync(filename, 'utf-8');
  const { descriptor, errors } = parse(source, { filename });

  if (errors.length) {
    throw new Error(
      `Failed to parse ${filename}: ${errors
        .map((error) => error.message)
        .join(', ')}`
    );
  }

  const compiled = compileScript(descriptor, {
    id: filename,
    inlineTemplate: true,
  });
  const { outputText } = ts.transpileModule(compiled.content, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: `${filename}.ts`,
  });
  const module = { exports: {} as { default?: Component } };
  const requireModule = (id: string): unknown => {
    if (id === 'vue') {
      return Vue;
    }

    throw new Error(`Unexpected import "${id}" in ${relativePath}`);
  };
  const evaluate = new Function(
    'require',
    'module',
    'exports',
    '__filename',
    '__dirname',
    outputText
  );

  evaluate(
    requireModule,
    module,
    module.exports,
    filename,
    dirname(filename)
  );

  if (!module.exports.default) {
    throw new Error(`No component exported by ${relativePath}`);
  }

  return module.exports.default;
};
