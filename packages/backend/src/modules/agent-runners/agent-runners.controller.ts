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
import { ApiOperation, ApiResponse, ApiTags, ApiParam } from '@nestjs/swagger';

import { ApiWrappedErrorResponse } from '../../common/api-error-response.decorator';
import { ResponseMessage } from '../../common/response-message.decorator';
import { apiRouteConfig } from '../api-route.config';
import { RunnerTypeRegistry } from './runner-type.registry';
import { AgentRunnersService } from './agent-runners.service';
import {
  AgentRunnerQueryDto,
  CreateAgentRunnerDto,
  UpdateAgentRunnerDto
} from './dto/agent-runner.dto';

@ApiTags('AgentRunners')
@Controller()
export class AgentRunnersController {
  private readonly agentRunnersService: AgentRunnersService;
  private readonly runnerTypeRegistry: RunnerTypeRegistry;

  constructor(
    agentRunnersService: AgentRunnersService,
    runnerTypeRegistry: RunnerTypeRegistry
  ) {
    this.agentRunnersService = agentRunnersService;
    this.runnerTypeRegistry = runnerTypeRegistry;
  }

  @Get(apiRouteConfig.agentRunnerTypes.path)
  @ApiOperation({ summary: 'List all registered runner types' })
  @ApiResponse({
    status: 200,
    description: 'Runner type list with JSON schemas'
  })
  @ResponseMessage('Runner type list fetched')
  listRunnerTypes() {
    return this.runnerTypeRegistry.getAllResponses();
  }

  @Get(apiRouteConfig.agentRunners.path)
  @ApiOperation({ summary: 'List agent runners' })
  @ApiResponse({ status: 200, description: 'Agent runner list fetched.' })
  @ResponseMessage('Agent runner list fetched')
  list(@Query() query: AgentRunnerQueryDto) {
    return this.agentRunnersService.list(query);
  }

  @Get(`${apiRouteConfig.agentRunners.path}/:id`)
  @ApiOperation({ summary: 'Get agent runner detail' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Agent runner detail fetched.' })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Agent runner not found.',
    messageExample: 'AgentRunner not found: runner_123'
  })
  @ResponseMessage('Agent runner detail fetched')
  getById(@Param('id') id: string) {
    return this.agentRunnersService.getById(id);
  }

  @Post(apiRouteConfig.agentRunners.path)
  @ApiOperation({ summary: 'Create an agent runner' })
  @ApiResponse({ status: 201, description: 'Agent runner created.' })
  @ApiWrappedErrorResponse({
    status: 400,
    description: 'Invalid agent runner payload.',
    messageExample: "Runner type 'nonexistent-type' does not exist"
  })
  @ResponseMessage('Agent runner created')
  create(@Body() dto: CreateAgentRunnerDto) {
    return this.agentRunnersService.create(dto);
  }

  @Patch(`${apiRouteConfig.agentRunners.path}/:id`)
  @ApiOperation({ summary: 'Update an agent runner' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Agent runner updated.' })
  @ApiWrappedErrorResponse({
    status: 400,
    description: 'Invalid agent runner payload.',
    messageExample: "Runner type 'nonexistent-type' does not exist"
  })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Agent runner not found.',
    messageExample: 'AgentRunner not found: runner_123'
  })
  @ApiWrappedErrorResponse({
    status: 409,
    description: 'Runner type is no longer registered.',
    messageExample: "Runner type 'missing-runner-type' is no longer registered"
  })
  @ResponseMessage('Agent runner updated')
  update(@Param('id') id: string, @Body() dto: UpdateAgentRunnerDto) {
    return this.agentRunnersService.update(id, dto);
  }

  @Delete(`${apiRouteConfig.agentRunners.path}/:id`)
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete an agent runner' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Agent runner deleted.' })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Agent runner not found.',
    messageExample: 'AgentRunner not found: runner_123'
  })
  @ApiWrappedErrorResponse({
    status: 409,
    description: 'Runner is still referenced by existing sessions.',
    messageExample: 'Cannot delete runner: 1 session(s) still reference it',
    dataSchema: {
      type: 'object',
      properties: {
        sessionCount: {
          type: 'number',
          example: 1
        }
      },
      required: ['sessionCount']
    }
  })
  @ResponseMessage('Agent runner deleted')
  remove(@Param('id') id: string) {
    return this.agentRunnersService.remove(id);
  }

  @Get(`${apiRouteConfig.agentRunners.path}/:id/health`)
  @ApiOperation({ summary: 'Check health status of an agent runner' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Health status fetched.' })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Agent runner not found.',
    messageExample: 'AgentRunner not found: runner_123'
  })
  @ResponseMessage('Health status fetched')
  checkHealth(@Param('id') id: string) {
    return this.agentRunnersService.checkHealth(id);
  }

  @Get(`${apiRouteConfig.agentRunners.path}/:id/context`)
  @ApiOperation({
    summary: 'Probe underlying CLI for available context options (e.g. models)'
  })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Runner context options fetched.' })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Agent runner not found.',
    messageExample: 'AgentRunner not found: runner_123'
  })
  @ApiWrappedErrorResponse({
    status: 409,
    description: 'Runner type is no longer registered.',
    messageExample: "Runner type 'missing-runner-type' is no longer registered"
  })
  @ApiWrappedErrorResponse({
    status: 502,
    description: 'Runner context probe failed.',
    messageExample: 'Failed to probe runner context'
  })
  @ResponseMessage('Runner context options fetched')
  probeContext(@Param('id') id: string) {
    return this.agentRunnersService.probeRunnerContext(id);
  }
}
