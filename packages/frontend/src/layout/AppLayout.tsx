import {
  DatabaseOutlined,
  FolderOpenOutlined,
  ProfileOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { Button, Layout, Menu, Space } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { useUiStore } from '../store/ui-store';

const { Content, Sider } = Layout;

const resourceSections = [
  {
    key: '/skills',
    icon: <SettingOutlined />,
    label: 'Skills'
  },
  {
    key: '/mcps',
    icon: <DatabaseOutlined />,
    label: 'MCPs'
  },
  {
    key: '/rules',
    icon: <FolderOpenOutlined />,
    label: 'Rules'
  },
  {
    key: '/profiles',
    icon: <ProfileOutlined />,
    label: 'Profiles'
  }
] as const;

const menuItems = [
  {
    key: '/skills',
    icon: <SettingOutlined />,
    label: '资源管理'
  }
];

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const setCollapsed = useUiStore((state) => state.setSidebarCollapsed);

  const selectedKey =
    location.pathname.startsWith('/skills') ||
    location.pathname.startsWith('/mcps') ||
    location.pathname.startsWith('/rules') ||
    location.pathname.startsWith('/profiles')
      ? '/skills'
      : '/skills';
  const sectionKey =
    resourceSections.find((item) => location.pathname.startsWith(item.key))
      ?.key ?? '/skills';
  const showResourceSwitcher = selectedKey === '/skills';

  return (
    <Layout className="app-shell">
      <Sider
        breakpoint="lg"
        collapsed={collapsed}
        collapsible
        onCollapse={setCollapsed}
        className="app-shell__sider"
      >
        <div className="app-shell__brand">
          <h1>Agent Workbench</h1>
          {!collapsed ? <p>资源管理</p> : null}
        </div>
        <Menu
          mode="inline"
          theme="dark"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => {
            void navigate(key);
          }}
        />
      </Sider>
      <Layout>
        <Content className="app-shell__content">
          {showResourceSwitcher ? (
            <div className="content-switcher">
              <div className="content-switcher__label">资源</div>
              <Space wrap size={12}>
                {resourceSections.map((item) => (
                  <Button
                    key={item.key}
                    type={sectionKey === item.key ? 'primary' : 'default'}
                    icon={item.icon}
                    onClick={() => {
                      void navigate(item.key);
                    }}
                  >
                    {item.label}
                  </Button>
                ))}
              </Space>
            </div>
          ) : null}
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
