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
  ApiResponse,
  ApiTags,
  ApiParam
} from '@nestjs/swagger';

import { ResponseMessage } from '../../common/response-message.decorator';
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

  @Get('agent-runner-types')
  @ApiOperation({ summary: 'List all registered runner types' })
  @ApiResponse({
    status: 200,
    description: 'Runner type list with JSON schemas'
  })
  @ResponseMessage('Runner type list fetched')
  listRunnerTypes() {
    return this.runnerTypeRegistry.getAllResponses();
  }

  @Get('agent-runners')
  @ApiOperation({ summary: 'List agent runners' })
  @ApiResponse({ status: 200, description: 'Agent runner list fetched.' })
  @ResponseMessage('Agent runner list fetched')
  list(@Query() query: AgentRunnerQueryDto) {
    return this.agentRunnersService.list(query);
  }

  @Get('agent-runners/:id')
  @ApiOperation({ summary: 'Get agent runner detail' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Agent runner detail fetched.' })
  @ResponseMessage('Agent runner detail fetched')
  getById(@Param('id') id: string) {
    return this.agentRunnersService.getById(id);
  }

  @Post('agent-runners')
  @ApiOperation({ summary: 'Create an agent runner' })
  @ApiResponse({ status: 201, description: 'Agent runner created.' })
  @ResponseMessage('Agent runner created')
  create(@Body() dto: CreateAgentRunnerDto) {
    return this.agentRunnersService.create(dto);
  }

  @Patch('agent-runners/:id')
  @ApiOperation({ summary: 'Update an agent runner' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Agent runner updated.' })
  @ResponseMessage('Agent runner updated')
  update(@Param('id') id: string, @Body() dto: UpdateAgentRunnerDto) {
    return this.agentRunnersService.update(id, dto);
  }

  @Delete('agent-runners/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete an agent runner' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Agent runner deleted.' })
  @ResponseMessage('Agent runner deleted')
  remove(@Param('id') id: string) {
    return this.agentRunnersService.remove(id);
  }
}
