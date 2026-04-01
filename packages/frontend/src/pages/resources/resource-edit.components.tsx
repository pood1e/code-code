import { Alert, Button, Form, Input, Result, Space, Typography } from 'antd';

import { CodeEditor } from '../../components/JsonEditor';
import { resourceConfigMap } from '../../types/resources';

type ResourceEditHeaderProps = {
  title: string;
  loading: boolean;
  onBack: () => void;
  onSave: () => void;
};

type MarkdownContentFieldProps = {
  value: string;
  onChange: (value: string) => void;
};

type McpContentFieldsProps = {
  preview: string;
};

type ResourceNotFoundStateProps = {
  kind: keyof typeof resourceConfigMap;
  onBack: () => void;
};

export function ResourceEditHeader({
  title,
  loading,
  onBack,
  onSave
}: ResourceEditHeaderProps) {
  return (
    <div className="page-card__header">
      <div>
        <Typography.Title level={2} className="page-card__title">
          {title}
        </Typography.Title>
        <Typography.Paragraph className="page-card__description">
          编辑内容
        </Typography.Paragraph>
      </div>
      <Space>
        <Button onClick={onBack}>Back</Button>
        <Button type="primary" onClick={onSave} loading={loading}>
          Save
        </Button>
      </Space>
    </div>
  );
}

export function MarkdownContentField({
  value,
  onChange
}: MarkdownContentFieldProps) {
  return (
    <Form.Item label="Content" name="contentText">
      <CodeEditor value={value} onChange={onChange} mode="markdown" />
    </Form.Item>
  );
}

export function McpContentFields({
  preview
}: McpContentFieldsProps) {
  return (
    <>
      <Form.Item label="Type" name="type" initialValue="stdio">
        <Input disabled />
      </Form.Item>
      <Form.Item
        label="Command"
        name="command"
        rules={[
          {
            required: true,
            whitespace: true,
            message: 'Command is required'
          }
        ]}
      >
        <Input placeholder="npx" />
      </Form.Item>
      <Form.List name="args">
        {(fields, { add, remove }) => (
          <Form.Item label="Args">
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              {fields.map((field) => (
                <Space
                  key={field.key}
                  style={{ display: 'flex' }}
                  align="start"
                >
                  <Form.Item
                    {...field}
                    style={{ marginBottom: 0, minWidth: 320 }}
                    rules={[
                      {
                        required: true,
                        whitespace: true,
                        message: 'Argument is required'
                      }
                    ]}
                  >
                    <Input placeholder="Argument" />
                  </Form.Item>
                  <Button onClick={() => remove(field.name)}>Remove</Button>
                </Space>
              ))}
              <Button onClick={() => add('')}>Add Arg</Button>
            </Space>
          </Form.Item>
        )}
      </Form.List>
      <Form.List name="envEntries">
        {(fields, { add, remove }) => (
          <Form.Item label="Env">
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              {fields.map((field) => (
                <Space
                  key={field.key}
                  style={{ display: 'flex' }}
                  align="start"
                >
                  <Form.Item
                    name={[field.name, 'key']}
                    style={{ marginBottom: 0, minWidth: 200 }}
                  >
                    <Input placeholder="KEY" />
                  </Form.Item>
                  <Form.Item
                    name={[field.name, 'value']}
                    style={{ marginBottom: 0, minWidth: 240 }}
                  >
                    <Input placeholder="VALUE" />
                  </Form.Item>
                  <Button onClick={() => remove(field.name)}>Remove</Button>
                </Space>
              ))}
              <Button onClick={() => add({ key: '', value: '' })}>Add Env</Button>
            </Space>
          </Form.Item>
        )}
      </Form.List>
      <Form.Item label="JSON Preview">
        <CodeEditor
          value={preview}
          onChange={() => undefined}
          readOnly
          mode="json"
        />
      </Form.Item>
    </>
  );
}

export function ResourceEditError({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }

  return <Alert type="error" showIcon message={message} />;
}

export function ResourceNotFoundState({
  kind,
  onBack
}: ResourceNotFoundStateProps) {
  return (
    <Result
      status="404"
      title={`${resourceConfigMap[kind].singularLabel} not found`}
      subTitle="当前资源不存在或已被删除。"
      extra={<Button onClick={onBack}>Back</Button>}
    />
  );
}
