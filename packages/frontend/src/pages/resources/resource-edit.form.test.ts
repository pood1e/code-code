import { describe, expect, it } from 'vitest';

import {
  createInitialValues,
  resourceEditConfigMap,
  toEnvEntries,
  toEnvObject
} from './resource-edit.form';

describe('resource-edit.form', () => {
  it('createInitialValues 应按资源类型生成正确表单初始值', () => {
    expect(createInitialValues('skills')).toEqual({
      name: '',
      description: '',
      contentText: ''
    });

    expect(createInitialValues('mcps')).toEqual({
      name: '',
      description: '',
      type: 'stdio',
      command: '',
      argsText: '',
      envEntries: []
    });
  });

  it('toEnvEntries / toEnvObject 应在对象和表单数组之间互转，并丢弃空 key', () => {
    expect(
      toEnvEntries({
        NODE_ENV: 'test',
        API_KEY: 'secret'
      })
    ).toEqual([
      { key: 'NODE_ENV', value: 'test' },
      { key: 'API_KEY', value: 'secret' }
    ]);

    expect(
      toEnvObject([
        { key: ' NODE_ENV ', value: 'test' },
        { key: '', value: 'ignored' }
      ])
    ).toEqual({
      NODE_ENV: 'test'
    });

    expect(toEnvObject([])).toBeUndefined();
  });

  it('skills/rules buildPayload 应 trim 名称和描述，并校验 Markdown 内容', () => {
    expect(
      resourceEditConfigMap.skills.buildPayload({
        name: ' Skill A ',
        description: '  description  ',
        contentText: '# Skill'
      })
    ).toEqual({
      data: {
        name: 'Skill A',
        description: 'description',
        content: '# Skill'
      },
      error: null
    });

    expect(
      resourceEditConfigMap.rules.buildPayload({
        name: 'Rule A',
        description: '',
        contentText: ''
      })
    ).toEqual({
      data: null,
      error: 'Content is required'
    });
  });

  it('MCP buildPayload 应解析 args/env 并在 command 为空时返回错误', () => {
    expect(
      resourceEditConfigMap.mcps.buildPayload({
        name: ' MCP A ',
        description: '',
        type: 'stdio',
        command: ' node ',
        argsText: 'server.js\n --debug \n',
        envEntries: [{ key: ' API_KEY ', value: 'secret' }]
      })
    ).toEqual({
      data: {
        name: 'MCP A',
        description: null,
        content: {
          type: 'stdio',
          command: 'node',
          args: ['server.js', '--debug'],
          env: {
            API_KEY: 'secret'
          }
        }
      },
      error: null
    });

    expect(
      resourceEditConfigMap.mcps.buildPayload({
        name: 'MCP A',
        command: '',
        argsText: '',
        envEntries: []
      })
    ).toEqual({
      data: null,
      error: 'Command is required'
    });
  });
});
