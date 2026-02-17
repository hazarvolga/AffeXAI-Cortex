import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

export interface FormBlock {
  id: string;
  type: string;
  label?: string;
  properties: Record<string, any>;
  styles: Record<string, any>;
}

export interface FormColumn {
  id: string;
  width: string;
  blocks: FormBlock[];
}

export interface FormRow {
  id: string;
  type: string;
  columns: FormColumn[];
  settings: Record<string, any>;
}

export interface FormStructure {
  rows: FormRow[];
  settings: {
    theme?: string;
    submitButtonText?: string;
    width?: string;
  };
}

export interface FormSettings {
  theme?: string;
  submitButtonText?: string;
  successMessage?: string;
  redirectUrl?: string;
  notificationEmail?: string;
}

export interface VisibilityRule {
  fieldId: string;
  operator: "equals" | "not_equals" | "contains" | "empty" | "not_empty";
  value: any;
}

export interface LogicConfig {
  rules: {
    blockId: string;
    conditions: VisibilityRule[];
    action: "show" | "hide";
  }[];
}

@Entity("forms")
export class Form {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  tenantId: string;

  @Column()
  name: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "jsonb" })
  structure: FormStructure;

  @Column({ type: "jsonb", nullable: true })
  settings: FormSettings;

  @Column({ type: "jsonb", nullable: true })
  logicConfig: LogicConfig;

  @Column({ default: "draft" })
  status: "draft" | "published" | "archived";

  @Column({ default: 0 })
  submissionCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
