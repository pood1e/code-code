import { PrismaClient } from '@prisma/client';

process.env.DATABASE_URL ??= 'file:./dev.db';

const prisma = new PrismaClient();

async function main() {
  await prisma.project.upsert({
    where: { id: 'project_agent_workbench' },
    update: {
      name: 'Agent Workbench',
      description: 'Current monorepo workspace for the personal tool.',
      gitUrl: 'git@github.com:pood1e/code-code.git',
      workspacePath: '/Users/pood1e/workspace/code-code'
    },
    create: {
      id: 'project_agent_workbench',
      name: 'Agent Workbench',
      description: 'Current monorepo workspace for the personal tool.',
      gitUrl: 'git@github.com:pood1e/code-code.git',
      workspacePath: '/Users/pood1e/workspace/code-code'
    }
  });

  await prisma.project.upsert({
    where: { id: 'project_workspace_root' },
    update: {
      name: 'Workspace Root',
      description: 'Parent workspace used for local development.',
      gitUrl: 'git@github.com:pood1e/workspace-root.git',
      workspacePath: '/Users/pood1e/workspace'
    },
    create: {
      id: 'project_workspace_root',
      name: 'Workspace Root',
      description: 'Parent workspace used for local development.',
      gitUrl: 'git@github.com:pood1e/workspace-root.git',
      workspacePath: '/Users/pood1e/workspace'
    }
  });

  await prisma.project.upsert({
    where: { id: 'project_home_sandbox' },
    update: {
      name: 'Home Sandbox',
      description: 'General-purpose local sandbox rooted at the user home.',
      gitUrl: 'git@github.com:pood1e/home-sandbox.git',
      workspacePath: '/Users/pood1e'
    },
    create: {
      id: 'project_home_sandbox',
      name: 'Home Sandbox',
      description: 'General-purpose local sandbox rooted at the user home.',
      gitUrl: 'git@github.com:pood1e/home-sandbox.git',
      workspacePath: '/Users/pood1e'
    }
  });

  const skillA = await prisma.skill.upsert({
    where: { id: 'skill_web_search' },
    update: {
      name: 'Web Search',
      description: 'Browse the public web for recent information.',
      content:
        '## Web Search\n\nUse web search when recent information is required.'
    },
    create: {
      id: 'skill_web_search',
      name: 'Web Search',
      description: 'Browse the public web for recent information.',
      content:
        '## Web Search\n\nUse web search when recent information is required.'
    }
  });

  const skillB = await prisma.skill.upsert({
    where: { id: 'skill_summarize' },
    update: {
      name: 'Summarize',
      description: 'Summarize long documents into concise output.',
      content:
        '## Summarize\n\nReturn concise bullet points for long documents.'
    },
    create: {
      id: 'skill_summarize',
      name: 'Summarize',
      description: 'Summarize long documents into concise output.',
      content:
        '## Summarize\n\nReturn concise bullet points for long documents.'
    }
  });

  await prisma.skill.upsert({
    where: { id: 'skill_code_review' },
    update: {
      name: 'Code Review',
      description: 'Review code for defects and missing tests.',
      content:
        '## Code Review\n\nReview for bugs, regressions, and missing tests. Include file references.'
    },
    create: {
      id: 'skill_code_review',
      name: 'Code Review',
      description: 'Review code for defects and missing tests.',
      content:
        '## Code Review\n\nReview for bugs, regressions, and missing tests. Include file references.'
    }
  });

  const mcpA = await prisma.mCP.upsert({
    where: { id: 'mcp_docs' },
    update: {
      name: 'Docs MCP',
      description: 'Read local markdown documents.',
      content: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', './docs'],
        env: {
          LOG_LEVEL: 'info'
        }
      }
    },
    create: {
      id: 'mcp_docs',
      name: 'Docs MCP',
      description: 'Read local markdown documents.',
      content: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', './docs'],
        env: {
          LOG_LEVEL: 'info'
        }
      }
    }
  });

  const mcpB = await prisma.mCP.upsert({
    where: { id: 'mcp_github' },
    update: {
      name: 'GitHub MCP',
      description: 'Query GitHub repositories and issues.',
      content: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        env: {
          GITHUB_TOKEN: 'demo-token'
        }
      }
    },
    create: {
      id: 'mcp_github',
      name: 'GitHub MCP',
      description: 'Query GitHub repositories and issues.',
      content: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        env: {
          GITHUB_TOKEN: 'demo-token'
        }
      }
    }
  });

  await prisma.mCP.upsert({
    where: { id: 'mcp_shell' },
    update: {
      name: 'Shell MCP',
      description: 'Run local shell commands.',
      content: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-shell'],
        env: {
          SANDBOX: 'workspace-write'
        }
      }
    },
    create: {
      id: 'mcp_shell',
      name: 'Shell MCP',
      description: 'Run local shell commands.',
      content: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-shell'],
        env: {
          SANDBOX: 'workspace-write'
        }
      }
    }
  });

  const ruleA = await prisma.rule.upsert({
    where: { id: 'rule_concise' },
    update: {
      name: 'Concise Reply',
      description: 'Prefer concise and direct answers.',
      content: '## Concise Reply\n\nPrefer short, direct answers.'
    },
    create: {
      id: 'rule_concise',
      name: 'Concise Reply',
      description: 'Prefer concise and direct answers.',
      content: '## Concise Reply\n\nPrefer short, direct answers.'
    }
  });

  await prisma.rule.upsert({
    where: { id: 'rule_cite' },
    update: {
      name: 'Cite Sources',
      description: 'Attach sources for claims that need verification.',
      content:
        '## Cite Sources\n\nAttach sources for claims that need verification.'
    },
    create: {
      id: 'rule_cite',
      name: 'Cite Sources',
      description: 'Attach sources for claims that need verification.',
      content:
        '## Cite Sources\n\nAttach sources for claims that need verification.'
    }
  });

  const ruleC = await prisma.rule.upsert({
    where: { id: 'rule_no_guessing' },
    update: {
      name: 'No Guessing',
      description: 'Check environment before making assumptions.',
      content:
        '## No Guessing\n\nInspect the environment before making assumptions.'
    },
    create: {
      id: 'rule_no_guessing',
      name: 'No Guessing',
      description: 'Check environment before making assumptions.',
      content:
        '## No Guessing\n\nInspect the environment before making assumptions.'
    }
  });

  const profile = await prisma.profile.upsert({
    where: { id: 'profile_default' },
    update: {
      name: 'Default Assistant',
      description: 'Balanced default profile for everyday work.'
    },
    create: {
      id: 'profile_default',
      name: 'Default Assistant',
      description: 'Balanced default profile for everyday work.'
    }
  });

  await prisma.$transaction([
    prisma.profileSkill.deleteMany({ where: { profileId: profile.id } }),
    prisma.profileMCP.deleteMany({ where: { profileId: profile.id } }),
    prisma.profileRule.deleteMany({ where: { profileId: profile.id } })
  ]);

  await prisma.profileSkill.createMany({
    data: [
      {
        profileId: profile.id,
        skillId: skillA.id,
        order: 0
      },
      {
        profileId: profile.id,
        skillId: skillB.id,
        order: 1
      }
    ]
  });

  await prisma.profileMCP.createMany({
    data: [
      {
        profileId: profile.id,
        mcpId: mcpA.id,
        order: 0,
        configOverride: {
          args: [
            '-y',
            '@modelcontextprotocol/server-filesystem',
            './docs/resource'
          ]
        }
      },
      {
        profileId: profile.id,
        mcpId: mcpB.id,
        order: 1,
        configOverride: {
          env: {
            GITHUB_TOKEN: 'profile-token'
          }
        }
      }
    ]
  });

  await prisma.profileRule.createMany({
    data: [
      {
        profileId: profile.id,
        ruleId: ruleA.id,
        order: 0
      },
      {
        profileId: profile.id,
        ruleId: ruleC.id,
        order: 1
      }
    ]
  });

  await prisma.agentRunner.upsert({
    where: { id: 'runner_dev' },
    update: {
      name: 'Dev Runner',
      description: 'Claude Code runner for development tasks',
      type: 'claude-code',
      runnerConfig: {
        model: 'claude-sonnet-4-5'
      }
    },
    create: {
      id: 'runner_dev',
      name: 'Dev Runner',
      description: 'Claude Code runner for development tasks',
      type: 'claude-code',
      runnerConfig: {
        model: 'claude-sonnet-4-5'
      }
    }
  });

  await prisma.agentRunner.upsert({
    where: { id: 'runner_prod' },
    update: {
      name: 'Production Runner',
      description: 'Claude Code runner for production tasks',
      type: 'claude-code',
      runnerConfig: {
        model: 'claude-opus-4-5',
        baseUrl: 'https://api.anthropic.com'
      }
    },
    create: {
      id: 'runner_prod',
      name: 'Production Runner',
      description: 'Claude Code runner for production tasks',
      type: 'claude-code',
      runnerConfig: {
        model: 'claude-opus-4-5',
        baseUrl: 'https://api.anthropic.com'
      }
    }
  });

  // 示例通道：结构化内部通知消息 -> 本地通知能力
  const exampleProjectId = 'project_agent_workbench';

  await prisma.notificationChannel.upsert({
    where: {
      uq_channel_scope_name: {
        scopeId: exampleProjectId,
        name: '会话完成通知'
      }
    },
    update: {},
    create: {
      scopeId: exampleProjectId,
      name: '会话完成通知',
      capabilityId: 'local-notification',
      config: {},
      filter: { messageTypes: ['session.completed'] },
      enabled: true
    }
  });

  await prisma.notificationChannel.upsert({
    where: {
      uq_channel_scope_name: {
        scopeId: exampleProjectId,
        name: '会话异常告警'
      }
    },
    update: {},
    create: {
      scopeId: exampleProjectId,
      name: '会话异常告警',
      capabilityId: 'local-notification',
      config: {},
      filter: {
        messageTypes: ['session.failed', 'session.*'],
        conditions: [{ field: 'severity', operator: 'In', values: ['critical', 'high'] }]
      },
      enabled: true
    }
  });

  console.log('Seed completed');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
