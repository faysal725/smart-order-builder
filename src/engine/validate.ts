import type { Group, Rule, Selection, Violation } from "./types";

const count = (sel: Selection, id: string) => sel[id] ?? 0;

export function validateConfig(
  selection: Selection,
  groups: Group[],
  rules: Rule[],
): Violation[] {
  const violations: Violation[] = [];

  for (const group of groups) {
    const optionIds = group.options.map((o) => o.id);
    const total = optionIds.reduce((sum, id) => sum + count(selection, id), 0);
    const distinct = optionIds.filter((id) => count(selection, id) > 0).length;

    // overrideLimit REPLACES the group max (not stacks). Rule wins over base max.
    let max = group.max;
    for (const rule of rules) {
      if (
        rule.type === "overrideLimit" &&
        rule.group === group.id &&
        count(selection, rule.ifOption) > 0
      ) {
        max = rule.max;
      }
    }

    if (total < group.min) {
      violations.push({
        code: "GROUP_MIN",
        groupId: group.id,
        message: `${group.name}: need at least ${group.min}, got ${total}`,
      });
    }
    if (total > max) {
      violations.push({
        code: "GROUP_MAX",
        groupId: group.id,
        message: `${group.name}: max is ${max}, got ${total}`,
      });
    }
    if (group.maxDistinct !== undefined && distinct > group.maxDistinct) {
      violations.push({
        code: "MAX_DISTINCT",
        groupId: group.id,
        message: `${group.name}: max ${group.maxDistinct} different options`,
      });
    }
    if (group.maxPerOption !== undefined) {
      for (const id of optionIds) {
        if (count(selection, id) > group.maxPerOption) {
          violations.push({
            code: "MAX_PER_OPTION",
            groupId: group.id,
            optionId: id,
            message: `${id}: max ${group.maxPerOption} of one option`,
          });
        }
      }
    }
  }

  for (const rule of rules) {
    if (rule.type === "requires" && count(selection, rule.option) > 0) {
      const ok = rule.anyOf.some((id) => count(selection, id) > 0);
      if (!ok) {
        violations.push({
          code: "REQUIRES",
          ruleId: rule.id,
          optionId: rule.option,
          message: `${rule.option} needs one of: ${rule.anyOf.join(", ")}`,
        });
      }
    }
    if (rule.type === "excludes" && count(selection, rule.option) > 0) {
      for (const id of rule.excluded) {
        if (count(selection, id) > 0) {
          violations.push({
            code: "EXCLUDES",
            ruleId: rule.id,
            optionId: rule.option,
            message: `${rule.option} cannot combine with ${id}`,
          });
        }
      }
    }
  }

  return violations; // ALL violations, never stop at first
}