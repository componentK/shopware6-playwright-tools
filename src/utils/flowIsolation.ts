import type {FlowConfig, FlowSequence} from '../services/FlowService.js';
import {v4 as uuidv4} from 'uuid';

export interface RuleConditionNode {
    id: string;
    type: string;
    ruleId: string;
    parentId?: string;
    value?: Record<string, unknown>;
    position?: number;
    children?: RuleConditionNode[];
}

export interface RuleConfig {
    id: string;
    name: string;
    priority?: number;
    moduleTypes?: Record<string, unknown>;
    conditions: RuleConditionNode[];
}

export interface BuildCustomerLastNameRuleOptions {
    id: string;
    lastName: string;
    name?: string;
    priority?: number;
    moduleTypes?: Record<string, unknown>;
    orContainerId?: string;
    andContainerId?: string;
    conditionId?: string;
}

export interface BuildCustomerEmailRuleOptions {
    id: string;
    email: string;
    name?: string;
    priority?: number;
    moduleTypes?: Record<string, unknown>;
    orContainerId?: string;
    andContainerId?: string;
    conditionId?: string;
}

export interface WrapFlowWithRuleGateOptions {
    ruleId: string;
    gateSequenceId?: string;
    /** When true, append action.stop.flow on the false branch (default: false). */
    stopFlowOnFalse?: boolean;
    falseBranchStopSequenceId?: string;
}

export interface MergeCustomerLastNameOptions {
    lastName: string;
    conditionId?: string;
}

export interface MergeCustomerEmailOptions {
    email: string;
    conditionId?: string;
}

const ISOLATION_PREFIX = 'CkIso';

/**
 * Deterministic customer lastName marker for parallel-safe flow suites.
 * Use a stable suite key (e.g. folder path or spec basename).
 */
export function isolationMarkerLastName(suiteKey: string): string {
    const normalized = suiteKey
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40);
    return `${ISOLATION_PREFIX}_${normalized}`;
}

function newId(): string {
    return uuidv4().replace(/-/g, '');
}

function buildCustomerFieldRule(
    options: BuildCustomerLastNameRuleOptions | BuildCustomerEmailRuleOptions,
    field: 'customerLastName' | 'customerEmail',
    valueKey: 'lastName' | 'email',
): RuleConfig {
    const ruleId = options.id;
    const orContainerId = options.orContainerId ?? newId();
    const andContainerId = options.andContainerId ?? newId();
    const conditionId = options.conditionId ?? newId();
    const value = valueKey === 'lastName'
        ? (options as BuildCustomerLastNameRuleOptions).lastName
        : (options as BuildCustomerEmailRuleOptions).email;

    return {
        id: ruleId,
        name: options.name ?? `Isolation ${field} = ${value}`,
        priority: options.priority ?? 1,
        ...(options.moduleTypes ? {moduleTypes: options.moduleTypes} : {}),
        conditions: [
            {
                id: orContainerId,
                type: 'orContainer',
                ruleId,
                value: {},
                position: 0,
                children: [
                    {
                        id: andContainerId,
                        type: 'andContainer',
                        ruleId,
                        parentId: orContainerId,
                        value: {},
                        position: 0,
                        children: [
                            {
                                id: conditionId,
                                type: field,
                                ruleId,
                                parentId: andContainerId,
                                value: {
                                    operator: '=',
                                    [valueKey]: value,
                                },
                                position: 0,
                            },
                        ],
                    },
                ],
            },
        ],
    };
}

export function buildCustomerLastNameRule(options: BuildCustomerLastNameRuleOptions): RuleConfig {
    return buildCustomerFieldRule(options, 'customerLastName', 'lastName');
}

export function buildCustomerEmailRule(options: BuildCustomerEmailRuleOptions): RuleConfig {
    return buildCustomerFieldRule(options, 'customerEmail', 'email');
}

function findDeepestAndContainer(conditions: RuleConditionNode[]): RuleConditionNode | undefined {
    for (const node of conditions) {
        if (node.type === 'andContainer') {
            const nested = node.children ? findDeepestAndContainer(node.children) : undefined;
            return nested ?? node;
        }
        if (node.children?.length) {
            const nested = findDeepestAndContainer(node.children);
            if (nested) {
                return nested;
            }
        }
    }
    return undefined;
}

function cloneRule<T>(rule: T): T {
    return JSON.parse(JSON.stringify(rule)) as T;
}

/**
 * Append a customerLastName condition to the deepest AND container of an existing rule.
 */
export function mergeCustomerLastNameIntoRule(
    rule: RuleConfig | Record<string, unknown>,
    options: MergeCustomerLastNameOptions,
): RuleConfig {
    const cloned = cloneRule(rule) as RuleConfig;
    const andContainer = findDeepestAndContainer(cloned.conditions);
    if (!andContainer) {
        throw new Error('mergeCustomerLastNameIntoRule: no andContainer found in rule conditions');
    }

    const conditionId = options.conditionId ?? newId();
    andContainer.children = andContainer.children ?? [];
    andContainer.children.push({
        id: conditionId,
        type: 'customerLastName',
        ruleId: cloned.id,
        parentId: andContainer.id,
        value: {
            operator: '=',
            lastName: options.lastName,
        },
        position: andContainer.children.length,
    });

    return cloned;
}

/**
 * Append a customerEmail condition to the deepest AND container of an existing rule.
 */
export function mergeCustomerEmailIntoRule(
    rule: RuleConfig | Record<string, unknown>,
    options: MergeCustomerEmailOptions,
): RuleConfig {
    const cloned = cloneRule(rule) as RuleConfig;
    const andContainer = findDeepestAndContainer(cloned.conditions);
    if (!andContainer) {
        throw new Error('mergeCustomerEmailIntoRule: no andContainer found in rule conditions');
    }

    const conditionId = options.conditionId ?? newId();
    andContainer.children = andContainer.children ?? [];
    andContainer.children.push({
        id: conditionId,
        type: 'customerEmail',
        ruleId: cloned.id,
        parentId: andContainer.id,
        value: {
            operator: '=',
            email: options.email,
        },
        position: andContainer.children.length,
    });

    return cloned;
}

function collectTopLevelActionSequences(sequences: FlowSequence[]): FlowSequence[] {
    return sequences.filter((sequence) => sequence.actionName && !sequence.parentId);
}

function hasExistingRuleGate(sequences: FlowSequence[]): boolean {
    return sequences.some((sequence) => sequence.ruleId && !sequence.parentId);
}

/**
 * Gate all top-level flow actions behind a Shopware IF sequence for the given rule.
 * Sequences that already belong to an existing top-level rule gate are left unchanged.
 */
export function wrapFlowWithRuleGate(
    flow: FlowConfig | Record<string, unknown>,
    options: WrapFlowWithRuleGateOptions,
): FlowConfig {
    const cloned = cloneRule(flow) as FlowConfig;
    const sequences = [...(cloned.sequences ?? [])];

    if (hasExistingRuleGate(sequences)) {
        return cloned;
    }

    const gateSequenceId = options.gateSequenceId ?? newId();
    const topLevelActions = collectTopLevelActionSequences(sequences as FlowSequence[]);
    if (topLevelActions.length === 0) {
        return cloned;
    }

    const gatedSequences: FlowSequence[] = [
        {
            id: gateSequenceId,
            ruleId: options.ruleId,
            config: {},
            position: 1,
            displayGroup: 1,
        },
    ];

    for (const sequence of sequences) {
        if (sequence.actionName && !sequence.parentId) {
            gatedSequences.push({
                ...sequence,
                parentId: gateSequenceId,
                trueCase: true,
            });
            continue;
        }
        gatedSequences.push(sequence);
    }

    if (options.stopFlowOnFalse) {
        gatedSequences.push({
            id: options.falseBranchStopSequenceId ?? newId(),
            actionName: 'action.stop.flow',
            position: 1,
            displayGroup: 1,
            trueCase: false,
            parentId: gateSequenceId,
        });
    }

    cloned.sequences = gatedSequences;
    return cloned;
}
