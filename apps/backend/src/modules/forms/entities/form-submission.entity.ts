import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Form } from "./form.entity";

@Entity("form_submissions")
export class FormSubmission {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  tenantId: string;

  @Column()
  formId: string;

  @ManyToOne(() => Form)
  @JoinColumn({ name: "formId" })
  form: Form;

  @Column({ type: "jsonb" })
  data: Record<string, any>;

  @Column({ nullable: true })
  submittedBy: string;

  @Column({ nullable: true })
  ipAddress: string;

  @CreateDateColumn()
  submittedAt: Date;
}
