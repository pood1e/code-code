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
import {
  ResourceSearchQueryDto,
  RuleMutationDto
} from '../../dto/resource.dto';
import { apiRouteConfig } from '../api-route.config';
import { RulesService } from './rules.service';

@ApiTags('Rules')
@Controller(apiRouteConfig.rules.path)
export class RulesController {
  private readonly rulesService: RulesService;

  constructor(rulesService: RulesService) {
    this.rulesService = rulesService;
  }

  @Get()
  @ApiOperation({ summary: 'List rules' })
  @ApiQuery({ name: 'name', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Rule list fetched.' })
  @ResponseMessage('Rule list fetched')
  list(@Query() query: ResourceSearchQueryDto) {
    return this.rulesService.list(query.name);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get rule detail' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Rule detail fetched.' })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Rule not found.',
    messageExample: 'Rule not found: rule_123'
  })
  @ResponseMessage('Rule detail fetched')
  getById(@Param('id') id: string) {
    return this.rulesService.getById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create rule' })
  @ApiResponse({ status: 201, description: 'Rule created.' })
  @ApiWrappedErrorResponse({
    status: 400,
    description: 'Invalid rule payload.',
    messageExample: 'Invalid rule payload'
  })
  @ResponseMessage('Rule created')
  create(@Body() dto: RuleMutationDto) {
    return this.rulesService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update rule' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Rule updated.' })
  @ApiWrappedErrorResponse({
    status: 400,
    description: 'Invalid rule payload.',
    messageExample: 'Invalid rule payload'
  })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Rule not found.',
    messageExample: 'Rule not found: rule_123'
  })
  @ResponseMessage('Rule updated')
  update(@Param('id') id: string, @Body() dto: RuleMutationDto) {
    return this.rulesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete rule' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Rule deleted.' })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Rule not found.',
    messageExample: 'Rule not found: rule_123'
  })
  @ApiWrappedErrorResponse({
    status: 409,
    description: 'Rule is still referenced by existing profiles.',
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
  @ResponseMessage('Rule deleted')
  remove(@Param('id') id: string) {
    return this.rulesService.remove(id);
  }
}
