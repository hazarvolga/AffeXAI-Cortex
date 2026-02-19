import { Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Form } from "./entities/form.entity";
import { FormSubmission } from "./entities/form-submission.entity";
import { CreateFormDto, UpdateFormDto, SubmitFormDto } from "./dto/form.dto";
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FormsService {
  constructor(
    @InjectRepository(Form)
    private readonly formRepository: Repository<Form>,
    @InjectRepository(FormSubmission)
    private readonly submissionRepository: Repository<FormSubmission>,
    private readonly eventEmitter: EventEmitter2,
  ) { }

  async seedDefaultTemplates(tenantId: string): Promise<Form[]> {
    const seededForms: Form[] = [];
    console.log(`[FormsService] Initializing default seeding for tenant: ${tenantId}`);

    // Check if tenant already has forms (avoid double seeding)
    const existingCount = await this.formRepository.count({ where: { tenantId } });
    if (existingCount > 0) {
      console.log(`[FormsService] Tenant ${tenantId} already has ${existingCount} nodes. Skipping seed.`);
      return [];
    }

    try {
      const templateFiles = ['event-registration.json', 'neural-contact.json'];
      const templatesBaseDir = path.join(__dirname, 'templates');

      for (const file of templateFiles) {
        const filePath = path.join(templatesBaseDir, file);
        console.log(`[FormsService] Checking template path: ${filePath}`);

        if (fs.existsSync(filePath)) {
          const templateData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          const form = this.formRepository.create({
            ...templateData,
            tenantId,
            status: 'active'
          });
          const savedForm = (await this.formRepository.save(form)) as unknown as Form;
          seededForms.push(savedForm);
          console.log(`[FormsService] Successfully seeded: ${templateData.name}`);
        } else {
          console.warn(`[FormsService] Template not found: ${filePath}`);
        }
      }
    } catch (error) {
      console.error('[FormsService] Failed to seed templates:', error);
    }

    return seededForms;
  }

  async findAll(tenantId: string): Promise<Form[]> {
    const forms = await this.formRepository.find({
      where: { tenantId },
      order: { createdAt: "DESC" },
    });

    // Auto-seed if empty (Standard BCC onboarding logic)
    if (forms.length === 0) {
      return this.seedDefaultTemplates(tenantId);
    }

    return forms;
  }

  async findOne(id: string, tenantId: string): Promise<Form> {
    const form = await this.formRepository.findOne({
      where: { id, tenantId },
    });

    if (!form) {
      throw new NotFoundException(`Form with ID ${id} not found`);
    }

    return form;
  }

  async create(tenantId: string, createFormDto: CreateFormDto): Promise<Form> {
    const form = this.formRepository.create({
      ...createFormDto,
      tenantId,
    });

    return this.formRepository.save(form);
  }

  async update(
    id: string,
    tenantId: string,
    updateFormDto: UpdateFormDto,
  ): Promise<Form> {
    const form = await this.findOne(id, tenantId);

    Object.assign(form, updateFormDto);

    return this.formRepository.save(form);
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const form = await this.findOne(id, tenantId);

    // Soft delete by setting status to archived
    form.status = "archived";
    await this.formRepository.save(form);
  }

  async submit(
    formId: string,
    tenantId: string,
    submitFormDto: SubmitFormDto,
    ipAddress?: string,
  ): Promise<FormSubmission> {
    const form = await this.findOne(formId, tenantId);

    const submission = this.submissionRepository.create({
      formId,
      tenantId,
      data: submitFormDto.data,
      submittedBy: submitFormDto.submittedBy,
      ipAddress,
    });

    const savedSubmission = await this.submissionRepository.save(submission);

    // Increment submission count
    form.submissionCount += 1;
    await this.formRepository.save(form);

    // 🧠 NEURAL GRID SIGNAL: Form Submitted (Reward)
    this.eventEmitter.emit('neural.signal', {
      tenantId: tenantId,
      source: 'forms',
      type: 'form.submitted',
      successScore: 2,
      context: `Form "${form.name}" was submitted by ${submitFormDto.submittedBy || 'Anonymous'}`,
      data: { formId: form.id, submittedBy: submitFormDto.submittedBy }
    });

    return savedSubmission;
  }

  async findSubmissions(
    formId: string,
    tenantId: string,
  ): Promise<FormSubmission[]> {
    // Verify form exists and belongs to tenant
    await this.findOne(formId, tenantId);

    return this.submissionRepository.find({
      where: { formId, tenantId },
      order: { submittedAt: "DESC" },
    });
  }
}
