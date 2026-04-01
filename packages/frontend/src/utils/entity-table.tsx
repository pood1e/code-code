import { Modal, Tag } from 'antd';

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

export function renderNullableDescription(value: string | null) {
  return value ?? <Tag color="default">-</Tag>;
}

export function confirmEntityDelete(
  entityName: string,
  onConfirm: () => void
) {
  Modal.confirm({
    title: `Delete ${entityName}?`,
    content: '删除后不可恢复。',
    okButtonProps: { danger: true },
    onOk: () => {
      onConfirm();
    }
  });
}
