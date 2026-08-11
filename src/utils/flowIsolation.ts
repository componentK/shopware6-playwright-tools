import type {FlowConfig, FlowSequence} from '../services/FlowService.js';
import {v4 as uuidv4, v5 as uuidv5} from 'uuid';

/** Fixed namespace so suite-key → lastName hashes stay stable across runs. */
const ISOLATION_NAMESPACE = 'a3f1c8e2-7b4d-4e9a-9c1f-2d6e8b0a5f31';

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
 *
 * Must stay unique across all suites: a plain truncate of long paths
 * (e.g. `…/error-promo-excluded` vs `…/error-promo-not-eligible`) collided
 * and let gated flows fire for the wrong worker.
 */
export function isolationMarkerLastName(suiteKey: string): string {
    const hash = uuidv5(suiteKey, ISOLATION_NAMESPACE).replace(/-/g, '').slice(0, 12);
    const normalized = suiteKey
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 28);
    return `${ISOLATION_PREFIX}_${normalized}_${hash}`;
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

/**
 * AND container used for isolation merges: the outermost flow-level AND.
 * Do NOT use the deepest AND — that often sits inside cartGoodsCount / line-item
 * filters, so customerLastName would be evaluated as a line-item filter and leak.
 */
function findTopLevelAndContainer(conditions: RuleConditionNode[]): RuleConditionNode | undefined {
    for (const node of conditions) {
        if (node.type === 'orContainer' && node.children?.length) {
            const andChild = node.children.find((child) => child.type === 'andContainer');
            if (andChild) {
                return andChild;
            }
        }
        if (node.type === 'andContainer') {
            return node;
        }
        if (node.children?.length) {
            const nested = findTopLevelAndContainer(node.children);
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
    const andContainer = findTopLevelAndContainer(cloned.conditions);
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
    const andContainer = findTopLevelAndContainer(cloned.conditions);
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

/**
 * Gate all top-level flow sequences behind a Shopware IF for the given rule.
 * If the flow already has a top-level IF (product rule), it becomes the true-branch
 * of this outer isolation gate (unless it is already gated by the same ruleId).
 */
export function wrapFlowWithRuleGate(
    flow: FlowConfig | Record<string, unknown>,
    options: WrapFlowWithRuleGateOptions,
): FlowConfig {
    const cloned = cloneRule(flow) as FlowConfig;
    const sequences = [...(cloned.sequences ?? [])];

    if (sequences.some((sequence) => sequence.ruleId === options.ruleId && !sequence.parentId)) {
        return cloned;
    }

    const rootSequences = sequences.filter((sequence) => !sequence.parentId);
    if (rootSequences.length === 0) {
        return cloned;
    }

    const gateSequenceId = options.gateSequenceId ?? newId();
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
        if (!sequence.parentId) {
            gatedSequences.push({
                ...sequence,
                parentId: gateSequenceId,
                trueCase: true,
                position: sequence.position ?? 1,
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
