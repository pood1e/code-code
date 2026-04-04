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
  ApiOkResponse,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags
} from '@nestjs/swagger';
import { Response } from 'express';

import { ApiWrappedErrorResponse } from '../../common/api-error-response.decorator';
import { ResponseMessage } from '../../common/response-message.decorator';
import { SkipApiResponse } from '../../common/skip-api-response.decorator';
import {
  ExportProfileQueryDto,
  ProfileMutationDto,
  SaveProfileDto
} from '../../dto/profile.dto';
import { apiRouteConfig } from '../api-route.config';
import { ProfilesService } from './profiles.service';

@ApiTags('Profiles')
@Controller(apiRouteConfig.profiles.path)
export class ProfilesController {
  private readonly profilesService: ProfilesService;

  constructor(profilesService: ProfilesService) {
    this.profilesService = profilesService;
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
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Profile not found.',
    messageExample: 'Profile not found: profile_123'
  })
  @ResponseMessage('Profile detail fetched')
  getById(@Param('id') id: string) {
    return this.profilesService.getById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create profile' })
  @ApiResponse({ status: 201, description: 'Profile created.' })
  @ApiWrappedErrorResponse({
    status: 400,
    description: 'Invalid profile payload.',
    messageExample: 'Invalid profile payload'
  })
  @ResponseMessage('Profile created')
  create(@Body() dto: ProfileMutationDto) {
    return this.profilesService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Replace profile aggregate' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Profile saved.' })
  @ApiWrappedErrorResponse({
    status: 400,
    description: 'Invalid profile payload.',
    messageExample: 'Invalid profile payload'
  })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Profile or referenced resource not found.',
    messageExample: 'Profile not found: profile_123'
  })
  @ResponseMessage('Profile saved')
  update(@Param('id') id: string, @Body() dto: SaveProfileDto) {
    return this.profilesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete profile' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Profile deleted.' })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Profile not found.',
    messageExample: 'Profile not found: profile_123'
  })
  @ResponseMessage('Profile deleted')
  remove(@Param('id') id: string) {
    return this.profilesService.remove(id);
  }

  @Get(':id/render')
  @ApiOperation({ summary: 'Render a profile' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Profile rendered.' })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Profile not found.',
    messageExample: 'Profile not found: profile_123'
  })
  @ResponseMessage('Profile rendered')
  render(@Param('id') id: string) {
    return this.profilesService.render(id);
  }

  @Get(':id/export')
  @SkipApiResponse()
  @ApiOperation({ summary: 'Export rendered profile as JSON or YAML' })
  @ApiParam({ name: 'id', type: String })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'yaml'] })
  @ApiOkResponse({
    description: 'Profile export generated.',
    content: {
      'application/json': {
        schema: {
          type: 'string',
          example: '{\n  "name": "Default Profile"\n}'
        }
      },
      'application/x-yaml': {
        schema: {
          type: 'string',
          example: 'name: Default Profile\n'
        }
      }
    }
  })
  @ApiWrappedErrorResponse({
    status: 400,
    description: 'Invalid export format.',
    messageExample: 'format must be one of the following values: json, yaml'
  })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Profile not found.',
    messageExample: 'Profile not found: profile_123'
  })
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
