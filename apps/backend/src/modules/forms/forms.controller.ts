import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from "@nestjs/common";
import { FormsService } from "./forms.service";
import { CreateFormDto, UpdateFormDto, SubmitFormDto } from "./dto/form.dto";
import { JwtAuthGuard } from "../../core/auth/guards/jwt-auth.guard";
import { Request } from "express";

interface AuthenticatedRequest extends Request {
  user: {
    tenantId: string;
    id: string;
  };
}

@Controller("forms")
export class FormsController {
  constructor(private readonly formsService: FormsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Req() req: AuthenticatedRequest) {
    const tenantId = req.user.tenantId;
    return this.formsService.findAll(tenantId);
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  async findOne(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    const tenantId = req.user.tenantId;
    return this.formsService.findOne(id, tenantId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body() createFormDto: CreateFormDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const tenantId = req.user.tenantId;
    return this.formsService.create(tenantId, createFormDto);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard)
  async update(
    @Param("id") id: string,
    @Body() updateFormDto: UpdateFormDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const tenantId = req.user.tenantId;
    return this.formsService.update(id, tenantId, updateFormDto);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  async remove(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    const tenantId = req.user.tenantId;
    await this.formsService.remove(id, tenantId);
    return { message: "Form archived successfully" };
  }

  @Get(":id/submissions")
  @UseGuards(JwtAuthGuard)
  async getSubmissions(
    @Param("id") id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const tenantId = req.user.tenantId;
    return this.formsService.findSubmissions(id, tenantId);
  }

  @Post(":id/submit")
  async submit(
    @Param("id") id: string,
    @Body() submitFormDto: SubmitFormDto,
    @Req() req: Request,
  ) {
    // Public endpoint - extract tenant from body or form, not from auth
    const body = req.body as Record<string, any>;
    const tenantId = (body?.tenantId as string) || "default";

    const form = await this.formsService.findOne(id, tenantId);
    const ipAddress = req.ip || "unknown";

    return this.formsService.submit(
      id,
      form.tenantId,
      submitFormDto,
      ipAddress,
    );
  }
}
