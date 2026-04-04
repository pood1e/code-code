import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Res
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags
} from '@nestjs/swagger';

import { PipelineStatus } from '@agent-workbench/shared';

import { ApiWrappedErrorResponse } from '../../common/api-error-response.decorator';
import { ResponseMessage } from '../../common/response-message.decorator';
import { SkipApiResponse } from '../../common/skip-api-response.decorator';
import { apiRouteConfig } from '../api-route.config';
import {
  CreatePipelineDto,
  PipelineQueryDto,
  UpdatePipelineDto
} from './dto/pipeline.dto';
import { PipelineQueryService } from './pipeline-query.service';
import { PipelinesService } from './pipelines.service';

@ApiTags('Pipelines')
@Controller(apiRouteConfig.pipelines.path)
export class PipelinesController {
  constructor(
    private readonly pipelinesService: PipelinesService,
    private readonly pipelineQueryService: PipelineQueryService
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a pipeline' })
  @ApiResponse({ status: 201, description: 'Pipeline created.' })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Project not found.',
    messageExample: 'Project not found: project_123'
  })
  @ResponseMessage('Pipeline created')
  create(@Body() dto: CreatePipelineDto) {
    return this.pipelinesService.create({
      scopeId: dto.scopeId,
      name: dto.name,
      description: dto.description,
      featureRequest: dto.featureRequest
    });
  }

  @Get()
  @ApiOperation({ summary: 'List pipelines' })
  @ApiQuery({ name: 'scopeId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: PipelineStatus })
  @ApiResponse({ status: 200, description: 'Pipeline list fetched.' })
  @ResponseMessage('Pipeline list fetched')
  list(@Query() query: PipelineQueryDto) {
    return this.pipelineQueryService.list(query.scopeId, query.status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get pipeline detail' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Pipeline detail fetched.' })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Pipeline not found.',
    messageExample: 'Pipeline not found: pipeline_123'
  })
  @ResponseMessage('Pipeline detail fetched')
  getById(@Param('id') id: string) {
    return this.pipelineQueryService.getById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a pipeline' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Pipeline updated.' })
  @ApiWrappedErrorResponse({
    status: 400,
    description: 'No update fields provided.',
    messageExample: 'At least one pipeline field must be provided'
  })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Pipeline not found.',
    messageExample: 'Pipeline not found: pipeline_123'
  })
  @ResponseMessage('Pipeline updated')
  update(@Param('id') id: string, @Body() dto: UpdatePipelineDto) {
    return this.pipelinesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete a pipeline' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Pipeline deleted.' })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Pipeline not found.',
    messageExample: 'Pipeline not found: pipeline_123'
  })
  @ResponseMessage('Pipeline deleted')
  delete(@Param('id') id: string) {
    return this.pipelinesService.delete(id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel a running pipeline' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Pipeline cancelled.' })
  @ApiWrappedErrorResponse({
    status: 400,
    description: 'Pipeline is already in terminal state.',
    messageExample: 'Pipeline is already in terminal state: completed'
  })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Pipeline not found.',
    messageExample: 'Pipeline not found: pipeline_123'
  })
  @ResponseMessage('Pipeline cancelled')
  cancel(@Param('id') id: string) {
    return this.pipelinesService.cancel(id);
  }

  @Get(':id/stages')
  @ApiOperation({ summary: 'List pipeline stages' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Pipeline stages fetched.' })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Pipeline not found.',
    messageExample: 'Pipeline not found: pipeline_123'
  })
  @ResponseMessage('Pipeline stages fetched')
  listStages(@Param('id') id: string) {
    return this.pipelineQueryService.getStagesByPipelineId(id);
  }

  @Get(':id/artifacts')
  @ApiOperation({ summary: 'List pipeline artifacts' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Pipeline artifacts fetched.' })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Pipeline not found.',
    messageExample: 'Pipeline not found: pipeline_123'
  })
  @ResponseMessage('Pipeline artifacts fetched')
  listArtifacts(@Param('id') id: string) {
    return this.pipelineQueryService.getArtifactsByPipelineId(id);
  }

  @Get(':id/artifacts/:artifactId/content')
  @SkipApiResponse()
  @ApiOperation({ summary: 'Download pipeline artifact raw content' })
  @ApiParam({ name: 'id', type: String })
  @ApiParam({ name: 'artifactId', type: String })
  @ApiResponse({ status: 200, description: 'Artifact content streamed.' })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Artifact not found.',
    messageExample: 'Artifact not found: artifact_123'
  })
  async getArtifactContent(
    @Param('id') _pipelineId: string,
    @Param('artifactId') artifactId: string,
    @Res() res: Response
  ) {
    const detail = await this.pipelineQueryService.getById(_pipelineId);
    const artifact = detail.artifacts.find((a) => a.id === artifactId);
    if (!artifact) {
      throw new NotFoundException(`Artifact not found: ${artifactId}`);
    }
    const content = await this.pipelinesService.readArtifactContent(artifactId);
    const contentType = artifact.contentType;

    res.setHeader('Content-Type', contentType);
    res.send(content);
  }
}
