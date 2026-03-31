import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Typography
} from 'antd';
import type { Profile } from '@agent-workbench/shared';

import {
  createProfile,
  deleteProfile,
  listProfiles,
  updateProfile
} from '../../api/profiles';
import { useErrorMessage } from '../../api/client';
import { profileInputSchema } from '@agent-workbench/shared';

type ProfileFormValues = {
  name: string;
  description?: string;
};

export function ProfilesPage() {
  const handleError = useErrorMessage();
  const [form] = Form.useForm<ProfileFormValues>();
  const [items, setItems] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listProfiles());
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteProfile(id);
        await fetchProfiles();
      } catch (error) {
        handleError(error);
      }
    },
    [fetchProfiles, handleError]
  );

  useEffect(() => {
    void fetchProfiles();
  }, [fetchProfiles]);

  const openCreateModal = () => {
    setEditing(null);
    form.resetFields();
    setOpen(true);
  };

  const openEditModal = (profile: Profile) => {
    setEditing(profile);
    form.setFieldsValue({
      name: profile.name,
      description: profile.description ?? ''
    });
    setOpen(true);
  };

  const submit = async () => {
    const values = await form.validateFields();
    const parsed = profileInputSchema.safeParse({
      name: values.name,
      description: values.description?.trim() ? values.description.trim() : null
    });

    if (!parsed.success) {
      handleError({
        code: 400,
        message: parsed.error.issues[0]?.message ?? 'Invalid form data',
        data: null
      });
      return;
    }

    try {
      if (editing) {
        await updateProfile(editing.id, parsed.data);
      } else {
        await createProfile(parsed.data);
      }
      setOpen(false);
      await fetchProfiles();
    } catch (error) {
      handleError(error);
    }
  };

  return (
    <Card className="page-card">
      <div className="page-card__header">
        <div>
          <Typography.Title level={2} className="page-card__title">
            Profiles
          </Typography.Title>
          <Typography.Paragraph className="page-card__description">
            配置列表
          </Typography.Paragraph>
        </div>
        <Button type="primary" onClick={openCreateModal}>
          New Profile
        </Button>
      </div>

      <Table<Profile>
        rowKey="id"
        loading={loading}
        dataSource={items}
        locale={{ emptyText: '暂无数据' }}
        pagination={{ pageSize: 8 }}
        columns={[
          {
            title: 'Name',
            dataIndex: 'name'
          },
          {
            title: 'Description',
            dataIndex: 'description',
            render: (value: string | null) =>
              value ?? <Tag color="default">-</Tag>
          },
          {
            title: 'Updated At',
            dataIndex: 'updatedAt',
            render: (value: string) => new Date(value).toLocaleString()
          },
          {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
              <Space>
                <Button onClick={() => openEditModal(record)}>Edit</Button>
                <Button
                  danger
                  onClick={() => {
                    Modal.confirm({
                      title: `Delete ${record.name}?`,
                      content: '删除后不可恢复。',
                      okButtonProps: { danger: true },
                      onOk: () => {
                        void handleDelete(record.id);
                      }
                    });
                  }}
                >
                  Delete
                </Button>
              </Space>
            )
          }
        ]}
      />

      <Modal
        title={editing ? 'Edit Profile' : 'Create Profile'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => void submit()}
        okText="Save"
      >
        <Form<ProfileFormValues> layout="vertical" form={form}>
          <Form.Item
            label="Name"
            name="name"
            rules={[{ required: true, message: 'Profile name is required' }]}
          >
            <Input placeholder="Profile name" />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={3} placeholder="描述" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
