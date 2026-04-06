import {
  Body,
  Controller,
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

import { ApiWrappedErrorResponse } from '../../common/api-error-response.decorator';
import { ResponseMessage } from '../../common/response-message.decorator';
import { apiRouteConfig } from '../api-route.config';
import { CreateFindingDto, GovernanceFindingQueryDto } from './dto/finding.dto';
import {
  GovernanceChangeUnitQueryDto,
  GovernanceDeliveryArtifactQueryDto,
  GovernanceIssueQueryDto
} from './dto/issue.dto';
import { UpdateGovernancePolicyDto } from './dto/policy.dto';
import { CreateResolutionDecisionDto } from './dto/resolution-decision.dto';
import { CreateReviewDecisionDto } from './dto/review-decision.dto';
import { GovernanceQueryService } from './governance-query.service';
import { GovernanceService } from './governance.service';

@ApiTags('Governance')
@Controller(apiRouteConfig.governance.path)
export class GovernanceController {
  constructor(
    private readonly governanceService: GovernanceService,
    private readonly governanceQueryService: GovernanceQueryService
  ) {}

  @Post('findings')
  @ApiOperation({ summary: 'Create a governance finding' })
  @ApiResponse({ status: 201, description: 'Finding created.' })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Project not found.',
    messageExample: 'Project not found: project_123'
  })
  @ResponseMessage('Governance finding created')
  createFinding(@Body() dto: CreateFindingDto) {
    return this.governanceService.createFinding(dto);
  }

  @Get('findings')
  @ApiOperation({ summary: 'List governance findings' })
  @ApiQuery({ name: 'scopeId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Finding list fetched.' })
  @ResponseMessage('Governance finding list fetched')
  listFindings(@Query() query: GovernanceFindingQueryDto) {
    return this.governanceQueryService.listFindings(
      query.scopeId,
      query.status
    );
  }

  @Get('scopes/:scopeId/overview')
  @ApiOperation({ summary: 'Get governance scope overview' })
  @ApiParam({ name: 'scopeId', type: String })
  @ApiResponse({ status: 200, description: 'Scope overview fetched.' })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Project not found.',
    messageExample: 'Project not found: project_123'
  })
  @ResponseMessage('Governance scope overview fetched')
  getScopeOverview(@Param('scopeId') scopeId: string) {
    return this.governanceQueryService.getScopeOverview(scopeId);
  }

  @Get('scopes/:scopeId/review-queue')
  @ApiOperation({ summary: 'Get governance review queue for a scope' })
  @ApiParam({ name: 'scopeId', type: String })
  @ApiResponse({ status: 200, description: 'Review queue fetched.' })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Project not found.',
    messageExample: 'Project not found: project_123'
  })
  @ResponseMessage('Governance review queue fetched')
  getReviewQueue(@Param('scopeId') scopeId: string) {
    return this.governanceQueryService.getReviewQueue(scopeId);
  }

  @Get('scopes/:scopeId/repository-profile')
  @ApiOperation({ summary: 'Get latest governance repository profile' })
  @ApiParam({ name: 'scopeId', type: String })
  @ApiResponse({ status: 200, description: 'Repository profile fetched.' })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Project not found.',
    messageExample: 'Project not found: project_123'
  })
  @ResponseMessage('Governance repository profile fetched')
  getRepositoryProfile(@Param('scopeId') scopeId: string) {
    return this.governanceQueryService.getLatestRepositoryProfile(scopeId);
  }

  @Get('scopes/:scopeId/policy')
  @ApiOperation({ summary: 'Get governance policy for a scope' })
  @ApiParam({ name: 'scopeId', type: String })
  @ApiResponse({ status: 200, description: 'Governance policy fetched.' })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Project not found.',
    messageExample: 'Project not found: project_123'
  })
  @ResponseMessage('Governance policy fetched')
  getGovernancePolicy(@Param('scopeId') scopeId: string) {
    return this.governanceQueryService.getGovernancePolicy(scopeId);
  }

  @Post('scopes/:scopeId/repository-profile/refresh')
  @ApiOperation({ summary: 'Refresh governance repository profile' })
  @ApiParam({ name: 'scopeId', type: String })
  @ApiResponse({ status: 201, description: 'Repository profile refreshed.' })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Project not found.',
    messageExample: 'Project not found: project_123'
  })
  @ResponseMessage('Governance repository profile refreshed')
  refreshRepositoryProfile(@Param('scopeId') scopeId: string) {
    return this.governanceService.refreshRepositoryProfile(scopeId);
  }

  @Post('scopes/:scopeId/retry-baseline')
  @HttpCode(200)
  @ApiOperation({ summary: 'Retry governance baseline for a scope' })
  @ApiParam({ name: 'scopeId', type: String })
  @ApiResponse({ status: 200, description: 'Governance baseline retry scheduled.' })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Project not found.',
    messageExample: 'Project not found: project_123'
  })
  @ApiWrappedErrorResponse({
    status: 409,
    description: 'Baseline is not waiting for human review.',
    messageExample: 'Baseline attempt is not waiting for human review'
  })
  @ResponseMessage('Governance baseline retry scheduled')
  retryBaseline(@Param('scopeId') scopeId: string) {
    return this.governanceService.retryBaseline(scopeId);
  }

  @Put('scopes/:scopeId/policy')
  @ApiOperation({ summary: 'Update governance policy for a scope' })
  @ApiParam({ name: 'scopeId', type: String })
  @ApiResponse({ status: 200, description: 'Governance policy updated.' })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Project not found.',
    messageExample: 'Project not found: project_123'
  })
  @ApiWrappedErrorResponse({
    status: 400,
    description: 'Invalid governance policy payload.',
    messageExample: 'Invalid governance policy payload'
  })
  @ResponseMessage('Governance policy updated')
  updateGovernancePolicy(
    @Param('scopeId') scopeId: string,
    @Body() dto: UpdateGovernancePolicyDto
  ) {
    return this.governanceService.updateGovernancePolicy(scopeId, dto);
  }

  @Post('scopes/:scopeId/discovery/run')
  @HttpCode(200)
  @ApiOperation({ summary: 'Run governance discovery for a scope' })
  @ApiParam({ name: 'scopeId', type: String })
  @ApiResponse({ status: 200, description: 'Governance discovery completed.' })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Project not found.',
    messageExample: 'Project not found: project_123'
  })
  @ResponseMessage('Governance discovery completed')
  async runDiscovery(@Param('scopeId') scopeId: string) {
    await this.governanceService.runDiscovery(scopeId);
    return this.governanceQueryService.getScopeOverview(scopeId);
  }

  @Post('scopes/:scopeId/retry-discovery')
  @HttpCode(200)
  @ApiOperation({ summary: 'Retry governance discovery for a scope' })
  @ApiParam({ name: 'scopeId', type: String })
  @ApiResponse({ status: 200, description: 'Governance discovery retry scheduled.' })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Project not found.',
    messageExample: 'Project not found: project_123'
  })
  @ApiWrappedErrorResponse({
    status: 409,
    description: 'Discovery is not waiting for human review.',
    messageExample: 'Discovery attempt is not waiting for human review'
  })
  @ResponseMessage('Governance discovery retry scheduled')
  retryDiscovery(@Param('scopeId') scopeId: string) {
    return this.governanceService.retryDiscovery(scopeId);
  }

  @Get('issues')
  @ApiOperation({ summary: 'List governance issues' })
  @ApiQuery({ name: 'scopeId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Issue list fetched.' })
  @ResponseMessage('Governance issue list fetched')
  listIssues(@Query() query: GovernanceIssueQueryDto) {
    return this.governanceQueryService.listIssues(query.scopeId, query.status);
  }

  @Get('change-units')
  @ApiOperation({ summary: 'List governance change units' })
  @ApiQuery({ name: 'scopeId', required: false, type: String })
  @ApiQuery({ name: 'issueId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Change unit list fetched.' })
  @ResponseMessage('Governance change unit list fetched')
  listChangeUnits(@Query() query: GovernanceChangeUnitQueryDto) {
    return this.governanceQueryService.listChangeUnits(
      query.scopeId,
      query.issueId,
      query.status
    );
  }

  @Get('delivery-artifacts')
  @ApiOperation({ summary: 'List governance delivery artifacts' })
  @ApiQuery({ name: 'scopeId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Delivery artifact list fetched.' })
  @ResponseMessage('Governance delivery artifact list fetched')
  listDeliveryArtifacts(@Query() query: GovernanceDeliveryArtifactQueryDto) {
    return this.governanceQueryService.listDeliveryArtifacts(
      query.scopeId,
      query.status
    );
  }

  @Get('issues/:id')
  @ApiOperation({ summary: 'Get governance issue detail' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Issue detail fetched.' })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Governance issue not found.',
    messageExample: 'Governance issue not found: issue_123'
  })
  @ResponseMessage('Governance issue detail fetched')
  getIssueById(@Param('id') id: string) {
    return this.governanceQueryService.getIssueById(id);
  }

  @Post('issues/:id/resolution-decisions')
  @ApiOperation({ summary: 'Submit a governance resolution decision' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 201, description: 'Resolution decision submitted.' })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Governance issue not found.',
    messageExample: 'Governance issue not found: issue_123'
  })
  @ApiWrappedErrorResponse({
    status: 400,
    description: 'Invalid resolution payload.',
    messageExample: 'primaryIssueId is required for duplicate resolution'
  })
  @ResponseMessage('Governance resolution submitted')
  submitResolutionDecision(
    @Param('id') id: string,
    @Body() dto: CreateResolutionDecisionDto
  ) {
    return this.governanceService.submitResolutionDecision(id, dto);
  }

  @Post('findings/:id/retry-triage')
  @HttpCode(200)
  @ApiOperation({ summary: 'Retry governance triage for a finding' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Triage retry scheduled.' })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Finding not found.',
    messageExample: 'Finding not found: finding_123'
  })
  @ApiWrappedErrorResponse({
    status: 409,
    description: 'Finding triage is not waiting for human review.',
    messageExample: 'Triage attempt is not waiting for human review'
  })
  @ResponseMessage('Governance triage retry scheduled')
  retryTriage(@Param('id') id: string) {
    return this.governanceService.retryTriage(id);
  }

  @Post('issues/:id/retry-planning')
  @HttpCode(200)
  @ApiOperation({ summary: 'Retry governance planning for an issue' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Planning retry scheduled.' })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Governance issue not found.',
    messageExample: 'Governance issue not found: issue_123'
  })
  @ApiWrappedErrorResponse({
    status: 409,
    description: 'Issue planning is not waiting for human review.',
    messageExample: 'Planning attempt is not waiting for human review'
  })
  @ResponseMessage('Governance planning retry scheduled')
  retryPlanning(@Param('id') id: string) {
    return this.governanceService.retryPlanning(id);
  }

  @Post('review-decisions')
  @ApiOperation({ summary: 'Submit a governance review decision' })
  @ApiResponse({ status: 201, description: 'Review decision submitted.' })
  @ApiWrappedErrorResponse({
    status: 404,
    description: 'Review subject not found.',
    messageExample: 'Finding not found: finding_123'
  })
  @ResponseMessage('Governance review decision submitted')
  submitReviewDecision(@Body() dto: CreateReviewDecisionDto) {
    return this.governanceService.submitReviewDecision(dto);
  }
}
