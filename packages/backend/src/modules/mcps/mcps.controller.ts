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

import { ResponseMessage } from '../../common/response-message.decorator';
import { McpMutationDto, ResourceSearchQueryDto } from '../../dto/resource.dto';
import { McpsService } from './mcps.service';

@ApiTags('MCPs')
@Controller('mcps')
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
  @ResponseMessage('MCP detail fetched')
  getById(@Param('id') id: string) {
    return this.mcpsService.getById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create MCP' })
  @ApiResponse({ status: 201, description: 'MCP created.' })
  @ResponseMessage('MCP created')
  create(@Body() dto: McpMutationDto) {
    return this.mcpsService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update MCP' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'MCP updated.' })
  @ResponseMessage('MCP updated')
  update(@Param('id') id: string, @Body() dto: McpMutationDto) {
    return this.mcpsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete MCP' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'MCP deleted.' })
  @ResponseMessage('MCP deleted')
  remove(@Param('id') id: string) {
    return this.mcpsService.remove(id);
  }
}
