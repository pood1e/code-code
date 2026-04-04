import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

type JsonSchema = Record<string, unknown>;

type ApiWrappedErrorResponseOptions = {
  status: number;
  description: string;
  messageExample: string;
  dataSchema?: JsonSchema;
};

export function ApiWrappedErrorResponse(
  options: ApiWrappedErrorResponseOptions
) {
  const { status, description, messageExample, dataSchema } = options;

  return applyDecorators(
    ApiResponse({
      status,
      description,
      schema: {
        type: 'object',
        properties: {
          code: {
            type: 'number',
            example: status
          },
          message: {
            type: 'string',
            example: messageExample
          },
          data: dataSchema ?? {
            nullable: true,
            example: null
          }
        },
        required: ['code', 'message', 'data']
      }
    })
  );
}
