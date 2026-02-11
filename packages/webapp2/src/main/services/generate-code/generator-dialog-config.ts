import type { GeneratorType } from '../../components/sidebar/workspace-types';

export type ConfigDialog = 'none' | 'django' | 'sql' | 'sqlalchemy' | 'jsonschema' | 'agent' | 'qiskit';

const GENERATOR_DIALOG_MAP: Partial<Record<GeneratorType, Exclude<ConfigDialog, 'none'>>> = {
  django: 'django',
  sql: 'sql',
  sqlalchemy: 'sqlalchemy',
  jsonschema: 'jsonschema',
  agent: 'agent',
  qiskit: 'qiskit',
};

export const getConfigDialogForGenerator = (generatorType: GeneratorType): ConfigDialog => {
  return GENERATOR_DIALOG_MAP[generatorType] ?? 'none';
};
