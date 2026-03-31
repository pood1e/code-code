import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Typography
} from 'antd';
import type { ResourceKind, ResourceRecord } from '@agent-workbench/shared';
import { useNavigate } from 'react-router-dom';

import {
  ApiRequestError,
  showReferencedProfilesModal,
  useErrorMessage
} from '../../api/client';
import { deleteResource, listResources } from '../../api/resources';
import { useUiStore } from '../../store/ui-store';
import { resourceConfigMap } from '../../types/resources';

type ResourceListPageProps = {
  kind: ResourceKind;
};

export function ResourceListPage({ kind }: ResourceListPageProps) {
  const navigate = useNavigate();
  const handleError = useErrorMessage();
  const searchValue = useUiStore((state) => state.resourceSearch[kind]);
  const setSearchValue = useUiStore((state) => state.setResourceSearch);
  const [items, setItems] = useState<ResourceRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const config = resourceConfigMap[kind];

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listResources(kind, searchValue || undefined);
      setItems(data);
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  }, [handleError, kind, searchValue]);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteResource(kind, id);
        await fetchItems();
      } catch (error) {
        if (error instanceof ApiRequestError && error.code === 409) {
          showReferencedProfilesModal(error);
          return;
        }

        handleError(error);
      }
    },
    [fetchItems, handleError, kind]
  );

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  return (
    <Card className="page-card">
      <div className="page-card__header">
        <div>
          <Typography.Title level={2} className="page-card__title">
            {config.pluralLabel}
          </Typography.Title>
          <Typography.Paragraph className="page-card__description">
            资源列表
          </Typography.Paragraph>
        </div>
        <Button
          type="primary"
          onClick={() => void navigate(`${config.path}/new`)}
        >
          New {config.singularLabel}
        </Button>
      </div>

      <Space style={{ marginBottom: 16 }}>
        <Input.Search
          allowClear
          placeholder="按名称搜索"
          value={searchValue}
          onChange={(event) => setSearchValue(kind, event.target.value)}
          onSearch={() => {
            void fetchItems();
          }}
          style={{ width: 320 }}
        />
        <Button onClick={() => void fetchItems()}>Refresh</Button>
      </Space>

      <Table<ResourceRecord>
        rowKey="id"
        loading={loading}
        dataSource={items}
        locale={{ emptyText: config.emptyState }}
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
                <Button
                  onClick={() =>
                    void navigate(`${config.path}/${record.id}/edit`)
                  }
                >
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
    </Card>
  );
}
