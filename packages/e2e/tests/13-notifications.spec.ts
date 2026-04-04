import { expect, test, type Page } from '@playwright/test';

import { cleanupTestData, seedProject } from './helpers';

async function openProjectNavigation(page: Page, isMobile: boolean) {
  if (!isMobile) {
    return page.getByRole('complementary');
  }

  await page.getByRole('button', { name: '打开导航菜单' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  return dialog;
}

async function createLocalNotificationChannel(
  page: Page,
  projectId: string,
  input: {
    name: string;
    filterJson: string;
  }
) {
  await page.goto(`/projects/${projectId}/channels`);
  await page.getByRole('button', { name: '新建通道' }).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  await dialog.getByLabel('名称').fill(input.name);
  await dialog.getByLabel('消息过滤器（JSON）').fill(input.filterJson);
  await dialog.getByRole('button', { name: '创建' }).click();

  await expect(dialog).not.toBeVisible();
  await expect(page.getByText(input.name, { exact: true })).toBeVisible();
}

async function openNotificationSendPageByNavigation(
  page: Page,
  projectId: string,
  isMobile: boolean
) {
  await page.goto(`/projects/${projectId}/dashboard`);

  const navigation = await openProjectNavigation(page, isMobile);
  await navigation.getByRole('button', { name: '手工发送' }).click();
  await expect(page).toHaveURL(`/projects/${projectId}/send`);
}

async function waitForNotificationRowToSettle(
  page: Page,
  messageTitle: string
): Promise<'成功' | '失败'> {
  const historyRow = page
    .getByRole('row')
    .filter({ has: page.getByText(messageTitle, { exact: true }) });
  let settledStatus: '成功' | '失败' | null = null;

  await expect(historyRow).toBeVisible();
  await expect
    .poll(
      async () => {
        await page.getByRole('button', { name: '刷新' }).click();

        if (await historyRow.getByText('成功').count()) {
          settledStatus = '成功';
          return true;
        }

        if (await historyRow.getByText('失败').count()) {
          settledStatus = '失败';
          return true;
        }

        return false;
      },
      {
        timeout: 15000,
        message: `等待通知「${messageTitle}」进入终态`
      }
    )
    .toBe(true);

  return settledStatus!;
}

test.describe('Notifications 通知旅程', () => {
  test.beforeAll(async () => {
    await cleanupTestData();
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test('Project 导航中应展示通知相关三个入口，并能切到对应页面', async ({
    page,
    isMobile
  }) => {
    const project = await seedProject('Notifications Navigation Project');

    await page.goto(`/projects/${project.id}/dashboard`);

    const navigation = await openProjectNavigation(page, isMobile);
    await expect(
      navigation.getByRole('button', { name: '通知渠道' })
    ).toBeVisible();
    await expect(
      navigation.getByRole('button', { name: '手工发送' })
    ).toBeVisible();
    await expect(
      navigation.getByRole('button', { name: '通知记录' })
    ).toBeVisible();

    await navigation.getByRole('button', { name: '通知渠道' }).click();
    await expect(page).toHaveURL(`/projects/${project.id}/channels`);

    const reopenedNavigation = await openProjectNavigation(page, isMobile);
    await reopenedNavigation.getByRole('button', { name: '通知记录' }).click();
    await expect(page).toHaveURL(`/projects/${project.id}/notifications`);
  });

  test('通知渠道页应能创建本地通道，并在重名时展示冲突错误', async ({
    page
  }) => {
    const project = await seedProject('Notifications Channel Project');
    const channelName = 'E2E 本地通知通道';

    await createLocalNotificationChannel(page, project.id, {
      name: channelName,
      filterJson: '{"messageTypes":["manual.test"]}'
    });

    await page.getByRole('button', { name: '新建通道' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await dialog.getByLabel('名称').fill(channelName);
    await dialog.getByLabel('消息过滤器（JSON）').fill(
      '{"messageTypes":["manual.test"]}'
    );
    await dialog.getByRole('button', { name: '创建' }).click();

    await expect(dialog.getByText(/已存在同名通知通道/)).toBeVisible();
  });

  test('手工发送页 metadata 非法时应阻止提交并展示表单错误', async ({
    page,
    isMobile
  }) => {
    const project = await seedProject('Notifications Validation Project');

    await openNotificationSendPageByNavigation(page, project.id, isMobile);

    await page.getByRole('textbox', { name: '消息标题' }).fill('非法 metadata 测试');
    await page.getByRole('textbox', { name: '消息内容' }).fill('这里不会真正发送。');
    await page.getByRole('textbox', { name: 'Metadata（JSON）' }).fill('[]');

    await page.getByRole('button', { name: '发送消息' }).click();

    await expect(
      page.getByText('必须是合法 JSON，且顶层必须是对象')
    ).toBeVisible();
    await expect(page.getByText('发送失败')).toHaveCount(0);
  });

  test('创建通道后，手工发送匹配消息应生成任务，并能在通知记录页看到结果', async ({
    page
  }) => {
    const project = await seedProject('Notifications Delivery Project');
    const messageTitle = 'E2E 手工发送成功路径';

    await createLocalNotificationChannel(page, project.id, {
      name: 'E2E 发送通道',
      filterJson: '{"messageTypes":["manual.test"]}'
    });

    await page.goto(`/projects/${project.id}/send`);
    await page.getByRole('textbox', { name: '消息标题' }).fill(messageTitle);
    await page.getByRole('textbox', { name: '消息内容' }).fill('这是一条来自 E2E 的通知消息。');
    await page
      .getByRole('textbox', { name: 'Metadata（JSON）' })
      .fill('{"source":"e2e","case":"matched"}');
    await page.getByRole('button', { name: '发送消息' }).click();

    await expect(page.getByText('发送成功')).toBeVisible();
    await expect(page.getByText(/已命中 1 个通道/)).toBeVisible();

    await page.getByRole('button', { name: '查看记录' }).click();
    await expect(page).toHaveURL(`/projects/${project.id}/notifications`);
    await expect(page.getByText(messageTitle)).toBeVisible();
    await expect(page.getByText('manual.test')).toBeVisible();
  });

  test('没有命中任何通道时，应提示未生成任务并引导用户调整通道配置', async ({
    page
  }) => {
    const project = await seedProject('Notifications No Match Project');

    await createLocalNotificationChannel(page, project.id, {
      name: 'E2E 不匹配通道',
      filterJson: '{"messageTypes":["session.*"]}'
    });

    await page.goto(`/projects/${project.id}/send`);
    await page.getByRole('textbox', { name: '消息标题' }).fill('E2E 未命中消息');
    await page.getByRole('textbox', { name: '消息内容' }).fill('这条消息不会命中已有通道。');
    await page
      .getByRole('textbox', { name: 'Metadata（JSON）' })
      .fill('{"source":"e2e","case":"no-match"}');
    await page.getByRole('button', { name: '发送消息' }).click();

    await expect(page.getByText('未命中任何通道', { exact: true })).toBeVisible();
    await expect(
      page.getByText(
        '本次消息已被系统接收，但当前没有命中任何启用中的通道，因此没有生成通知任务。'
      )
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: '前往通知渠道' })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: '查看记录' })
    ).toHaveCount(0);

    await page.getByRole('button', { name: '前往通知渠道' }).click();
    await expect(page).toHaveURL(`/projects/${project.id}/channels`);

    await page.goto(`/projects/${project.id}/notifications`);
    await expect(page.getByText('暂无通知记录')).toBeVisible();
  });

  test('已有历史记录但没有活跃任务时，应允许删除通道且保留通知记录', async ({
    page
  }) => {
    const project = await seedProject('Notifications Channel Delete Project');
    const channelName = 'E2E 可删除历史通道';

    await createLocalNotificationChannel(page, project.id, {
      name: channelName,
      filterJson: '{"messageTypes":["manual.test"]}'
    });

    await page.goto(`/projects/${project.id}/send`);
    await page.getByRole('textbox', { name: '消息标题' }).fill('E2E 删除保护消息');
    await page.getByRole('textbox', { name: '消息内容' }).fill('先生成历史，再尝试删除通道。');
    await page
      .getByRole('textbox', { name: 'Metadata（JSON）' })
      .fill('{"source":"e2e","case":"delete-guard"}');
    await page.getByRole('button', { name: '发送消息' }).click();
    await expect(page.getByText('发送成功')).toBeVisible();

    await page.getByRole('button', { name: '查看记录' }).click();
    await expect(page).toHaveURL(`/projects/${project.id}/notifications`);
    await waitForNotificationRowToSettle(page, 'E2E 删除保护消息');

    await page.goto(`/projects/${project.id}/channels`);
    await page.getByRole('button', { name: `删除通道 ${channelName}` }).click();

    const dialog = page.getByRole('alertdialog').or(page.getByRole('dialog'));
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: '删除' }).click();

    await expect(dialog).not.toBeVisible();
    await expect(page.getByText(channelName, { exact: true })).toHaveCount(0);

    await page.goto(`/projects/${project.id}/notifications`);
    const historyRow = page
      .getByRole('row')
      .filter({ has: page.getByText('E2E 删除保护消息', { exact: true }) });
    await expect(historyRow).toBeVisible();
    await expect(historyRow.getByText(channelName, { exact: true })).toBeVisible();
    await expect(historyRow.getByText('已删除', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('button', { name: '重试通知任务 E2E 删除保护消息' })
    ).toHaveCount(0);
  });
});
