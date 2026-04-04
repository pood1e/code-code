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
  ApiResponse,
  ApiTags,
  ApiQuery,
  ApiParam
} from '@nestjs/swagger';

import { ApiWrappedErrorResponse } from '../../common/api-error-response.decorator';
import { ResponseMessage } from '../../common/response-message.decorator';
import {
  ResourceSearchQueryDto,
  SkillMutationDto
} from '../../dto/resource.dto';
import { apiRouteConfig } from '../api-route.config';
import { SkillsService } from './skills.service';

@ApiTags('Skills')
@Controller(apiRouteConfig.skills.path)
export class SkillsController {
  private readonly skillsService: SkillsService;

  constructor(skillsService: SkillsService) {
    this.skillsService = skillsService;
  }

  @Get()
  @ApiOperation({ summary: 'List skills' })
  @ApiQuery({ name: 'name', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Skill list fetched.' })
  @ResponseMessage('Skill list fetched')
  list(@Query() query: ResourceSearchQueryDto) {
    return this.skillsService.list(query.name);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get skill detail' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Skill detail fetched.' })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Skill not found.',
    messageExample: 'Skill not found: skill_123'
  })
  @ResponseMessage('Skill detail fetched')
  getById(@Param('id') id: string) {
    return this.skillsService.getById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a skill' })
  @ApiResponse({ status: 201, description: 'Skill created.' })
  @ApiWrappedErrorResponse({
    status: 400,
    description: 'Invalid skill payload.',
    messageExample: 'Invalid skill payload'
  })
  @ResponseMessage('Skill created')
  create(@Body() dto: SkillMutationDto) {
    return this.skillsService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a skill' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Skill updated.' })
  @ApiWrappedErrorResponse({
    status: 400,
    description: 'Invalid skill payload.',
    messageExample: 'Invalid skill payload'
  })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Skill not found.',
    messageExample: 'Skill not found: skill_123'
  })
  @ResponseMessage('Skill updated')
  update(@Param('id') id: string, @Body() dto: SkillMutationDto) {
    return this.skillsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete a skill' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Skill deleted.' })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Skill not found.',
    messageExample: 'Skill not found: skill_123'
  })
  @ApiWrappedErrorResponse({
    status: 409,
    description: 'Skill is still referenced by existing profiles.',
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
  @ResponseMessage('Skill deleted')
  remove(@Param('id') id: string) {
    return this.skillsService.remove(id);
  }
}
