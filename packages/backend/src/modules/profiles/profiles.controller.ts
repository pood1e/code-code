import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Res
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags
} from '@nestjs/swagger';
import { Response } from 'express';

import { ResponseMessage } from '../../common/response-message.decorator';
import {
  ExportProfileQueryDto,
  ProfileMutationDto,
  SaveProfileDto
} from '../../dto/profile.dto';
import { ProfilesService } from './profiles.service';

@ApiTags('Profiles')
@Controller('profiles')
export class ProfilesController {
  private readonly profilesService: ProfilesService;

  constructor(profilesService: ProfilesService) {
    this.profilesService = profilesService;
    this.list = this.list.bind(this);
    this.getById = this.getById.bind(this);
    this.create = this.create.bind(this);
    this.update = this.update.bind(this);
    this.remove = this.remove.bind(this);
    this.render = this.render.bind(this);
    this.export = this.export.bind(this);
  }

  @Get()
  @ApiOperation({ summary: 'List profiles' })
  @ApiResponse({ status: 200, description: 'Profile list fetched.' })
  @ResponseMessage('Profile list fetched')
  list() {
    return this.profilesService.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get profile detail' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Profile detail fetched.' })
  @ResponseMessage('Profile detail fetched')
  getById(@Param('id') id: string) {
    return this.profilesService.getById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create profile' })
  @ApiResponse({ status: 201, description: 'Profile created.' })
  @ResponseMessage('Profile created')
  create(@Body() dto: ProfileMutationDto) {
    return this.profilesService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Replace profile aggregate' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Profile saved.' })
  @ResponseMessage('Profile saved')
  update(@Param('id') id: string, @Body() dto: SaveProfileDto) {
    return this.profilesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete profile' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Profile deleted.' })
  @ResponseMessage('Profile deleted')
  remove(@Param('id') id: string) {
    return this.profilesService.remove(id);
  }

  @Get(':id/render')
  @ApiOperation({ summary: 'Render a profile' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Profile rendered.' })
  @ResponseMessage('Profile rendered')
  render(@Param('id') id: string) {
    return this.profilesService.render(id);
  }

  @Get(':id/export')
  @ApiOperation({ summary: 'Export rendered profile as JSON or YAML' })
  @ApiParam({ name: 'id', type: String })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'yaml'] })
  @ApiResponse({ status: 200, description: 'Profile export generated.' })
  async export(
    @Param('id') id: string,
    @Query() query: ExportProfileQueryDto,
    @Res() response: Response
  ) {
    const format = query.format ?? 'json';
    const payload = await this.profilesService.export(id, format);

    response.setHeader('Cache-Control', 'no-store');
    response.setHeader(
      'Content-Type',
      format === 'yaml'
        ? 'application/x-yaml; charset=utf-8'
        : 'application/json; charset=utf-8'
    );
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${id}.${format === 'yaml' ? 'yaml' : 'json'}"`
    );

    response.send(payload);
  }
}
