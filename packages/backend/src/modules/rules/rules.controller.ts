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
import {
  ResourceSearchQueryDto,
  RuleMutationDto
} from '../../dto/resource.dto';
import { RulesService } from './rules.service';

@ApiTags('Rules')
@Controller('rules')
export class RulesController {
  private readonly rulesService: RulesService;

  constructor(rulesService: RulesService) {
    this.rulesService = rulesService;
    this.list = this.list.bind(this);
    this.getById = this.getById.bind(this);
    this.create = this.create.bind(this);
    this.update = this.update.bind(this);
    this.remove = this.remove.bind(this);
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
  @ResponseMessage('Rule detail fetched')
  getById(@Param('id') id: string) {
    return this.rulesService.getById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create rule' })
  @ApiResponse({ status: 201, description: 'Rule created.' })
  @ResponseMessage('Rule created')
  create(@Body() dto: RuleMutationDto) {
    return this.rulesService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update rule' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Rule updated.' })
  @ResponseMessage('Rule updated')
  update(@Param('id') id: string, @Body() dto: RuleMutationDto) {
    return this.rulesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete rule' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Rule deleted.' })
  @ResponseMessage('Rule deleted')
  remove(@Param('id') id: string) {
    return this.rulesService.remove(id);
  }
}
