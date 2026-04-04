import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags
} from '@nestjs/swagger';

import { ResponseMessage } from '../../common/response-message.decorator';
import { apiRouteConfig } from '../api-route.config';
import {
  CreateProjectDto,
  ProjectQueryDto,
  UpdateProjectDto
} from './dto/project.dto';
import { ProjectsService } from './projects.service';
import { ApiWrappedErrorResponse } from '../../common/api-error-response.decorator';

@ApiTags('Projects')
@Controller(apiRouteConfig.projects.path)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'List projects' })
  @ApiQuery({ name: 'name', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Project list fetched.' })
  @ResponseMessage('Project list fetched')
  list(@Query() query: ProjectQueryDto) {
    return this.projectsService.list(query.name);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project detail' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Project detail fetched.' })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Project not found.',
    messageExample: 'Project not found: project_123'
  })
  @ResponseMessage('Project detail fetched')
  getById(@Param('id') id: string) {
    return this.projectsService.getById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a project' })
  @ApiResponse({ status: 201, description: 'Project created.' })
  @ApiWrappedErrorResponse({
    status: 400,
    description: 'Invalid project payload.',
    messageExample: 'workspacePath must be an absolute path'
  })
  @ResponseMessage('Project created')
  create(@Body() dto: CreateProjectDto) {
    return this.projectsService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a project' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Project updated.' })
  @ApiWrappedErrorResponse({
    status: 400,
    description: 'Invalid partial project payload.',
    messageExample: 'At least one project field must be provided'
  })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Project not found.',
    messageExample: 'Project not found: project_123'
  })
  @ResponseMessage('Project updated')
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete a project' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Project deleted.' })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Project not found.',
    messageExample: 'Project not found: project_123'
  })
  @ResponseMessage('Project deleted')
  remove(@Param('id') id: string) {
    return this.projectsService.remove(id);
  }
}
