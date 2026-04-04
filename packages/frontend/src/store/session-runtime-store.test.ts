import { beforeEach, describe, expect, it } from 'vitest';

import { useSessionRuntimeStore } from './session-runtime-store';

describe('session-runtime-store', () => {
  beforeEach(() => {
    useSessionRuntimeStore.setState({ stateBySessionId: {} });
  });

  it('应为指定 session 的消息创建和更新运行态', () => {
    useSessionRuntimeStore.getState().updateMessageState(
      'session-1',
      'message-1',
      (current) => ({
        ...(current ?? {}),
        thinkingText: '分析中'
      })
    );

    expect(
      useSessionRuntimeStore.getState().stateBySessionId['session-1']?.[
        'message-1'
      ]
    ).toEqual({
      thinkingText: '分析中'
    });

    useSessionRuntimeStore.getState().updateMessageState(
      'session-1',
      'message-1',
      (current) => ({
        ...(current ?? {}),
        outputText: '最终答案'
      })
    );

    expect(
      useSessionRuntimeStore.getState().stateBySessionId['session-1']?.[
        'message-1'
      ]
    ).toEqual({
      thinkingText: '分析中',
      outputText: '最终答案'
    });
  });

  it('清空指定 session 时不应影响其他 session', () => {
    useSessionRuntimeStore.setState({
      stateBySessionId: {
        'session-1': {
          'message-1': {
            thinkingText: '分析中'
          }
        },
        'session-2': {
          'message-2': {
            cancelledAt: '2026-04-04T10:00:00.000Z'
          }
        }
      }
    });

    useSessionRuntimeStore.getState().clearSessionState('session-1');

    expect(useSessionRuntimeStore.getState().stateBySessionId['session-1']).toEqual(
      {}
    );
    expect(useSessionRuntimeStore.getState().stateBySessionId['session-2']).toEqual(
      {
        'message-2': {
          cancelledAt: '2026-04-04T10:00:00.000Z'
        }
      }
    );
  });
});
