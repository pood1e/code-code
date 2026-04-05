import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  MessageEvent,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Res,
  Sse
} from '@nestjs/common';
import type { Response } from 'express';
import type { Observable } from 'rxjs';
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
import { StartPipelineDto } from './dto/start-pipeline.dto';
import { SubmitHumanDecisionDto } from './dto/human-decision.dto';
import { PipelineEventStreamService } from './pipeline-event-stream.service';
import { PipelineQueryService } from './pipeline-query.service';
import { PipelinesService } from './pipelines.service';


@ApiTags('Pipelines')
@Controller(apiRouteConfig.pipelines.path)
export class PipelinesController {
  constructor(
    private readonly pipelinesService: PipelinesService,
    private readonly pipelineQueryService: PipelineQueryService,
    private readonly pipelineEventStreamService: PipelineEventStreamService
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
    @Param('id') pipelineId: string,
    @Param('artifactId') artifactId: string,
    @Res() res: Response
  ) {
    const artifact = await this.pipelinesService.getArtifactById(artifactId);
    if (!artifact || artifact.pipelineId !== pipelineId) {
      throw new NotFoundException(`Artifact not found: ${artifactId}`);
    }
    const content = await this.pipelinesService.readArtifactContent(artifactId);
    const contentType = artifact.contentType;

    res.setHeader('Content-Type', contentType);
    res.send(content);
  }

  @Post(':id/start')
  @HttpCode(200)
  @ResponseMessage('Pipeline started successfully')
  @ApiOperation({ summary: 'Start a pipeline (Draft → Pending)' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Pipeline enqueued for execution.' })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Pipeline not found.',
    messageExample: 'Pipeline not found: pipe_123'
  })
  @ApiWrappedErrorResponse({
    status: 409,
    description: 'Pipeline is not in draft status.',
    messageExample: "Pipeline can only be started from 'draft' status, current: running"
  })
  async startPipeline(
    @Param('id') id: string,
    @Body() dto: StartPipelineDto
  ) {
    return this.pipelinesService.start(id, {
      runnerId: dto.runnerId,
      config: dto.maxRetry !== undefined ? { maxRetry: dto.maxRetry } : undefined
    });
  }

  @Post(':id/decision')
  @HttpCode(200)
  @ResponseMessage('Decision submitted successfully')
  @ApiOperation({ summary: 'Submit human review decision (Paused → Pending)' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Decision accepted, pipeline will resume.' })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Pipeline not found.',
    messageExample: 'Pipeline not found: pipe_123'
  })
  @ApiWrappedErrorResponse({
    status: 400,
    description: 'Pipeline is not in paused status.',
    messageExample: "Pipeline must be in 'paused' status to submit a decision, current: running"
  })
  async submitDecision(
    @Param('id') id: string,
    @Body() dto: SubmitHumanDecisionDto
  ) {
    await this.pipelinesService.submitDecision(id, dto.decision);
  }

  @Sse(':id/events')
  @SkipApiResponse()
  @ApiOperation({ summary: 'SSE stream for real-time pipeline events' })
  @ApiParam({ name: 'id', type: String })
  @ApiQuery({ name: 'lastEventId', type: Number, required: false })
  @ApiResponse({ status: 200, description: 'SSE stream of pipeline events.' })
  async streamEvents(
    @Param('id') id: string,
    @Query('lastEventId') lastEventId?: string
  ): Promise<Observable<MessageEvent>> {
    const afterEventId = lastEventId ? parseInt(lastEventId, 10) : 0;
    return this.pipelineEventStreamService.createStream(id, afterEventId);
  }
}
