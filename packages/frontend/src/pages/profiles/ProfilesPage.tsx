import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { useNavigate } from 'react-router-dom';

import {
  createProfile,
  deleteProfile,
  listProfiles
} from '../../api/profiles';
import { useErrorMessage } from '../../api/client';
import { queryKeys } from '../../query/query-keys';
import { profileInputSchema } from '@agent-workbench/shared';

type ProfileFormValues = {
  name: string;
  description?: string;
};

export function ProfilesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const handleError = useErrorMessage();
  const [form] = Form.useForm<ProfileFormValues>();
  const [open, setOpen] = useState(false);

  const profilesQuery = useQuery({
    queryKey: queryKeys.profiles.list(),
    queryFn: listProfiles
  });

  useEffect(() => {
    if (profilesQuery.error) {
      handleError(profilesQuery.error);
    }
  }, [handleError, profilesQuery.error]);

  const createMutation = useMutation({
    mutationFn: createProfile,
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.profiles.list()
      });
      setOpen(false);
      form.resetFields();
      void navigate(`/profiles/${created.id}/edit`);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProfile,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.profiles.list()
      });
    }
  });

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteMutation.mutateAsync(id);
      } catch (error) {
        handleError(error);
      }
    },
    [deleteMutation, handleError]
  );

  const openCreateModal = () => {
    form.resetFields();
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
      await createMutation.mutateAsync(parsed.data);
    } catch (error) {
      handleError(error);
    }
  };
  const items = profilesQuery.data ?? [];
  const loading =
    profilesQuery.isPending ||
    profilesQuery.isFetching ||
    createMutation.isPending ||
    deleteMutation.isPending;

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
                <Button onClick={() => void navigate(`/profiles/${record.id}/edit`)}>
                  Edit
                </Button>
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
        title="New Profile"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => void submit()}
        okText="Create"
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
