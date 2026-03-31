import { Button, Card, Layout, Typography } from 'antd';

export function App() {
  return (
    <Layout className="app-shell">
      <Layout.Content className="app-shell__content">
        <Card className="hero-card">
          <Typography.Title level={1}>Agent Workbench</Typography.Title>
          <Typography.Paragraph>
            Frontend scaffold is ready.
          </Typography.Paragraph>
          <Button type="primary" href="http://localhost:3000/api/health">
            Check Backend Health
          </Button>
        </Card>
      </Layout.Content>
    </Layout>
  );
}

