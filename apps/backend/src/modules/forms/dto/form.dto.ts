import {
  IsString,
  IsOptional,
  IsObject,
  IsEnum,
  IsNotEmpty,
} from "class-validator";
import { FormStructure, FormSettings } from "../entities/form.entity";

export class CreateFormDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  @IsNotEmpty()
  structure: FormStructure;

  @IsObject()
  @IsOptional()
  settings?: FormSettings;

  @IsEnum(["draft", "published", "archived"])
  @IsOptional()
  status?: "draft" | "published" | "archived";
}

export class UpdateFormDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  @IsOptional()
  structure?: FormStructure;

  @IsObject()
  @IsOptional()
  settings?: FormSettings;

  @IsEnum(["draft", "published", "archived"])
  @IsOptional()
  status?: "draft" | "published" | "archived";
}

export class SubmitFormDto {
  @IsObject()
  @IsNotEmpty()
  data: Record<string, any>;

  @IsString()
  @IsOptional()
  submittedBy?: string;
}
