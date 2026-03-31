export type ApiResponse<T> = {
  data: T;
  message: string;
  code: number;
};
