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

import { ResponseMessage } from '../../common/response-message.decorator';
import {
  ResourceSearchQueryDto,
  SkillMutationDto
} from '../../dto/resource.dto';
import { SkillsService } from './skills.service';

@ApiTags('Skills')
@Controller('skills')
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
  @ResponseMessage('Skill detail fetched')
  getById(@Param('id') id: string) {
    return this.skillsService.getById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a skill' })
  @ApiResponse({ status: 201, description: 'Skill created.' })
  @ResponseMessage('Skill created')
  create(@Body() dto: SkillMutationDto) {
    return this.skillsService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a skill' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Skill updated.' })
  @ResponseMessage('Skill updated')
  update(@Param('id') id: string, @Body() dto: SkillMutationDto) {
    return this.skillsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete a skill' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Skill deleted.' })
  @ResponseMessage('Skill deleted')
  remove(@Param('id') id: string) {
    return this.skillsService.remove(id);
  }
}
