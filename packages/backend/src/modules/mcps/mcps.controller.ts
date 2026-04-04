import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags
} from '@nestjs/swagger';

import { ApiWrappedErrorResponse } from '../../common/api-error-response.decorator';
import { ResponseMessage } from '../../common/response-message.decorator';
import { McpMutationDto, ResourceSearchQueryDto } from '../../dto/resource.dto';
import { apiRouteConfig } from '../api-route.config';
import { McpsService } from './mcps.service';

@ApiTags('MCPs')
@Controller(apiRouteConfig.mcps.path)
export class McpsController {
  private readonly mcpsService: McpsService;

  constructor(mcpsService: McpsService) {
    this.mcpsService = mcpsService;
  }

  @Get()
  @ApiOperation({ summary: 'List MCPs' })
  @ApiQuery({ name: 'name', required: false, type: String })
  @ApiResponse({ status: 200, description: 'MCP list fetched.' })
  @ResponseMessage('MCP list fetched')
  list(@Query() query: ResourceSearchQueryDto) {
    return this.mcpsService.list(query.name);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get MCP detail' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'MCP detail fetched.' })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'MCP not found.',
    messageExample: 'MCP not found: mcp_123'
  })
  @ResponseMessage('MCP detail fetched')
  getById(@Param('id') id: string) {
    return this.mcpsService.getById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create MCP' })
  @ApiResponse({ status: 201, description: 'MCP created.' })
  @ApiWrappedErrorResponse({
    status: 400,
    description: 'Invalid MCP payload.',
    messageExample: 'Invalid MCP payload'
  })
  @ResponseMessage('MCP created')
  create(@Body() dto: McpMutationDto) {
    return this.mcpsService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update MCP' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'MCP updated.' })
  @ApiWrappedErrorResponse({
    status: 400,
    description: 'Invalid MCP payload.',
    messageExample: 'Invalid MCP payload'
  })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'MCP not found.',
    messageExample: 'MCP not found: mcp_123'
  })
  @ResponseMessage('MCP updated')
  update(@Param('id') id: string, @Body() dto: McpMutationDto) {
    return this.mcpsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete MCP' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'MCP deleted.' })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'MCP not found.',
    messageExample: 'MCP not found: mcp_123'
  })
  @ApiWrappedErrorResponse({
    status: 409,
    description: 'MCP is still referenced by existing profiles.',
    messageExample: '该资源被以下 Profile 引用，无法删除',
    dataSchema: {
      type: 'object',
      properties: {
        referencedBy: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'profile_123' },
              name: { type: 'string', example: 'Using Profile' }
            },
            required: ['id', 'name']
          }
        }
      },
      required: ['referencedBy']
    }
  })
  @ResponseMessage('MCP deleted')
  remove(@Param('id') id: string) {
    return this.mcpsService.remove(id);
  }
}
