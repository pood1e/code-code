declare module 'node-notifier' {
  export type NotificationOptions = {
    title: string;
    message: string;
    subtitle?: string;
    wait?: boolean;
  };

  export type NotificationCallback = (error: Error | null) => void;

  const notifier: {
    notify(
      options: NotificationOptions,
      callback: NotificationCallback
    ): void;
  };

  export default notifier;
}
