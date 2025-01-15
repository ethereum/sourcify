// Type definitions for rows fetched from the database with pg

import {
  Transformation,
  TransformationValues,
} from "@ethereum-sourcify/lib-sourcify";

export interface VerifiedContract {
  id: string;
  created_at: Date;
  updated_at: Date;
  created_by: string;
  updated_by: string;
  compilation_id: string;
  deployment_id: string;
  creation_transformations: Transformation[] | null;
  creation_values: TransformationValues | null;
  runtime_transformations: Transformation[] | null;
  runtime_values: TransformationValues | null;
  runtime_match: boolean;
  creation_match: boolean;
  runtime_metadata_match: boolean | null;
  creation_metadata_match: boolean | null;
}
