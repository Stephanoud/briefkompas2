import workflowProfileRaw from "@/config/legal-workflow-profile.json";
import belastingWorkflowProfileRaw from "@/config/legal-workflow-profile.belasting.json";
import boeteWorkflowProfileRaw from "@/config/legal-workflow-profile.boete.json";
import handhavingWorkflowProfileRaw from "@/config/legal-workflow-profile.handhaving.json";
import lateDecisionWorkflowProfileRaw from "@/config/legal-workflow-profile.niet_tijdig_beslissen.json";
import nonAdmissibilityWorkflowProfileRaw from "@/config/legal-workflow-profile.niet_ontvankelijkheid.json";
import toeslagenWorkflowProfileRaw from "@/config/legal-workflow-profile.toeslagen.json";
import wooWorkflowProfileRaw from "@/config/legal-workflow-profile.woo.json";
import wmoPgbWorkflowProfileRaw from "@/config/legal-workflow-profile.wmo_pgb.json";
import {
  GroundSupportEntry,
  LegalWorkflowProfile,
} from "@/types";
import { GenerationGuardResult, ValidatedCitation } from "@/lib/legal/types";

const baseWorkflowProfile = workflowProfileRaw as LegalWorkflowProfile;
const belastingWorkflowProfile = belastingWorkflowProfileRaw as LegalWorkflowProfile;
const boeteWorkflowProfile = boeteWorkflowProfileRaw as LegalWorkflowProfile;
const handhavingWorkflowProfile = handhavingWorkflowProfileRaw as LegalWorkflowProfile;
const lateDecisionWorkflowProfile = lateDecisionWorkflowProfileRaw as LegalWorkflowProfile;
const nonAdmissibilityWorkflowProfile = nonAdmissibilityWorkflowProfileRaw as LegalWorkflowProfile;
const toeslagenWorkflowProfile = toeslagenWorkflowProfileRaw as LegalWorkflowProfile;
const wooWorkflowProfile = wooWorkflowProfileRaw as LegalWorkflowProfile;
const wmoPgbWorkflowProfile = wmoPgbWorkflowProfileRaw as LegalWorkflowProfile;

function getWorkflowProfileTemplate(moduleKey: string): LegalWorkflowProfile {
  if (moduleKey === "belasting") {
    return belastingWorkflowProfile;
  }

  if (moduleKey === "boete") {
    return boeteWorkflowProfile;
  }

  if (moduleKey === "niet_tijdig_beslissen") {
    return lateDecisionWorkflowProfile;
  }

  if (moduleKey === "niet_ontvankelijkheid") {
    return nonAdmissibilityWorkflowProfile;
  }

  if (moduleKey === "woo") {
    return wooWorkflowProfile;
  }

  if (moduleKey === "wmo_pgb") {
    return wmoPgbWorkflowProfile;
  }

  if (moduleKey === "handhaving") {
    return handhavingWorkflowProfile;
  }

  if (moduleKey === "toeslagen") {
    return toeslagenWorkflowProfile;
  }

  return baseWorkflowProfile;
}

function dedupe(values: string[]): string[] {
  return values.filter((value, index, array) => Boolean(value) && array.indexOf(value) === index);
}

export function buildLegalWorkflowProfile(params: {
  moduleKey: string;
  moduleLabel: string;
  guard: GenerationGuardResult;
  groundsMatrix: GroundSupportEntry[];
  reviewedAuthorities: ValidatedCitation[];
  missingInfoTriggers: string[];
  misclassificationRisks: string[];
  evidenceHooks: string[];
}): LegalWorkflowProfile {
  const {
    moduleKey,
    moduleLabel,
    guard,
    groundsMatrix,
    reviewedAuthorities,
    missingInfoTriggers,
    misclassificationRisks,
    evidenceHooks,
  } = params;
  const workflowTemplate = getWorkflowProfileTemplate(moduleKey);

  return {
    ...workflowTemplate,
    module: workflowTemplate.module === "dynamic_from_case_analysis" ? moduleLabel : workflowTemplate.module,
    document_extraction: {
      ...baseWorkflowProfile.document_extraction,
      ...workflowTemplate.document_extraction,
      required_fields: dedupe([
        ...(baseWorkflowProfile.document_extraction.required_fields ?? []),
        ...(workflowTemplate.document_extraction.required_fields ?? []),
      ]),
      optional_fields: dedupe([
        ...(baseWorkflowProfile.document_extraction.optional_fields ?? []),
        ...(workflowTemplate.document_extraction.optional_fields ?? []),
      ]),
      red_flags: dedupe([
        ...(baseWorkflowProfile.document_extraction.red_flags ?? []),
        ...(workflowTemplate.document_extraction.red_flags ?? []),
      ]),
      missing_info_triggers: dedupe([
        ...(baseWorkflowProfile.document_extraction.missing_info_triggers ?? []),
        ...(workflowTemplate.document_extraction.missing_info_triggers ?? []),
        ...missingInfoTriggers,
      ]),
    },
    classification: {
      ...baseWorkflowProfile.classification,
      ...workflowTemplate.classification,
      decision_type_rules: dedupe([
        ...(baseWorkflowProfile.classification.decision_type_rules ?? []),
        ...(workflowTemplate.classification.decision_type_rules ?? []),
      ]),
      procedure_stage_rules: dedupe([
        ...(baseWorkflowProfile.classification.procedure_stage_rules ?? []),
        ...(workflowTemplate.classification.procedure_stage_rules ?? []),
      ]),
      misclassification_risks: dedupe([
        ...(baseWorkflowProfile.classification.misclassification_risks ?? []),
        ...(workflowTemplate.classification.misclassification_risks ?? []),
        ...misclassificationRisks,
      ]),
    },
    question_logic: {
      ...baseWorkflowProfile.question_logic,
      ...workflowTemplate.question_logic,
      question_priority_rules: dedupe([
        ...(baseWorkflowProfile.question_logic.question_priority_rules ?? []),
        ...(workflowTemplate.question_logic.question_priority_rules ?? []),
      ]),
    },
    jurisprudence: {
      ...baseWorkflowProfile.jurisprudence,
      ...workflowTemplate.jurisprudence,
      must_verify_fields: dedupe([
        ...(baseWorkflowProfile.jurisprudence.must_verify_fields ?? []),
        ...(workflowTemplate.jurisprudence.must_verify_fields ?? []),
      ]),
      search_queries: dedupe([
        ...(baseWorkflowProfile.jurisprudence.search_queries ?? []),
        ...(workflowTemplate.jurisprudence.search_queries ?? []),
        ...reviewedAuthorities.flatMap((authority) => authority.searchQueries ?? []),
      ]),
    },
    grounds: {
      ...baseWorkflowProfile.grounds,
      ...workflowTemplate.grounds,
      strongest_case_specific_grounds: dedupe([
        ...groundsMatrix.map((ground) => ground.title),
        ...(baseWorkflowProfile.grounds.strongest_case_specific_grounds ?? []),
        ...(workflowTemplate.grounds.strongest_case_specific_grounds ?? []),
      ]),
      weak_generic_grounds_to_avoid: dedupe([
        ...(baseWorkflowProfile.grounds.weak_generic_grounds_to_avoid ?? []),
        ...(workflowTemplate.grounds.weak_generic_grounds_to_avoid ?? []),
      ]),
      evidence_hooks: dedupe([
        ...evidenceHooks,
        ...(baseWorkflowProfile.grounds.evidence_hooks ?? []),
        ...(workflowTemplate.grounds.evidence_hooks ?? []),
      ]),
    },
    hallucination_guards: dedupe([
      ...(baseWorkflowProfile.hallucination_guards ?? []),
      ...(workflowTemplate.hallucination_guards ?? []),
    ]),
    value_add_hooks: dedupe([
      ...(baseWorkflowProfile.value_add_hooks ?? []),
      ...(workflowTemplate.value_add_hooks ?? []),
    ]),
    pre_output_checks: dedupe([
      ...(baseWorkflowProfile.pre_output_checks ?? []),
      ...((workflowTemplate.pre_output_checks as string[] | undefined) ?? []),
    ]),
    abort_or_redirect_conditions: dedupe([
      ...(baseWorkflowProfile.abort_or_redirect_conditions ?? []),
      ...(workflowTemplate.abort_or_redirect_conditions ?? []),
      ...guard.hardBlockers,
      ...guard.softSignals.map((signal) =>
        signal === "route_uncertain" ? "route_uncertain_with_document_conflict" : signal
      ),
    ]),
  };
}
